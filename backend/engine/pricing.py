"""Tax and discount calculations kept independent from HTTP handlers."""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from ..core.models import DiscountRule, DiscountType, TaxRule


MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def rule_is_active(rule: DiscountRule, on_date: date) -> bool:
    if rule.valid_from and on_date < rule.valid_from:
        return False
    if rule.valid_until and on_date > rule.valid_until:
        return False
    if rule.max_uses is not None and rule.current_uses >= rule.max_uses:
        return False
    return True


def discount_amount(
    base_amount: Decimal,
    quantity: int,
    rule: Optional[DiscountRule],
    on_date: date,
) -> Decimal:
    """Return an applicable discount, capped so totals never become negative."""
    base_amount = money(max(Decimal("0.00"), base_amount))
    if not rule or not rule_is_active(rule, on_date):
        return Decimal("0.00")
    if quantity < (rule.min_qty or 0) or base_amount < (rule.min_purchase or 0):
        return Decimal("0.00")

    if rule.discount_type == DiscountType.PERCENT:
        amount = base_amount * Decimal(rule.value) / Decimal("100")
    else:
        amount = Decimal(rule.value)
    return money(min(base_amount, max(Decimal("0.00"), amount)))


def tax_amount(taxable_amount: Decimal, rule: Optional[TaxRule]) -> Decimal:
    if not rule or not rule.is_active:
        return Decimal("0.00")
    return money(max(Decimal("0.00"), taxable_amount) * Decimal(rule.rate_percent) / Decimal("100"))
