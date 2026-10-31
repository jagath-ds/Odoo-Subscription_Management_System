"""Brightloop Subscription & Recurring Billing ERP - Automated Billing Evaluator.

Module: backend/engine/billing_job.py
Owner: Member 2 (Features & Business Logic Engine)

Pure business-logic recurring billing engine evaluating subscription eligibility:
- Calendar-aware recurrence math using dateutil.relativedelta (DAILY, WEEKLY, MONTHLY, YEARLY)
- Robust leap-year and month-end handling (e.g. Jan 31 + 1 month = Feb 28/29)
- Idempotency key generation: {sub_number}:{next_billing_date}
- In-memory duplicate billing prevention against existing period keys
  (NOTE: Application logic provides defense-in-depth; concurrency safety at scale
   relies on the PostgreSQL UNIQUE(subscription_id, billing_period_key) constraint
   maintained by Member 1 & Member 4).
- Automatic closure of expired subscriptions when auto_close is enabled
- Inactive and future-dated subscription filtering
"""

from datetime import date, datetime
from typing import Any, Collection, Dict, Optional, Union
from dateutil.relativedelta import relativedelta


def _parse_date(date_val: Union[str, date, datetime, None]) -> Optional[date]:
    """Parse date from string (YYYY-MM-DD), date, or datetime object."""
    if date_val is None:
        return None
    if isinstance(date_val, datetime):
        return date_val.date()
    if isinstance(date_val, date):
        return date_val
    if isinstance(date_val, str):
        clean = date_val.strip()
        if not clean:
            return None
        try:
            return datetime.strptime(clean, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"Invalid date format '{date_val}'. Expected YYYY-MM-DD.") from exc
    raise ValueError(f"Unsupported date type: {type(date_val)}")


def _format_date(d: Optional[date]) -> Optional[str]:
    """Format a date object as standard YYYY-MM-DD string."""
    return d.isoformat() if d is not None else None


def calculate_next_billing_cycle(
    current_billing_date: Union[str, date, datetime],
    billing_frequency: str,
) -> str:
    """Calculate the next billing date using calendar-aware arithmetic.

    Handles variable month lengths and leap years via dateutil.relativedelta.
    For example:
        2026-01-31 + 1 month = 2026-02-28
        2028-01-31 + 1 month = 2028-02-29 (leap year)
        2026-03-31 + 1 month = 2026-04-30

    Args:
        current_billing_date: Starting billing date.
        billing_frequency: DAILY, WEEKLY, MONTHLY, or YEARLY.

    Returns:
        Next billing date formatted as 'YYYY-MM-DD'.

    Raises:
        ValueError: If frequency is unsupported or date is invalid.
    """
    dt = _parse_date(current_billing_date)
    if dt is None:
        raise ValueError("current_billing_date cannot be None.")

    freq = (billing_frequency or "").strip().upper()
    if freq == "DAILY":
        next_dt = dt + relativedelta(days=1)
    elif freq == "WEEKLY":
        next_dt = dt + relativedelta(weeks=1)
    elif freq == "MONTHLY":
        next_dt = dt + relativedelta(months=1)
    elif freq == "YEARLY":
        next_dt = dt + relativedelta(years=1)
    else:
        raise ValueError(
            f"Unsupported billing frequency: '{billing_frequency}'. "
            "Supported frequencies: DAILY, WEEKLY, MONTHLY, YEARLY."
        )

    return _format_date(next_dt)  # type: ignore[return-value]


def evaluate_subscription_for_billing(
    sub_number: str,
    status: str,
    billing_frequency: str,
    next_billing_date: Union[str, date, datetime],
    expiry_date: Optional[Union[str, date, datetime]] = None,
    auto_close: bool = False,
    today_str: Optional[Union[str, date, datetime]] = None,
    existing_period_keys: Optional[Collection[str]] = None,
) -> Dict[str, Any]:
    """Evaluate a subscription to determine whether it is due for automated billing.

    Pipeline:
        1. Parse dates and build canonical billing_period_key ({sub_number}:{next_billing_date}).
        2. Check expiry date: if today >= expiry_date and auto_close is True -> AUTO_CLOSE.
        3. Check status: if status is not ACTIVE -> SKIP.
        4. Check due date: if next_billing_date > today -> SKIP (not yet due).
        5. Check duplicate key: if billing_period_key already in existing_period_keys -> SKIP.
        6. Advance cycle: if all conditions met -> BILL, advancing next_billing_date.

    Args:
        sub_number: Unique subscription code (e.g. 'SUB-001').
        status: Current subscription status (e.g. 'ACTIVE', 'PAUSED', 'CLOSED').
        billing_frequency: DAILY, WEEKLY, MONTHLY, or YEARLY.
        next_billing_date: The date this subscription is currently scheduled to bill.
        expiry_date: Optional subscription contract expiration date.
        auto_close: If True, automatically marks expired subscriptions as CLOSED.
        today_str: Reference date for the billing run. Defaults to today's date.
        existing_period_keys: Set or collection of already processed billing period keys.

    Returns:
        Dict[str, Any] with exact keys:
            - action: 'BILL', 'AUTO_CLOSE', or 'SKIP'
            - billing_period_key: Canonical period string (e.g. 'SUB-001:2026-10-01')
            - next_billing_date: Formatted next billing date (YYYY-MM-DD)
            - new_status: Recommended subscription status ('ACTIVE', 'CLOSED', etc.)
            - reason: Descriptive explanation for audit logs and API responses.
    """
    clean_sub_num = (sub_number or "").strip()
    clean_status = (status or "").strip().upper()

    eval_date = _parse_date(today_str) if today_str is not None else date.today()
    parsed_billing_date = _parse_date(next_billing_date)
    parsed_expiry = _parse_date(expiry_date)

    if parsed_billing_date is None:
        raise ValueError("next_billing_date is required and cannot be empty.")

    billing_date_str = _format_date(parsed_billing_date)
    billing_period_key = f"{clean_sub_num}:{billing_date_str}"

    # 1. Check auto_close on expired subscriptions
    # Blueprint rule 1: If today_str >= expiry_date and auto_close == true, return AUTO_CLOSE
    if parsed_expiry is not None and eval_date >= parsed_expiry and auto_close:
        return {
            "action": "AUTO_CLOSE",
            "billing_period_key": billing_period_key,
            "next_billing_date": billing_date_str,
            "new_status": "CLOSED",
            "reason": (
                f"Subscription expired on {_format_date(parsed_expiry)} "
                f"and auto_close is enabled."
            ),
        }

    # 2. Check active status
    # Blueprint rule 2: Check status == ACTIVE and next_billing_date <= today_str
    if clean_status != "ACTIVE":
        return {
            "action": "SKIP",
            "billing_period_key": billing_period_key,
            "next_billing_date": billing_date_str,
            "new_status": clean_status,
            "reason": (
                f"Subscription status is '{clean_status}'. "
                "Only ACTIVE subscriptions are eligible for billing."
            ),
        }

    # 3. Check if due for billing
    if parsed_billing_date > eval_date:
        return {
            "action": "SKIP",
            "billing_period_key": billing_period_key,
            "next_billing_date": billing_date_str,
            "new_status": "ACTIVE",
            "reason": (
                f"Subscription billing date ({billing_date_str}) is in the future "
                f"relative to run date ({_format_date(eval_date)})."
            ),
        }

    # 4. Check duplicate billing period key
    # Blueprint rule 3: Build key '{sub_number}:{next_billing_date}'; skip if already in existing_period_keys
    if existing_period_keys and billing_period_key in existing_period_keys:
        return {
            "action": "SKIP",
            "billing_period_key": billing_period_key,
            "next_billing_date": billing_date_str,
            "new_status": "ACTIVE",
            "reason": (
                f"Duplicate billing prevented: Period key '{billing_period_key}' "
                "has already been billed in this cycle."
            ),
        }

    # 5. Advance next cycle by exact calendar delta
    # Blueprint rule 4: Advance next cycle by exact calendar delta (Day/Week/Month/Year)
    adv_next_billing_date = calculate_next_billing_cycle(
        parsed_billing_date,
        billing_frequency,
    )

    return {
        "action": "BILL",
        "billing_period_key": billing_period_key,
        "next_billing_date": adv_next_billing_date,
        "new_status": "ACTIVE",
        "reason": (
            f"Subscription eligible for {billing_frequency.upper()} billing. "
            f"Advanced next billing date to {adv_next_billing_date}."
        ),
    }
