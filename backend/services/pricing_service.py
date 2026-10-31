"""Price a subscription's lines using the pure `engine.pricing` module.

Order of operations (Team Blueprint, Pricing Engine):
    unit = base + variant_extra -> gross = unit * qty -> product-scope discount
    -> subscription-scope discount (allocated pro-rata across lines)
    -> tax on the discounted (taxable) amount -> line total.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.orm import Session

from ..core.models import DiscountRule, DiscountScope, Product, ProductVariant, Subscription, TaxRule
from ..engine import calculate_line_item

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


def discount_payload(rule: Optional[DiscountRule]) -> Optional[dict]:
    """Map a DiscountRule row to the engine's flat discount dictionary."""
    if rule is None:
        return None
    return {
        "discount_type": rule.discount_type.value,
        "value": rule.value,
        "min_qty": rule.min_qty or 0,
        "min_purchase": rule.min_purchase or 0,
        "max_uses": rule.max_uses,
        "current_uses": rule.current_uses or 0,
        "valid_from": rule.valid_from,
        "valid_until": rule.valid_until,
    }


def variant_label(variant: Optional[ProductVariant]) -> Optional[str]:
    return f"{variant.attribute_name}: {variant.attribute_value}" if variant else None


@dataclass
class PricedLine:
    product_id: int
    product_name: str
    variant_name: Optional[str]
    quantity: int
    unit_price: Decimal
    gross_amount: Decimal
    line_discount: Decimal
    discount_applied: bool
    tax_percent: Decimal
    subscription_discount_share: Decimal = ZERO
    tax_amount: Decimal = ZERO
    line_total: Decimal = ZERO

    @property
    def discount_amount(self) -> Decimal:
        return money(self.line_discount + self.subscription_discount_share)


@dataclass
class PricedSubscription:
    lines: list[PricedLine]
    subtotal: Decimal
    line_discount_total: Decimal
    subscription_discount: Decimal
    total_tax: Decimal
    grand_total: Decimal
    applied_rule_ids: set[int] = field(default_factory=set)

    @property
    def total_discount(self) -> Decimal:
        return money(self.line_discount_total + self.subscription_discount)

    def summary(self) -> dict:
        return {
            "subtotal": self.subtotal,
            "line_discount_total": self.line_discount_total,
            "subscription_discount": self.subscription_discount,
            "total_discount": self.total_discount,
            "total_tax": self.total_tax,
            "grand_total": self.grand_total,
        }


def _best_discount(rules: list[DiscountRule], **kwargs) -> tuple[Optional[DiscountRule], dict]:
    """Evaluate candidate rules with the engine and keep the largest discount."""
    best_rule, best = None, None
    for rule in rules:
        result = calculate_line_item(discount=discount_payload(rule), **kwargs)
        if result["discount_applied"] and (best is None or result["discount_amount"] > best["discount_amount"]):
            best_rule, best = rule, result
    if best is None:
        best = calculate_line_item(discount=None, **kwargs)
    return best_rule, best


def price_subscription(db: Session, subscription: Subscription, on_date: Optional[date] = None) -> PricedSubscription:
    """Explicitly linked discount rules are used as-is; otherwise every eligible
    rule of the matching scope is considered automatically, so admin-defined
    discounts appear on the next invoice on their own and stop once expired or
    used up."""
    on_date = on_date or date.today()
    priced: list[PricedLine] = []
    applied: set[int] = set()
    all_rules = db.query(DiscountRule).all()
    product_rules = [r for r in all_rules if r.scope == DiscountScope.PRODUCT]
    subscription_rules = [r for r in all_rules if r.scope == DiscountScope.SUBSCRIPTION]

    for line in subscription.lines:
        product = db.get(Product, line.product_id)
        variant = db.get(ProductVariant, line.variant_id) if line.variant_id else None
        tax = db.get(TaxRule, line.tax_id) if line.tax_id else None
        explicit = db.get(DiscountRule, line.discount_id) if line.discount_id else None
        tax_percent = money(tax.rate_percent) if tax and tax.is_active else ZERO

        # unit_price on the line already includes the variant extra.
        rule, result = _best_discount(
            [explicit] if explicit else product_rules,
            base_price=line.unit_price,
            variant_extra=0,
            quantity=line.quantity,
            tax_percent=0,
            today_str=on_date,
        )
        if result["discount_applied"] and rule is not None:
            applied.add(rule.id)
        priced.append(PricedLine(
            product_id=line.product_id,
            product_name=product.name if product else f"Product #{line.product_id}",
            variant_name=variant_label(variant),
            quantity=line.quantity,
            unit_price=money(result["unit_price"]),
            gross_amount=money(result["gross_amount"]),
            line_discount=money(result["discount_amount"]),
            discount_applied=bool(result["discount_applied"]),
            tax_percent=tax_percent,
        ))

    subtotal = money(sum((p.gross_amount for p in priced), ZERO))
    line_discount_total = money(sum((p.line_discount for p in priced), ZERO))
    after_line_discounts = money(subtotal - line_discount_total)

    # Subscription-scope discount: evaluated on the whole order, then allocated.
    subscription_discount = ZERO
    explicit_sub = db.get(DiscountRule, subscription.discount_id) if subscription.discount_id else None
    if after_line_discounts > 0:
        total_qty = sum(p.quantity for p in priced)
        candidates = [
            r for r in ([explicit_sub] if explicit_sub else subscription_rules)
            if total_qty >= (r.min_qty or 0)  # min_qty applies to the whole order
        ]
        best_amount, best_rule = ZERO, None
        for r in candidates:
            payload = discount_payload(r)
            payload["min_qty"] = 0
            result = calculate_line_item(base_price=after_line_discounts, quantity=1, discount=payload, today_str=on_date)
            if result["discount_applied"] and result["discount_amount"] > best_amount:
                best_amount, best_rule = result["discount_amount"], r
        if best_rule is not None:
            subscription_discount = money(best_amount)
            applied.add(best_rule.id)

    remaining = subscription_discount
    for index, p in enumerate(priced):
        base = p.gross_amount - p.line_discount
        if index == len(priced) - 1:
            share = remaining
        elif after_line_discounts > 0:
            share = money(subscription_discount * base / after_line_discounts)
        else:
            share = ZERO
        share = min(share, base)
        remaining -= share
        p.subscription_discount_share = money(share)
        taxable = money(base - share)
        p.tax_amount = money(taxable * p.tax_percent / Decimal("100"))
        p.line_total = money(taxable + p.tax_amount)

    total_tax = money(sum((p.tax_amount for p in priced), ZERO))
    grand_total = money(sum((p.line_total for p in priced), ZERO))
    return PricedSubscription(
        lines=priced,
        subtotal=subtotal,
        line_discount_total=line_discount_total,
        subscription_discount=subscription_discount,
        total_tax=total_tax,
        grand_total=grand_total,
        applied_rule_ids=applied,
    )
