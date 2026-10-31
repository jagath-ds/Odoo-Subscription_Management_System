"""Build the Section 5 shared-contract payloads (Contracts A and B)."""

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from ..core.models import Invoice, InvoiceStatus, Plan, Subscription, User
from .pricing_service import ZERO, money, price_subscription

OPEN_INVOICE_STATUSES = {InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID}


def _names(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    return dict(db.query(User.id, User.full_name).filter(User.id.in_(user_ids)).all())


def subscription_detail(db: Session, sub: Subscription, on_date: Optional[date] = None) -> dict:
    plan = db.get(Plan, sub.plan_id)
    customer = db.get(User, sub.customer_id)
    priced = price_subscription(db, sub, on_date)
    return {
        "id": sub.id,
        "sub_number": sub.sub_number,
        "customer_id": sub.customer_id,
        "customer_name": customer.full_name if customer else "",
        "plan_id": sub.plan_id,
        "plan_name": plan.name,
        "billing_frequency": plan.billing_frequency,
        "status": sub.status,
        "start_date": sub.start_date,
        "next_billing_date": sub.next_billing_date,
        "expiry_date": sub.expiry_date,
        "paused_at": sub.paused_at,
        "plan_permissions": {
            "auto_close": plan.auto_close,
            "can_close_early": plan.can_close_early,
            "can_pause": plan.can_pause,
            "can_renew": plan.can_renew,
        },
        "lines": [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "variant_name": p.variant_name,
                "quantity": p.quantity,
                "unit_price": p.unit_price,
                "discount_amount": p.discount_amount,
                "discount_applied": p.discount_applied or p.subscription_discount_share > 0,
                "tax_percent": p.tax_percent,
                "tax_amount": p.tax_amount,
                "line_total": p.line_total,
            }
            for p in priced.lines
        ],
        "summary": priced.summary(),
    }


def subscription_list(db: Session, subs: list[Subscription]) -> list[dict]:
    plans = {p.id: p for p in db.query(Plan).all()}
    names = _names(db, {s.customer_id for s in subs})
    rows = []
    for sub in subs:
        plan = plans[sub.plan_id]
        rows.append({
            "id": sub.id,
            "sub_number": sub.sub_number,
            "customer_name": names.get(sub.customer_id, ""),
            "plan_name": plan.name,
            "billing_frequency": plan.billing_frequency,
            "status": sub.status,
            "next_billing_date": sub.next_billing_date,
            "expiry_date": sub.expiry_date,
            "grand_total": price_subscription(db, sub).grand_total,
        })
    return rows


def _invoice_base(inv: Invoice, sub_number: str, customer_name: str, today: date) -> dict:
    amount_due = money((inv.grand_total or ZERO) - (inv.amount_paid or ZERO))
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "subscription_id": inv.subscription_id,
        "sub_number": sub_number,
        "customer_name": customer_name,
        "status": inv.status,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "is_overdue": inv.status in OPEN_INVOICE_STATUSES and inv.due_date < today and amount_due > 0,
        "grand_total": inv.grand_total,
        "amount_paid": inv.amount_paid,
        "amount_due": amount_due if inv.status != InvoiceStatus.CANCELLED else ZERO,
    }


def invoice_list(db: Session, invoices: list[Invoice], today: Optional[date] = None) -> list[dict]:
    today = today or date.today()
    sub_numbers = dict(
        db.query(Subscription.id, Subscription.sub_number)
        .filter(Subscription.id.in_({i.subscription_id for i in invoices})).all()
    ) if invoices else {}
    names = _names(db, {i.customer_id for i in invoices})
    return [
        _invoice_base(i, sub_numbers.get(i.subscription_id, ""), names.get(i.customer_id, ""), today)
        for i in invoices
    ]


def invoice_detail(db: Session, inv: Invoice, today: Optional[date] = None) -> dict:
    today = today or date.today()
    sub = db.get(Subscription, inv.subscription_id)
    customer = db.get(User, inv.customer_id)
    data = _invoice_base(inv, sub.sub_number if sub else "", customer.full_name if customer else "", today)
    data.update({
        "billing_period_key": inv.billing_period_key,
        "subtotal": inv.subtotal,
        "total_discount": inv.total_discount,
        "total_tax": inv.total_tax,
        "lines": inv.lines,
        "payments": sorted(inv.payments, key=lambda p: (p.payment_date, p.id)),
    })
    return data
