"""Finance lead summary (Contract C) and in-app notifications."""

import time
from datetime import date, datetime, time as dtime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, staff_or_admin
from ..core.database import get_db
from ..core.models import Invoice, InvoiceStatus, Subscription, SubscriptionStatus, User, UserRole
from ..core.schemas import AnalyticsSummary, AppNotification
from ..services.pricing_service import ZERO, money

router = APIRouter(prefix="/api", tags=["analytics"])
OPEN = [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID]


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(today: Optional[date] = None, db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    """Single indexed aggregate over invoices + one count over subscriptions."""
    today = today or date.today()
    started = time.perf_counter()
    balance = Invoice.grand_total - Invoice.amount_paid
    is_overdue = (Invoice.status.in_(OPEN)) & (Invoice.due_date < today)

    active_count = db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status == SubscriptionStatus.ACTIVE)
    )
    collected, outstanding, overdue_count = db.execute(
        select(
            func.coalesce(func.sum(case((Invoice.status != InvoiceStatus.CANCELLED, Invoice.amount_paid), else_=0)), 0),
            func.coalesce(func.sum(case((Invoice.status.in_(OPEN), balance), else_=0)), 0),
            func.coalesce(func.sum(case((is_overdue, 1), else_=0)), 0),
        )
    ).one()
    overdue_rows = db.execute(
        select(Invoice.id, Invoice.invoice_number, User.full_name, balance.label("amount_due"), Invoice.due_date)
        .join(User, User.id == Invoice.customer_id)
        .where(is_overdue)
        .order_by(Invoice.due_date.asc())
        .limit(50)
    ).all()
    return {
        "query_time_ms": round((time.perf_counter() - started) * 1000, 2),
        "active_subscriptions_count": active_count or 0,
        "mrr_collected": money(collected),
        "total_outstanding_owed": money(outstanding),
        "overdue_invoices_count": int(overdue_count or 0),
        "overdue_invoices": [
            {
                "invoice_id": r.id,
                "invoice_number": r.invoice_number,
                "customer_name": r.full_name,
                "amount_due": money(r.amount_due),
                "due_date": r.due_date,
                "days_overdue": (today - r.due_date).days,
            }
            for r in overdue_rows
        ],
    }


@router.get("/notifications", response_model=list[AppNotification])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Derived, stateless alerts: overdue invoices and renewals due within 7 days."""
    today = date.today()
    now = datetime.now(timezone.utc)
    invoices = db.query(Invoice).filter(Invoice.status.in_(OPEN), Invoice.due_date < today)
    subs = db.query(Subscription).filter(
        Subscription.status == SubscriptionStatus.ACTIVE,
        Subscription.expiry_date.isnot(None),
        Subscription.expiry_date >= today,
        Subscription.expiry_date <= date.fromordinal(today.toordinal() + 7),
    )
    if user.role == UserRole.CUSTOMER:
        invoices = invoices.filter(Invoice.customer_id == user.id)
        subs = subs.filter(Subscription.customer_id == user.id)
    items = [
        {
            "id": f"overdue-{inv.id}",
            "kind": "OVERDUE",
            "title": f"Invoice {inv.invoice_number} is overdue",
            "body": f"{money((inv.grand_total or ZERO) - (inv.amount_paid or ZERO))} due since {inv.due_date}",
            "href": f"/invoices/{inv.id}",
            "created_at": datetime.combine(inv.due_date, dtime.min, tzinfo=timezone.utc),
            "read": False,
        }
        for inv in invoices.order_by(Invoice.due_date).limit(20).all()
    ]
    items += [
        {
            "id": f"renewal-{s.id}",
            "kind": "RENEWAL",
            "title": f"{s.sub_number} expires on {s.expiry_date}",
            "body": "Renew or close it before the expiry date.",
            "href": f"/subscriptions/{s.id}",
            "created_at": now,
            "read": False,
        }
        for s in subs.order_by(Subscription.expiry_date).limit(20).all()
    ]
    return items


@router.post("/notifications/read-all")
def mark_notifications_read(_: User = Depends(get_current_user)):
    return {"ok": True}
