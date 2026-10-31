"""Subscription lifecycle rules."""

from datetime import date
from calendar import monthrange

from fastapi import HTTPException

from ..core.models import Plan, Subscription, SubscriptionStatus


def next_billing_date(start_date: date, frequency: str) -> date:
    if frequency == "DAILY":
        from datetime import timedelta
        return start_date + timedelta(days=1)
    if frequency == "WEEKLY":
        from datetime import timedelta
        return start_date + timedelta(days=7)
    year = start_date.year + (1 if frequency == "YEARLY" or start_date.month == 12 else 0)
    month = start_date.month if frequency == "YEARLY" else (1 if start_date.month == 12 else start_date.month + 1)
    if frequency == "YEARLY":
        day = min(start_date.day, monthrange(year, month)[1])
    else:
        day = min(start_date.day, monthrange(year, month)[1])
    return date(year, month, day)


TRANSITIONS = {
    SubscriptionStatus.DRAFT: {"quotation": SubscriptionStatus.QUOTATION, "confirm": SubscriptionStatus.CONFIRMED},
    SubscriptionStatus.QUOTATION: {"confirm": SubscriptionStatus.CONFIRMED, "close": SubscriptionStatus.CLOSED},
    SubscriptionStatus.CONFIRMED: {"activate": SubscriptionStatus.ACTIVE, "close": SubscriptionStatus.CLOSED},
    SubscriptionStatus.ACTIVE: {"pause": SubscriptionStatus.PAUSED, "close": SubscriptionStatus.CLOSED},
    SubscriptionStatus.PAUSED: {"resume": SubscriptionStatus.ACTIVE, "close": SubscriptionStatus.CLOSED},
    SubscriptionStatus.CLOSED: {"renew": SubscriptionStatus.ACTIVE},
}


def apply_subscription_action(subscription: Subscription, plan: Plan, action: str, today: date) -> Subscription:
    if action == "pause" and not plan.can_pause:
        raise HTTPException(status_code=409, detail="This plan does not allow pausing")
    if action == "close" and not plan.can_close_early and subscription.expiry_date and today < subscription.expiry_date:
        raise HTTPException(status_code=409, detail="This plan cannot be closed early")
    if action == "renew" and not plan.can_renew:
        raise HTTPException(status_code=409, detail="This plan does not allow renewal")

    target = TRANSITIONS.get(subscription.status, {}).get(action)
    if target is None:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot perform '{action}' while subscription is {subscription.status.value}",
        )

    subscription.status = target
    if action == "pause":
        subscription.paused_at = today
    elif action in {"resume", "renew"}:
        subscription.paused_at = None
        subscription.next_billing_date = next_billing_date(today, plan.billing_frequency.value)
    elif action == "close":
        subscription.expiry_date = subscription.expiry_date or today
    return subscription
