"""Unit tests for the Brightloop Automated Billing Evaluator.

Module: tests/test_billing_job.py
Owner: Member 2 (Features & Business Logic Engine)
"""

import pytest
from backend.engine.billing_job import (
    calculate_next_billing_cycle,
    evaluate_subscription_for_billing,
)


class TestBillingEvaluator:
    """Test suite for evaluate_subscription_for_billing and date advances."""

    def test_active_subscription_due_for_monthly_billing(self):
        """Active subscription due today bills and advances by 1 calendar month."""
        result = evaluate_subscription_for_billing(
            sub_number="SUB-001",
            status="ACTIVE",
            billing_frequency="MONTHLY",
            next_billing_date="2026-10-01",
            today_str="2026-10-01",
        )

        assert result["action"] == "BILL"
        assert result["billing_period_key"] == "SUB-001:2026-10-01"
        assert result["next_billing_date"] == "2026-11-01"
        assert result["new_status"] == "ACTIVE"
        assert "eligible for MONTHLY billing" in result["reason"]

    def test_future_billing_date_is_skipped(self):
        """Subscriptions with billing dates in the future must be skipped."""
        result = evaluate_subscription_for_billing(
            sub_number="SUB-002",
            status="ACTIVE",
            billing_frequency="MONTHLY",
            next_billing_date="2026-11-15",
            today_str="2026-10-31",
        )

        assert result["action"] == "SKIP"
        assert result["billing_period_key"] == "SUB-002:2026-11-15"
        assert result["next_billing_date"] == "2026-11-15"
        assert result["new_status"] == "ACTIVE"
        assert "in the future" in result["reason"]

    def test_paused_subscription_is_skipped(self):
        """Paused subscriptions must never be billed."""
        result = evaluate_subscription_for_billing(
            sub_number="SUB-003",
            status="PAUSED",
            billing_frequency="MONTHLY",
            next_billing_date="2026-10-01",
            today_str="2026-10-31",
        )

        assert result["action"] == "SKIP"
        assert result["new_status"] == "PAUSED"
        assert "Only ACTIVE subscriptions are eligible" in result["reason"]

    def test_closed_subscription_is_skipped(self):
        """Closed subscriptions must never be billed."""
        result = evaluate_subscription_for_billing(
            sub_number="SUB-004",
            status="CLOSED",
            billing_frequency="MONTHLY",
            next_billing_date="2026-10-01",
            today_str="2026-10-31",
        )

        assert result["action"] == "SKIP"
        assert result["new_status"] == "CLOSED"
        assert "Only ACTIVE subscriptions are eligible" in result["reason"]

    def test_expired_subscription_auto_close_enabled(self):
        """Expired subscription with auto_close=True transitions to AUTO_CLOSE / CLOSED."""
        result = evaluate_subscription_for_billing(
            sub_number="SUB-005",
            status="ACTIVE",
            billing_frequency="MONTHLY",
            next_billing_date="2026-10-01",
            expiry_date="2026-10-15",
            auto_close=True,
            today_str="2026-10-31",
        )

        assert result["action"] == "AUTO_CLOSE"
        assert result["new_status"] == "CLOSED"
        assert result["billing_period_key"] == "SUB-005:2026-10-01"
        assert "auto_close is enabled" in result["reason"]

    def test_duplicate_billing_period_key_prevention(self):
        """If period key exists in already processed set, action is SKIP."""
        existing_keys = {"SUB-006:2026-10-01", "SUB-007:2026-10-01"}

        result = evaluate_subscription_for_billing(
            sub_number="SUB-006",
            status="ACTIVE",
            billing_frequency="MONTHLY",
            next_billing_date="2026-10-01",
            today_str="2026-10-01",
            existing_period_keys=existing_keys,
        )

        assert result["action"] == "SKIP"
        assert result["billing_period_key"] == "SUB-006:2026-10-01"
        assert result["next_billing_date"] == "2026-10-01"
        assert "Duplicate billing prevented" in result["reason"]

    def test_all_frequency_advancements(self):
        """Verify DAILY, WEEKLY, MONTHLY, and YEARLY increments."""
        # DAILY
        d_next = calculate_next_billing_cycle("2026-05-01", "DAILY")
        assert d_next == "2026-05-02"

        # WEEKLY
        w_next = calculate_next_billing_cycle("2026-05-01", "WEEKLY")
        assert w_next == "2026-05-08"

        # MONTHLY
        m_next = calculate_next_billing_cycle("2026-05-01", "MONTHLY")
        assert m_next == "2026-06-01"

        # YEARLY
        y_next = calculate_next_billing_cycle("2026-05-01", "YEARLY")
        assert y_next == "2027-05-01"

    def test_month_end_date_calculations(self):
        """Verify calendar-aware month-end handling (e.g. Jan 31 -> Feb 28)."""
        # Non leap year (2026): Jan 31 + 1 month = Feb 28
        assert calculate_next_billing_cycle("2026-01-31", "MONTHLY") == "2026-02-28"

        # Leap year (2028): Jan 31 + 1 month = Feb 29
        assert calculate_next_billing_cycle("2028-01-31", "MONTHLY") == "2028-02-29"

        # March 31 + 1 month = April 30 (30 days in April)
        assert calculate_next_billing_cycle("2026-03-31", "MONTHLY") == "2026-04-30"

        # Leap day Feb 29 + 1 year = Feb 28
        assert calculate_next_billing_cycle("2028-02-29", "YEARLY") == "2029-02-28"

    def test_unsupported_frequency_raises_error(self):
        """Invalid frequency parameter raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported billing frequency"):
            calculate_next_billing_cycle("2026-01-01", "HOURLY")
