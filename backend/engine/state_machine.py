"""Brightloop Subscription & Recurring Billing ERP - Subscription State Machine.

Module: backend/engine/state_machine.py
Owner: Member 2 (Features & Business Logic Engine)

Pure business-logic state machine managing the full subscription lifecycle:
- Pipeline enforcement: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> PAUSED / CLOSED
- Plan permission verification (can_pause, can_close_early, can_renew)
- Pause tracking: records paused date, calculates paused duration, and shifts
  billing & expiry dates forward by exact paused days upon resumption
- Atomic state preservation: failed transitions return unmodified original dates
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, Set, Union

VALID_STATUSES: Set[str] = {
    "DRAFT",
    "QUOTATION",
    "CONFIRMED",
    "ACTIVE",
    "PAUSED",
    "CLOSED",
}


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


def check_subscription_transition(
    current_status: str,
    target_status: str,
    plan_flags: Optional[Dict[str, Any]] = None,
    next_billing_date: Optional[Union[str, date, datetime]] = None,
    expiry_date: Optional[Union[str, date, datetime]] = None,
    paused_at: Optional[Union[str, date, datetime]] = None,
    today_str: Optional[Union[str, date, datetime]] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Validate and execute a subscription lifecycle state transition.

    Args:
        current_status: Current status (DRAFT, QUOTATION, CONFIRMED, ACTIVE, PAUSED, CLOSED).
        target_status: Target status to transition to.
        plan_flags: Dictionary with plan permission booleans:
            - can_pause (bool): Whether subscription can enter PAUSED status.
            - can_close_early (bool): Whether subscription can be closed before expiry_date.
            - can_renew (bool): Whether subscription can be renewed from CLOSED.
        next_billing_date: Next scheduled billing date (YYYY-MM-DD).
        expiry_date: Contract expiration date (YYYY-MM-DD).
        paused_at: Date when subscription was paused (YYYY-MM-DD).
        today_str: Current reference date for evaluation (YYYY-MM-DD).
        **kwargs: Allows passing plan flags directly as kwargs (e.g. can_pause=True).

    Returns:
        Dict[str, Any] with exact keys:
            - allowed (bool): True if transition is valid and permitted, False otherwise.
            - next_status (str): New status if allowed; original current_status if rejected.
            - next_billing_date (str | None): Formatted next billing date.
            - expiry_date (str | None): Formatted expiry date.
            - paused_at (str | None): Formatted paused_at date.
            - error (str | None): Explanation message if rejected, None if allowed.
    """
    # 1. Parse and validate dates
    parsed_next_billing = _parse_date(next_billing_date)
    parsed_expiry = _parse_date(expiry_date)
    parsed_paused_at = _parse_date(paused_at)
    eval_date = _parse_date(today_str) if today_str is not None else date.today()

    orig_next_billing_str = _format_date(parsed_next_billing)
    orig_expiry_str = _format_date(parsed_expiry)
    orig_paused_at_str = _format_date(parsed_paused_at)

    def _fail(error_msg: str) -> Dict[str, Any]:
        """Helper to return atomic failure without mutating state."""
        return {
            "allowed": False,
            "next_status": (current_status or "").strip().upper(),
            "next_billing_date": orig_next_billing_str,
            "expiry_date": orig_expiry_str,
            "paused_at": orig_paused_at_str,
            "error": error_msg,
        }

    # 2. Validate status strings
    if not current_status or not isinstance(current_status, str):
        return _fail("Current status must be a non-empty string.")
    if not target_status or not isinstance(target_status, str):
        return _fail("Target status must be a non-empty string.")

    curr = current_status.strip().upper()
    target = target_status.strip().upper()

    if curr not in VALID_STATUSES:
        return _fail(f"Invalid current status '{curr}'. Valid statuses: {sorted(VALID_STATUSES)}")
    if target not in VALID_STATUSES:
        return _fail(f"Invalid target status '{target}'. Valid statuses: {sorted(VALID_STATUSES)}")

    if curr == target:
        return _fail(f"Subscription is already in '{curr}' status.")

    # 3. Resolve plan permission flags
    flags: Dict[str, Any] = {}
    if plan_flags and isinstance(plan_flags, dict):
        flags.update(plan_flags)
    flags.update(kwargs)

    # By default, if flags are not provided, allow actions unless explicitly set False
    can_pause = bool(flags.get("can_pause", True))
    can_close_early = bool(flags.get("can_close_early", True))
    can_renew = bool(flags.get("can_renew", True))

    # 4. Pipeline state validation
    # Allowed transitions mapping:
    # DRAFT -> QUOTATION, CLOSED
    # QUOTATION -> CONFIRMED, CLOSED, DRAFT
    # CONFIRMED -> ACTIVE, CLOSED
    # ACTIVE -> PAUSED, CLOSED
    # PAUSED -> ACTIVE, CLOSED
    # CLOSED -> ACTIVE, QUOTATION, DRAFT (Renewal)

    if curr == "DRAFT":
        if target not in ("QUOTATION", "CLOSED"):
            return _fail(f"Invalid transition from DRAFT to {target}. Pipeline: DRAFT -> QUOTATION.")
        return {
            "allowed": True,
            "next_status": target,
            "next_billing_date": orig_next_billing_str,
            "expiry_date": orig_expiry_str,
            "paused_at": orig_paused_at_str,
            "error": None,
        }

    if curr == "QUOTATION":
        if target not in ("CONFIRMED", "CLOSED", "DRAFT"):
            return _fail(f"Invalid transition from QUOTATION to {target}. Pipeline: QUOTATION -> CONFIRMED.")
        return {
            "allowed": True,
            "next_status": target,
            "next_billing_date": orig_next_billing_str,
            "expiry_date": orig_expiry_str,
            "paused_at": orig_paused_at_str,
            "error": None,
        }

    if curr == "CONFIRMED":
        if target not in ("ACTIVE", "CLOSED"):
            return _fail(f"Invalid transition from CONFIRMED to {target}. Pipeline: CONFIRMED -> ACTIVE.")
        return {
            "allowed": True,
            "next_status": target,
            "next_billing_date": orig_next_billing_str,
            "expiry_date": orig_expiry_str,
            "paused_at": orig_paused_at_str,
            "error": None,
        }

    if curr == "ACTIVE":
        if target == "PAUSED":
            if not can_pause:
                return _fail("Plan permissions do not allow pausing this subscription.")
            # Record the paused date
            new_paused_at_str = _format_date(eval_date)
            return {
                "allowed": True,
                "next_status": "PAUSED",
                "next_billing_date": orig_next_billing_str,
                "expiry_date": orig_expiry_str,
                "paused_at": new_paused_at_str,
                "error": None,
            }

        if target == "CLOSED":
            # Check early closure rule
            if parsed_expiry is not None and eval_date < parsed_expiry:
                if not can_close_early:
                    return _fail("Plan permissions do not allow closing this subscription before its expiry date.")
            return {
                "allowed": True,
                "next_status": "CLOSED",
                "next_billing_date": orig_next_billing_str,
                "expiry_date": orig_expiry_str,
                "paused_at": orig_paused_at_str,
                "error": None,
            }

        return _fail(f"Invalid transition from ACTIVE to {target}. Valid targets: PAUSED, CLOSED.")

    if curr == "PAUSED":
        if target == "ACTIVE":
            # Resuming paused subscription
            # Calculate paused days
            paused_days = 0
            if parsed_paused_at is not None:
                delta = (eval_date - parsed_paused_at).days
                if delta > 0:
                    paused_days = delta

            # Shift next billing date forward by paused days
            new_billing_date = parsed_next_billing
            if new_billing_date is not None and paused_days > 0:
                new_billing_date = new_billing_date + timedelta(days=paused_days)

            # Shift expiry date forward by paused days
            new_expiry_date = parsed_expiry
            if new_expiry_date is not None and paused_days > 0:
                new_expiry_date = new_expiry_date + timedelta(days=paused_days)

            return {
                "allowed": True,
                "next_status": "ACTIVE",
                "next_billing_date": _format_date(new_billing_date),
                "expiry_date": _format_date(new_expiry_date),
                "paused_at": None,  # Reset paused_at after successful resumption
                "error": None,
            }

        if target == "CLOSED":
            if parsed_expiry is not None and eval_date < parsed_expiry:
                if not can_close_early:
                    return _fail("Plan permissions do not allow closing this subscription before its expiry date.")
            return {
                "allowed": True,
                "next_status": "CLOSED",
                "next_billing_date": orig_next_billing_str,
                "expiry_date": orig_expiry_str,
                "paused_at": orig_paused_at_str,
                "error": None,
            }

        return _fail(f"Invalid transition from PAUSED to {target}. Valid targets: ACTIVE, CLOSED.")

    if curr == "CLOSED":
        # Closed subscriptions can only be renewed if can_renew is True
        if not can_renew:
            return _fail("Plan permissions do not allow renewing or reactivating this closed subscription.")

        if target in ("ACTIVE", "QUOTATION", "DRAFT"):
            return {
                "allowed": True,
                "next_status": target,
                "next_billing_date": orig_next_billing_str,
                "expiry_date": orig_expiry_str,
                "paused_at": None,
                "error": None,
            }

        return _fail(f"Invalid transition from CLOSED to {target}. Renewal targets: ACTIVE, QUOTATION, DRAFT.")

    return _fail(f"Unsupported transition from {curr} to {target}.")
