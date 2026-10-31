"""Invoice generation and Billing Day batch runs.

Uses `engine.billing_job.evaluate_subscription_for_billing` to decide what to
do with each subscription, and `pricing_service` to compute snapshot totals.
Double-billing is prevented twice: by the engine's period-key check and by the
UNIQUE(subscription_id, billing_period_key) database constraint.
"""

import time
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..core.models import (
    DiscountRule,
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Plan,
    Subscription,
    SubscriptionStatus,
    User,
)
from ..engine import evaluate_subscription_for_billing
from ..engine.billing_job import calculate_next_billing_cycle
from .pricing_service import ZERO, money, price_subscription


def period_key(subscription: Subscription) -> str:
    billing_date = subscription.next_billing_date or subscription.start_date
    return f"{subscription.sub_number}:{billing_date.isoformat()}"


def build_invoice(
    db: Session,
    subscription: Subscription,
    billing_period_key: str,
    on_date: date,
    status: InvoiceStatus = InvoiceStatus.DRAFT,
) -> Invoice:
    """Create an invoice (with immutable line snapshots) from a subscription."""
    if not subscription.lines:
        raise HTTPException(status_code=409, detail="Subscription has no lines to invoice")
    priced = price_subscription(db, subscription, on_date)

    invoice = Invoice(
        invoice_number=f"INV-{on_date:%Y%m%d}-{uuid4().hex[:6].upper()}",
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        billing_period_key=billing_period_key,
        status=status,
        issue_date=on_date,
        due_date=on_date + timedelta(days=subscription.payment_terms_days or 0),
        subtotal=priced.subtotal,
        total_discount=priced.total_discount,
        total_tax=priced.total_tax,
        grand_total=priced.grand_total,
        amount_paid=ZERO,
    )
    for p in priced.lines:
        invoice.lines.append(InvoiceLine(
            product_name_snapshot=p.product_name,
            variant_name_snapshot=p.variant_name,
            quantity=p.quantity,
            unit_price_snapshot=p.unit_price,
            discount_amount=p.discount_amount,
            tax_percent_snapshot=p.tax_percent,
            tax_amount=p.tax_amount,
            line_total=p.line_total,
        ))
    # Each applied discount consumes one use, atomically in SQL.
    for rule_id in priced.applied_rule_ids:
        db.query(DiscountRule).filter(DiscountRule.id == rule_id).update(
            {DiscountRule.current_uses: DiscountRule.current_uses + 1}, synchronize_session=False
        )
    db.add(invoice)
    return invoice


def invoice_now(db: Session, subscription: Subscription, on_date: date) -> Invoice:
    """Manual 'Create Invoice' for the subscription's current billing period."""
    if subscription.status not in {SubscriptionStatus.CONFIRMED, SubscriptionStatus.ACTIVE}:
        raise HTTPException(status_code=409, detail="Only confirmed or active subscriptions can be invoiced")
    plan = db.get(Plan, subscription.plan_id)
    key = period_key(subscription)
    if db.query(Invoice.id).filter_by(subscription_id=subscription.id, billing_period_key=key).first():
        raise HTTPException(status_code=409, detail=f"Invoice already exists for period {key}")
    invoice = build_invoice(db, subscription, key, on_date)
    billing_date = subscription.next_billing_date or subscription.start_date
    subscription.next_billing_date = date.fromisoformat(
        calculate_next_billing_cycle(billing_date, plan.billing_frequency.value)
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Invoice already exists for period {key}")
    db.refresh(invoice)
    return invoice


def run_billing_day(db: Session, today: date) -> dict:
    """Billing Day: bill every due ACTIVE subscription and auto-close expired ones.

    Each subscription runs in its own SAVEPOINT so one bad record never blocks
    the rest of the batch.
    """
    started = time.perf_counter()
    candidates = db.scalars(
        select(Subscription)
        .options(selectinload(Subscription.lines))
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            or_(Subscription.next_billing_date <= today, Subscription.expiry_date <= today),
        )
        .order_by(Subscription.id)
    ).all()

    plans = {p.id: p for p in db.query(Plan).all()}
    customer_ids = {s.customer_id for s in candidates}
    names = dict(db.query(User.id, User.full_name).filter(User.id.in_(customer_ids)).all()) if customer_ids else {}
    existing = {
        key for (key,) in db.query(Invoice.billing_period_key)
        .filter(Invoice.subscription_id.in_([s.id for s in candidates])).all()
    } if candidates else set()

    decisions, billed, skipped, auto_closed, total = [], 0, 0, 0, ZERO
    for sub in candidates:
        plan = plans[sub.plan_id]
        verdict = evaluate_subscription_for_billing(
            sub_number=sub.sub_number,
            status=sub.status.value,
            billing_frequency=plan.billing_frequency.value,
            next_billing_date=sub.next_billing_date,
            expiry_date=sub.expiry_date,
            auto_close=plan.auto_close,
            today_str=today,
            existing_period_keys=existing,
        )
        action, amount, reason = verdict["action"], ZERO, verdict["reason"]
        try:
            with db.begin_nested():
                if action == "AUTO_CLOSE":
                    sub.status = SubscriptionStatus.CLOSED
                    auto_closed += 1
                elif action == "BILL":
                    invoice = build_invoice(
                        db, sub, verdict["billing_period_key"], today, status=InvoiceStatus.CONFIRMED,
                    )
                    sub.next_billing_date = date.fromisoformat(verdict["next_billing_date"])
                    db.flush()
                    existing.add(verdict["billing_period_key"])
                    amount = money(invoice.grand_total)
                    total += amount
                    billed += 1
                else:
                    skipped += 1
        except Exception as exc:  # noqa: BLE001 - isolate one bad record from the batch
            action, reason, amount = "SKIP", f"Failed and rolled back: {exc}", ZERO
            skipped += 1
        decisions.append({
            "sub_number": sub.sub_number,
            "customer_name": names.get(sub.customer_id, ""),
            "action": action,
            "period_key": verdict["billing_period_key"],
            "amount": amount,
            "reason": reason,
        })
    db.commit()
    return {
        "ran_at": datetime.now(timezone.utc),
        "today": today,
        "billed": billed,
        "skipped": skipped,
        "auto_closed": auto_closed,
        "total_amount": total,
        "decisions": decisions,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
    }
