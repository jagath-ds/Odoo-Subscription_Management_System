from datetime import date
from decimal import Decimal

import pytest

from backend.core.models import BillingFrequency, DiscountRule, DiscountScope, DiscountType, Plan, Subscription, SubscriptionStatus, TaxRule
from backend.engine.pricing import discount_amount, tax_amount
from backend.engine.state_machine import apply_subscription_action


def test_percentage_discount_is_capped_and_rounded():
    rule = DiscountRule(
        discount_type=DiscountType.PERCENT,
        value=Decimal("12.5"),
        scope=DiscountScope.PRODUCT,
        current_uses=0,
    )
    assert discount_amount(Decimal("100.00"), 1, rule, date.today()) == Decimal("12.50")


def test_discount_respects_usage_limit():
    rule = DiscountRule(
        discount_type=DiscountType.FIXED,
        value=Decimal("20"),
        scope=DiscountScope.PRODUCT,
        max_uses=1,
        current_uses=1,
    )
    assert discount_amount(Decimal("100"), 1, rule, date.today()) == Decimal("0.00")


def test_tax_calculation():
    rule = TaxRule(rate_percent=Decimal("18.00"), is_active=True)
    assert tax_amount(Decimal("100.00"), rule) == Decimal("18.00")


def test_subscription_pause_and_resume_respect_plan():
    plan = Plan(
        billing_frequency=BillingFrequency.MONTHLY,
        can_pause=True,
        can_renew=True,
        can_close_early=True,
    )
    subscription = Subscription(status=SubscriptionStatus.ACTIVE, start_date=date.today())
    apply_subscription_action(subscription, plan, "pause", date.today())
    assert subscription.status == SubscriptionStatus.PAUSED
    apply_subscription_action(subscription, plan, "resume", date.today())
    assert subscription.status == SubscriptionStatus.ACTIVE


def test_pause_is_rejected_when_plan_disallows_it():
    plan = Plan(billing_frequency=BillingFrequency.MONTHLY, can_pause=False)
    subscription = Subscription(status=SubscriptionStatus.ACTIVE, start_date=date.today())
    with pytest.raises(Exception):
        apply_subscription_action(subscription, plan, "pause", date.today())
