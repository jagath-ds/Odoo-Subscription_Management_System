"""Unit tests for the Brightloop Subscription State Machine.

Module: tests/test_state_machine.py
Owner: Member 2 (Features & Business Logic Engine)
"""

import pytest
from backend.engine.state_machine import check_subscription_transition


class TestSubscriptionStateMachine:
    """Test suite for check_subscription_transition."""

    def test_complete_valid_lifecycle_pipeline(self):
        """Walk through standard lifecycle pipeline:
        DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED
        """
        # 1. DRAFT -> QUOTATION
        r1 = check_subscription_transition("DRAFT", "QUOTATION")
        assert r1["allowed"] is True
        assert r1["next_status"] == "QUOTATION"
        assert r1["error"] is None

        # 2. QUOTATION -> CONFIRMED
        r2 = check_subscription_transition("QUOTATION", "CONFIRMED")
        assert r2["allowed"] is True
        assert r2["next_status"] == "CONFIRMED"

        # 3. CONFIRMED -> ACTIVE
        r3 = check_subscription_transition(
            "CONFIRMED",
            "ACTIVE",
            next_billing_date="2026-11-01",
            expiry_date="2027-11-01",
        )
        assert r3["allowed"] is True
        assert r3["next_status"] == "ACTIVE"
        assert r3["next_billing_date"] == "2026-11-01"
        assert r3["expiry_date"] == "2027-11-01"

        # 4. ACTIVE -> CLOSED (after expiry)
        r4 = check_subscription_transition(
            "ACTIVE",
            "CLOSED",
            expiry_date="2027-11-01",
            today_str="2027-11-02",
        )
        assert r4["allowed"] is True
        assert r4["next_status"] == "CLOSED"

    def test_invalid_pipeline_jumping(self):
        """Prevent skipping intermediate stages (e.g. DRAFT -> ACTIVE directly)."""
        res = check_subscription_transition("DRAFT", "ACTIVE")
        assert res["allowed"] is False
        assert res["next_status"] == "DRAFT"
        assert "Invalid transition" in res["error"]

    def test_invalid_status_name(self):
        """Non-existent statuses must be rejected."""
        res = check_subscription_transition("DRAFT", "NON_EXISTENT")
        assert res["allowed"] is False
        assert "Invalid target status" in res["error"]

    def test_transition_to_same_status(self):
        """Transitioning to identical status must fail gracefully."""
        res = check_subscription_transition("ACTIVE", "ACTIVE")
        assert res["allowed"] is False
        assert "already in 'ACTIVE' status" in res["error"]

    def test_pausing_when_permitted(self):
        """When plan allows pause, entering PAUSED records paused_at date."""
        res = check_subscription_transition(
            current_status="ACTIVE",
            target_status="PAUSED",
            plan_flags={"can_pause": True},
            next_billing_date="2026-11-15",
            expiry_date="2027-05-15",
            today_str="2026-10-31",
        )

        assert res["allowed"] is True
        assert res["next_status"] == "PAUSED"
        assert res["paused_at"] == "2026-10-31"
        assert res["next_billing_date"] == "2026-11-15"
        assert res["expiry_date"] == "2027-05-15"
        assert res["error"] is None

    def test_pausing_when_disallowed(self):
        """When plan disallows pause, transition to PAUSED is blocked."""
        res = check_subscription_transition(
            current_status="ACTIVE",
            target_status="PAUSED",
            plan_flags={"can_pause": False},
            next_billing_date="2026-11-15",
            expiry_date="2027-05-15",
        )

        assert res["allowed"] is False
        assert res["next_status"] == "ACTIVE"
        assert res["paused_at"] is None
        assert "do not allow pausing" in res["error"]

    def test_resuming_paused_subscription_shifts_dates(self):
        """Resuming after 12 paused days shifts next_billing_date & expiry_date forward by 12 days."""
        res = check_subscription_transition(
            current_status="PAUSED",
            target_status="ACTIVE",
            next_billing_date="2026-11-01",
            expiry_date="2027-10-01",
            paused_at="2026-10-01",
            today_str="2026-10-13",  # 12 days paused
        )

        assert res["allowed"] is True
        assert res["next_status"] == "ACTIVE"
        # 2026-11-01 + 12 days = 2026-11-13
        assert res["next_billing_date"] == "2026-11-13"
        # 2027-10-01 + 12 days = 2027-10-13
        assert res["expiry_date"] == "2027-10-13"
        # paused_at must be reset to None
        assert res["paused_at"] is None
        assert res["error"] is None

    def test_resuming_with_same_day_pause(self):
        """Resuming on the same day as pause (0 days paused) does not shift dates."""
        res = check_subscription_transition(
            current_status="PAUSED",
            target_status="ACTIVE",
            next_billing_date="2026-11-01",
            expiry_date="2027-10-01",
            paused_at="2026-10-01",
            today_str="2026-10-01",
        )

        assert res["allowed"] is True
        assert res["next_status"] == "ACTIVE"
        assert res["next_billing_date"] == "2026-11-01"
        assert res["expiry_date"] == "2027-10-01"
        assert res["paused_at"] is None

    def test_early_closure_disallowed(self):
        """When plan_flags['can_close_early'] is False and date < expiry_date, close is blocked."""
        res = check_subscription_transition(
            current_status="ACTIVE",
            target_status="CLOSED",
            plan_flags={"can_close_early": False},
            expiry_date="2027-01-01",
            today_str="2026-10-31",
        )

        assert res["allowed"] is False
        assert res["next_status"] == "ACTIVE"
        assert "closing this subscription before its expiry date" in res["error"]

    def test_early_closure_allowed(self):
        """When plan_flags['can_close_early'] is True, closing before expiry is permitted."""
        res = check_subscription_transition(
            current_status="ACTIVE",
            target_status="CLOSED",
            plan_flags={"can_close_early": True},
            expiry_date="2027-01-01",
            today_str="2026-10-31",
        )

        assert res["allowed"] is True
        assert res["next_status"] == "CLOSED"
        assert res["error"] is None

    def test_closed_subscription_renewal(self):
        """Renewing CLOSED subscription requires can_renew flag."""
        # Allowed renewal
        res_ok = check_subscription_transition(
            current_status="CLOSED",
            target_status="ACTIVE",
            plan_flags={"can_renew": True},
        )
        assert res_ok["allowed"] is True
        assert res_ok["next_status"] == "ACTIVE"

        # Disallowed renewal
        res_fail = check_subscription_transition(
            current_status="CLOSED",
            target_status="ACTIVE",
            plan_flags={"can_renew": False},
        )
        assert res_fail["allowed"] is False
        assert res_fail["next_status"] == "CLOSED"
        assert "do not allow renewing" in res_fail["error"]
