"""Invoice, payment, overdue, and printable-invoice endpoints."""

from datetime import date
from decimal import Decimal
from html import escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, require_role
from ..core.database import get_db
from ..core.models import Invoice, InvoiceStatus, Payment, User, UserRole
from ..core.schemas import (
    InvoiceAction,
    InvoiceResponse,
    InvoiceSummary,
    PaymentCreate,
    PaymentResponse,
)


router = APIRouter(prefix="/api/invoices", tags=["invoices"])
staff_or_admin = require_role(UserRole.ADMIN, UserRole.STAFF)


def _can_access(current_user: User, customer_id: int) -> bool:
    return current_user.role != UserRole.CUSTOMER or current_user.id == customer_id


def _get_invoice(db: Session, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    invoice_status: InvoiceStatus | None = None,
    overdue_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Invoice)
    if current_user.role == UserRole.CUSTOMER:
        query = query.filter(Invoice.customer_id == current_user.id)
    if invoice_status:
        query = query.filter(Invoice.status == invoice_status)
    if overdue_only:
        query = query.filter(
            Invoice.due_date < date.today(),
            Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
        )
    return query.order_by(Invoice.due_date.asc(), Invoice.id.desc()).all()


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice(db, invoice_id)
    if not _can_access(current_user, invoice.customer_id):
        raise HTTPException(status_code=403, detail="Not allowed to access this invoice")
    return invoice


@router.post("/{invoice_id}/actions")
def invoice_action(
    invoice_id: int,
    payload: InvoiceAction,
    db: Session = Depends(get_db),
    _: User = Depends(staff_or_admin),
):
    invoice = _get_invoice(db, invoice_id)
    if payload.action == "confirm":
        if invoice.status == InvoiceStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Cancelled invoices cannot be confirmed")
        invoice.status = InvoiceStatus.CONFIRMED
        message = "Invoice confirmed"
    elif payload.action == "cancel":
        if invoice.amount_paid and invoice.amount_paid > 0:
            raise HTTPException(status_code=409, detail="Invoices with payments cannot be cancelled")
        invoice.status = InvoiceStatus.CANCELLED
        message = "Invoice cancelled"
    else:
        if invoice.status == InvoiceStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Cancelled invoices cannot be sent")
        # Email delivery is intentionally not coupled to the API in the hackathon build.
        message = "Invoice marked ready for sending; email delivery is not configured"
    db.commit()
    return {"invoice_id": invoice.id, "status": invoice.status, "message": message}


@router.get("/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice(db, invoice_id)
    if not _can_access(current_user, invoice.customer_id):
        raise HTTPException(status_code=403, detail="Not allowed to print this invoice")
    rows = "".join(
        f"<tr><td>{escape(line.product_name_snapshot)}</td><td>{line.quantity}</td>"
        f"<td>{line.unit_price_snapshot}</td><td>{line.line_total}</td></tr>"
        for line in invoice.lines
    )
    return HTMLResponse(
        f"<!doctype html><html><head><title>{escape(invoice.invoice_number)}</title>"
        "<style>body{font-family:Arial;margin:40px}table{border-collapse:collapse;width:100%}"
        "th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>"
        f"<h1>Invoice {escape(invoice.invoice_number)}</h1><p>Status: {invoice.status.value}</p>"
        f"<p>Due: {invoice.due_date}</p><table><tr><th>Item</th><th>Qty</th>"
        f"<th>Unit price</th><th>Total</th></tr>{rows}</table>"
        f"<h2>Total: {invoice.grand_total}</h2></body></html>"
    )


@router.get("/summary/overdue", response_model=list[InvoiceSummary])
def overdue_summary(
    db: Session = Depends(get_db),
    _: User = Depends(staff_or_admin),
):
    invoices = db.query(Invoice).filter(
        Invoice.due_date < date.today(),
        Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
    ).order_by(Invoice.due_date.asc()).all()
    return [
        InvoiceSummary(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            status=invoice.status,
            due_date=invoice.due_date,
            grand_total=invoice.grand_total,
            amount_paid=invoice.amount_paid,
            balance_due=Decimal(invoice.grand_total or 0) - Decimal(invoice.amount_paid or 0),
            overdue=True,
        )
        for invoice in invoices
    ]


@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    invoice_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(staff_or_admin),
):
    invoice = _get_invoice(db, invoice_id)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Cancelled invoices cannot receive payments")
    remaining = Decimal(invoice.grand_total or 0) - Decimal(invoice.amount_paid or 0)
    if payload.amount > remaining:
        raise HTTPException(status_code=400, detail=f"Payment exceeds remaining balance of {remaining}")
    payment = Payment(invoice_id=invoice.id, **payload.model_dump())
    invoice.amount_paid = Decimal(invoice.amount_paid or 0) + payload.amount
    invoice.status = InvoiceStatus.PAID if invoice.amount_paid >= invoice.grand_total else InvoiceStatus.PARTIALLY_PAID
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
