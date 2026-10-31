"""Invoices (Contract B), payments ledger, and Billing Day batch endpoints."""

from datetime import date
from decimal import Decimal
from html import escape
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, staff_or_admin
from ..core.database import get_db
from ..core.models import Invoice, InvoiceStatus, Payment, Subscription, User, UserRole
from ..core.schemas import (
    BillingRunReport,
    BillingRunRequest,
    InvoiceDetail,
    InvoiceListItem,
    PaymentCreate,
    PaymentListItem,
    ReminderResponse,
)
from ..services.invoicing import run_billing_day
from ..services.presenters import OPEN_INVOICE_STATUSES, invoice_detail, invoice_list
from ..services.pricing_service import money

router = APIRouter(prefix="/api", tags=["invoices & payments"])


def _load(db: Session, invoice_id: int, user: User) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.role == UserRole.CUSTOMER and invoice.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this invoice")
    return invoice


def _overdue_filter(today: date):
    return (
        Invoice.status.in_(list(OPEN_INVOICE_STATUSES)),
        Invoice.due_date < today,
    )


# Invoices
@router.get("/invoices", response_model=list[InvoiceListItem])
def list_invoices(
    status: Optional[InvoiceStatus] = None,  # noqa: A002 - matches the frontend query param
    is_overdue: Optional[bool] = None,
    q: Optional[str] = None,
    subscription_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    query = db.query(Invoice)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Invoice.customer_id == user.id)
    if status:
        query = query.filter(Invoice.status == status)
    if subscription_id:
        query = query.filter(Invoice.subscription_id == subscription_id)
    if is_overdue is True:
        query = query.filter(*_overdue_filter(today))
    elif is_overdue is False:
        query = query.filter(or_(Invoice.status.notin_(list(OPEN_INVOICE_STATUSES)), Invoice.due_date >= today))
    if q:
        like = f"%{q.strip()}%"
        query = (
            query.join(User, User.id == Invoice.customer_id)
            .join(Subscription, Subscription.id == Invoice.subscription_id)
            .filter(or_(Invoice.invoice_number.ilike(like), User.full_name.ilike(like), Subscription.sub_number.ilike(like)))
        )
    invoices = query.order_by(Invoice.issue_date.desc(), Invoice.id.desc()).limit(500).all()
    return invoice_list(db, invoices, today)


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return invoice_detail(db, _load(db, invoice_id, user))


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceDetail)
def confirm_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    invoice = _load(db, invoice_id, user)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=409, detail=f"Only DRAFT invoices can be confirmed (current: {invoice.status.value})")
    invoice.status = InvoiceStatus.CONFIRMED
    db.commit()
    return invoice_detail(db, invoice)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceDetail)
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    invoice = _load(db, invoice_id, user)
    if invoice.status in {InvoiceStatus.PAID, InvoiceStatus.CANCELLED} or (invoice.amount_paid or 0) > 0:
        raise HTTPException(status_code=409, detail="Paid or partially paid invoices cannot be cancelled")
    invoice.status = InvoiceStatus.CANCELLED
    db.commit()
    return invoice_detail(db, invoice)


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceDetail)
def send_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    """Sending a draft confirms it first. Delivery uses the printable invoice link."""
    invoice = _load(db, invoice_id, user)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Cancelled invoices cannot be sent")
    if invoice.status == InvoiceStatus.DRAFT:
        invoice.status = InvoiceStatus.CONFIRMED
    db.commit()
    return invoice_detail(db, invoice)


@router.post("/invoices/{invoice_id}/remind", response_model=ReminderResponse)
def remind_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    invoice = _load(db, invoice_id, user)
    customer = db.get(User, invoice.customer_id)
    return ReminderResponse(to=customer.email if customer else "")


@router.get("/invoices/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = invoice_detail(db, _load(db, invoice_id, user))
    rows = "".join(
        f"<tr><td>{escape(l.product_name_snapshot)}{(' (' + escape(l.variant_name_snapshot) + ')') if l.variant_name_snapshot else ''}</td>"
        f"<td>{l.quantity}</td><td>{l.unit_price_snapshot}</td><td>{l.discount_amount}</td>"
        f"<td>{l.tax_percent_snapshot}%</td><td>{l.tax_amount}</td><td>{l.line_total}</td></tr>"
        for l in data["lines"]
    )
    return HTMLResponse(
        f"<!doctype html><html><head><meta charset='utf-8'><title>{escape(data['invoice_number'])}</title>"
        "<style>body{font-family:Arial,sans-serif;margin:40px}table{border-collapse:collapse;width:100%}"
        "th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body onload='window.print()'>"
        f"<h1>Invoice {escape(data['invoice_number'])}</h1>"
        f"<p>Customer: {escape(data['customer_name'])}<br>Subscription: {escape(data['sub_number'])}<br>"
        f"Status: {data['status'].value}<br>Issued: {data['issue_date']} &middot; Due: {data['due_date']}</p>"
        "<table><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax %</th><th>Tax</th><th>Total</th></tr>"
        f"{rows}</table><p>Subtotal: {data['subtotal']}<br>Discount: {data['total_discount']}<br>"
        f"Tax: {data['total_tax']}</p><h2>Total: {data['grand_total']}</h2>"
        f"<p>Paid: {data['amount_paid']} &middot; Due: {data['amount_due']}</p></body></html>"
    )


# Payments
@router.get("/payments", response_model=list[PaymentListItem])
def list_payments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = (
        db.query(Payment, Invoice.invoice_number, User.full_name)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .join(User, User.id == Invoice.customer_id)
    )
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Invoice.customer_id == user.id)
    rows = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).limit(500).all()
    return [
        {
            "id": p.id, "invoice_id": p.invoice_id, "payment_method": p.payment_method,
            "amount": p.amount, "payment_date": p.payment_date, "note": p.note,
            "invoice_number": number, "customer_name": name,
        }
        for p, number, name in rows
    ]


@router.post("/payments", response_model=InvoiceDetail, status_code=status.HTTP_201_CREATED)
def record_payment(payload: PaymentCreate, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    """Record a (possibly partial) payment against an invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).with_for_update().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in OPEN_INVOICE_STATUSES:
        raise HTTPException(status_code=409, detail=f"Payments can only be recorded on confirmed invoices (current: {invoice.status.value})")
    remaining = money(Decimal(invoice.grand_total or 0) - Decimal(invoice.amount_paid or 0))
    if payload.amount > remaining:
        raise HTTPException(status_code=400, detail=f"Payment exceeds the remaining balance of {remaining}")
    db.add(Payment(**payload.model_dump()))
    invoice.amount_paid = money(Decimal(invoice.amount_paid or 0) + payload.amount)
    invoice.status = InvoiceStatus.PAID if invoice.amount_paid >= invoice.grand_total else InvoiceStatus.PARTIALLY_PAID
    db.commit()
    db.refresh(invoice)
    return invoice_detail(db, invoice)


# Billing Day
@router.post("/billing/batch", response_model=BillingRunReport, tags=["billing day"])
def billing_batch(payload: BillingRunRequest, db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    """Generate invoices for every due ACTIVE subscription. Safe to run twice:
    the second run bills nothing (idempotent by billing period key)."""
    return run_billing_day(db, payload.today or date.today())
