"""Brightloop Subscription & Recurring Billing ERP - Pricing Engine.

Module: backend/engine/pricing.py
Owner: Member 2 (Features & Business Logic Engine)

Pure business-logic pricing engine implementing:
- Base and variant pricing calculations
- Quantity-based gross calculations
- Percentage and fixed discount rules with date window, minimum quantity,
  minimum purchase, and usage limit validation
- Automatic GST/tax calculation on taxable line amounts
- Precise financial math using Python decimal.Decimal (ROUND_HALF_UP)
"""

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Any, Dict, Optional, Union

# Two decimal places rounding specifier
CENT = Decimal("0.01")


def _to_decimal(value: Any, field_name: str = "value") -> Decimal:
    """Safely convert any numeric or string input to Decimal.

    Floats are converted via str to prevent IEEE-754 precision drift.
    """
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    try:
        if isinstance(value, float):
            return Decimal(str(value))
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"Invalid decimal value for {field_name}: {value}") from exc


def _quantize_currency(amount: Decimal) -> Decimal:
    """Round a Decimal amount to two decimal places using standard financial rounding."""
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def _parse_date(date_val: Union[str, date, datetime, None]) -> Optional[date]:
    """Parse date from string (YYYY-MM-DD), date, or datetime object."""
    if date_val is None:
        return None
    if isinstance(date_val, datetime):
        return date_val.date()
    if isinstance(date_val, date):
        return date_val
    if isinstance(date_val, str):
        clean_str = date_val.strip()
        if not clean_str:
            return None
        try:
            return datetime.strptime(clean_str, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"Invalid date format '{date_val}'. Expected YYYY-MM-DD.") from exc
    raise ValueError(f"Unsupported date type: {type(date_val)}")


def calculate_line_item(
    base_price: Union[Decimal, int, float, str],
    variant_extra: Union[Decimal, int, float, str] = 0,
    quantity: int = 1,
    tax_percent: Union[Decimal, int, float, str] = 0,
    discount: Optional[Dict[str, Any]] = None,
    today_str: Optional[Union[str, date, datetime]] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Calculate pricing, discounts, taxes, and final totals for a line item.

    All math is performed using exact Python `decimal.Decimal` arithmetic
    with `ROUND_HALF_UP` to two decimal places.

    Args:
        base_price: Base catalog price of the product (must be >= 0).
        variant_extra: Extra delta added by product variant (must be >= 0). Default: 0.
        quantity: Units purchased (must be integer >= 1). Default: 1.
        tax_percent: GST or sales tax percentage (e.g. 18.00). Must be >= 0. Default: 0.
        discount: Optional dictionary containing discount rule fields:
            - discount_type / type: 'PERCENT' (or 'PERCENTAGE') or 'FIXED'
            - value: Percentage rate or fixed deduction amount
            - min_qty: Minimum quantity required to qualify
            - min_purchase: Minimum gross amount required to qualify
            - uses_left: Remaining uses count (> 0 required)
            - max_uses / current_uses: Alternative usage tracker (current_uses < max_uses)
            - valid_from: Start date string (YYYY-MM-DD)
            - valid_until: End date string (YYYY-MM-DD)
        today_str: Reference evaluation date (YYYY-MM-DD). Defaults to current system date.
        **kwargs: Allows passing flat discount parameters directly (e.g. discount_type,
            discount_value, min_qty, min_purchase, uses_left, valid_from, valid_until).

    Returns:
        Dict[str, Any] with exact keys:
            - unit_price: Effective unit price (base_price + variant_extra)
            - gross_amount: unit_price * quantity
            - discount_amount: Total discount deducted
            - discount_applied: Boolean indicating if discount was eligible & applied
            - taxable_amount: gross_amount - discount_amount
            - tax_amount: taxable_amount * (tax_percent / 100)
            - line_total: taxable_amount + tax_amount

    Raises:
        ValueError: On negative prices, invalid quantities, negative taxes,
            or percentage discounts greater than 100%.
    """
    # 1. Validate and convert base inputs
    dec_base_price = _to_decimal(base_price, "base_price")
    if dec_base_price < Decimal("0.00"):
        raise ValueError("Base price cannot be negative.")

    dec_variant_extra = _to_decimal(variant_extra, "variant_extra")
    if dec_variant_extra < Decimal("0.00"):
        raise ValueError("Variant extra price cannot be negative.")

    try:
        qty_int = int(quantity)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Quantity must be a valid integer, got {quantity}") from exc

    if qty_int <= 0:
        raise ValueError("Quantity must be greater than zero.")

    dec_tax_percent = _to_decimal(tax_percent, "tax_percent")
    if dec_tax_percent < Decimal("0.00"):
        raise ValueError("Tax percentage cannot be negative.")

    # 2. Reference date
    eval_date = _parse_date(today_str) if today_str is not None else date.today()

    # 3. Unit price & Gross calculation
    unit_price = _quantize_currency(dec_base_price + dec_variant_extra)
    gross_amount = _quantize_currency(unit_price * Decimal(qty_int))

    # 4. Extract and resolve discount configuration
    disc_data: Dict[str, Any] = {}
    if discount and isinstance(discount, dict):
        disc_data.update(discount)
    # Merge any flat kwargs passed
    for key, val in kwargs.items():
        if val is not None:
            disc_data[key] = val

    discount_amount = Decimal("0.00")
    discount_applied = False

    if disc_data:
        raw_disc_type = disc_data.get("discount_type") or disc_data.get("type")
        disc_val_raw = disc_data.get("value") or disc_data.get("discount_value")

        if raw_disc_type is not None and disc_val_raw is not None:
            disc_type = str(raw_disc_type).strip().upper()
            disc_value = _to_decimal(disc_val_raw, "discount_value")

            if disc_value < Decimal("0.00"):
                raise ValueError("Discount value cannot be negative.")

            if disc_type in ("PERCENT", "PERCENTAGE") and disc_value > Decimal("100.00"):
                raise ValueError("Percentage discounts must not exceed 100%.")

            # Check eligibility rules
            eligible = True

            # Rule A: Minimum quantity validation
            min_qty = disc_data.get("min_qty")
            if min_qty is not None:
                if qty_int < int(min_qty):
                    eligible = False

            # Rule B: Minimum purchase validation
            min_purchase = disc_data.get("min_purchase")
            if min_purchase is not None:
                dec_min_purchase = _to_decimal(min_purchase, "min_purchase")
                if gross_amount < dec_min_purchase:
                    eligible = False

            # Rule C: Date validity window checking
            valid_from = _parse_date(disc_data.get("valid_from"))
            valid_until = _parse_date(disc_data.get("valid_until"))

            if valid_from is not None and eval_date < valid_from:
                eligible = False

            if valid_until is not None and eval_date > valid_until:
                eligible = False

            # Rule D: Usage limit checking
            uses_left = disc_data.get("uses_left")
            max_uses = disc_data.get("max_uses")
            current_uses = disc_data.get("current_uses")

            if uses_left is not None:
                if int(uses_left) <= 0:
                    eligible = False
            elif max_uses is not None and current_uses is not None:
                if int(current_uses) >= int(max_uses):
                    eligible = False

            # Compute discount if all criteria met
            if eligible and disc_value > Decimal("0.00"):
                if disc_type in ("PERCENT", "PERCENTAGE"):
                    calc_disc = gross_amount * (disc_value / Decimal("100.00"))
                    discount_amount = _quantize_currency(calc_disc)
                elif disc_type == "FIXED":
                    discount_amount = _quantize_currency(disc_value)
                else:
                    raise ValueError(f"Unsupported discount type: '{disc_type}'. Use PERCENT or FIXED.")

                # Business Rule: Discounts must not reduce taxable amount below zero
                if discount_amount > gross_amount:
                    discount_amount = gross_amount

                if discount_amount > Decimal("0.00"):
                    discount_applied = True

    # 5. Taxable amount calculation
    taxable_amount = _quantize_currency(gross_amount - discount_amount)
    if taxable_amount < Decimal("0.00"):
        taxable_amount = Decimal("0.00")

    # 6. GST / Tax calculation
    tax_rate_multiplier = dec_tax_percent / Decimal("100.00")
    tax_amount = _quantize_currency(taxable_amount * tax_rate_multiplier)

    # 7. Final line total
    line_total = _quantize_currency(taxable_amount + tax_amount)

    return {
        "unit_price": unit_price,
        "gross_amount": gross_amount,
        "discount_amount": discount_amount,
        "discount_applied": discount_applied,
        "taxable_amount": taxable_amount,
        "tax_amount": tax_amount,
        "line_total": line_total,
    }
