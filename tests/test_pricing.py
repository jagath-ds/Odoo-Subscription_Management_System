"""Unit tests for the Brightloop Pricing Engine.

Module: tests/test_pricing.py
Owner: Member 2 (Features & Business Logic Engine)
"""

from decimal import Decimal
import pytest
from backend.engine.pricing import calculate_line_item


class TestPricingEngine:
    """Test suite for calculate_line_item."""

    def test_example_scenario_from_blueprint(self):
        """Verify the exact end-to-end example from the hackathon blueprint:
        Base = ₹2,000, Variant extra = ₹560, Qty = 2, Discount = 10%, GST = 18%.
        Expected:
            Unit price = ₹2,560.00
            Gross amount = ₹5,120.00
            Discount = ₹512.00
            Taxable amount = ₹4,608.00
            GST = ₹829.44
            Final line total = ₹5,437.44
        """
        result = calculate_line_item(
            base_price=2000,
            variant_extra=560,
            quantity=2,
            tax_percent=18,
            discount={"type": "PERCENT", "value": 10},
            today_str="2026-10-31",
        )

        assert result["unit_price"] == Decimal("2560.00")
        assert result["gross_amount"] == Decimal("5120.00")
        assert result["discount_amount"] == Decimal("512.00")
        assert result["discount_applied"] is True
        assert result["taxable_amount"] == Decimal("4608.00")
        assert result["tax_amount"] == Decimal("829.44")
        assert result["line_total"] == Decimal("5437.44")

    def test_normal_product_price_without_variant_or_discount(self):
        """Simple service product with no variant, zero discount, zero tax."""
        result = calculate_line_item(
            base_price="1500.00",
            variant_extra="0.00",
            quantity=1,
            tax_percent="0.00",
        )

        assert result["unit_price"] == Decimal("1500.00")
        assert result["gross_amount"] == Decimal("1500.00")
        assert result["discount_amount"] == Decimal("0.00")
        assert result["discount_applied"] is False
        assert result["taxable_amount"] == Decimal("1500.00")
        assert result["tax_amount"] == Decimal("0.00")
        assert result["line_total"] == Decimal("1500.00")

    def test_product_variant_extra_pricing(self):
        """Variant extra correctly increases effective unit price."""
        result = calculate_line_item(
            base_price=1000,
            variant_extra=350,
            quantity=3,
            tax_percent=0,
        )

        assert result["unit_price"] == Decimal("1350.00")
        assert result["gross_amount"] == Decimal("4050.00")
        assert result["taxable_amount"] == Decimal("4050.00")
        assert result["line_total"] == Decimal("4050.00")

    def test_fixed_discount_application(self):
        """Fixed amount discount should be subtracted directly from gross."""
        result = calculate_line_item(
            base_price=500,
            variant_extra=0,
            quantity=4,
            tax_percent=18,
            discount={"type": "FIXED", "value": 200},
        )

        # Gross = 2000, Discount = 200, Taxable = 1800, GST = 324.00, Total = 2124.00
        assert result["gross_amount"] == Decimal("2000.00")
        assert result["discount_amount"] == Decimal("200.00")
        assert result["discount_applied"] is True
        assert result["taxable_amount"] == Decimal("1800.00")
        assert result["tax_amount"] == Decimal("324.00")
        assert result["line_total"] == Decimal("2124.00")

    def test_gst_calculation_precision(self):
        """Verify fractional GST rounding with half-up rule."""
        result = calculate_line_item(
            base_price="100.05",
            quantity=1,
            tax_percent="18.00",
        )
        # Gross = 100.05, Tax = 100.05 * 0.18 = 18.009 -> 18.01
        assert result["tax_amount"] == Decimal("18.01")
        assert result["line_total"] == Decimal("118.06")

    def test_expired_discount_not_applied(self):
        """Discounts past their valid_until date must not apply."""
        result = calculate_line_item(
            base_price=1000,
            quantity=1,
            tax_percent=18,
            discount={
                "type": "PERCENT",
                "value": 20,
                "valid_until": "2026-10-01",
            },
            today_str="2026-10-31",
        )

        assert result["discount_amount"] == Decimal("0.00")
        assert result["discount_applied"] is False
        assert result["taxable_amount"] == Decimal("1000.00")

    def test_discount_not_yet_valid_not_applied(self):
        """Discounts before their valid_from date must not apply."""
        result = calculate_line_item(
            base_price=1000,
            quantity=1,
            tax_percent=18,
            discount={
                "type": "PERCENT",
                "value": 20,
                "valid_from": "2026-11-15",
            },
            today_str="2026-10-31",
        )

        assert result["discount_amount"] == Decimal("0.00")
        assert result["discount_applied"] is False

    def test_exhausted_discount_usage(self):
        """Discounts with uses_left = 0 must not apply."""
        result = calculate_line_item(
            base_price=1000,
            quantity=1,
            tax_percent=18,
            discount={
                "type": "PERCENT",
                "value": 15,
                "uses_left": 0,
            },
        )

        assert result["discount_amount"] == Decimal("0.00")
        assert result["discount_applied"] is False

    def test_exhausted_discount_by_max_and_current_uses(self):
        """Discount where current_uses >= max_uses must not apply."""
        result = calculate_line_item(
            base_price=1000,
            quantity=1,
            discount={
                "type": "PERCENT",
                "value": 15,
                "max_uses": 50,
                "current_uses": 50,
            },
        )

        assert result["discount_amount"] == Decimal("0.00")
        assert result["discount_applied"] is False

    def test_minimum_quantity_requirement(self):
        """Discount requires min_qty; if not met, discount is omitted."""
        # Requires 5, but buying 4
        result = calculate_line_item(
            base_price=200,
            quantity=4,
            discount={"type": "PERCENT", "value": 10, "min_qty": 5},
        )
        assert result["discount_applied"] is False
        assert result["discount_amount"] == Decimal("0.00")

        # Now buying 5 -> should qualify
        result_ok = calculate_line_item(
            base_price=200,
            quantity=5,
            discount={"type": "PERCENT", "value": 10, "min_qty": 5},
        )
        assert result_ok["discount_applied"] is True
        assert result_ok["discount_amount"] == Decimal("100.00")

    def test_minimum_purchase_requirement(self):
        """Discount requires min_purchase gross amount."""
        # Gross = 1800, required = 2000
        result = calculate_line_item(
            base_price=600,
            quantity=3,
            discount={"type": "FIXED", "value": 300, "min_purchase": 2000},
        )
        assert result["discount_applied"] is False

        # Gross = 2400, required = 2000
        result_ok = calculate_line_item(
            base_price=600,
            quantity=4,
            discount={"type": "FIXED", "value": 300, "min_purchase": 2000},
        )
        assert result_ok["discount_applied"] is True
        assert result_ok["discount_amount"] == Decimal("300.00")

    def test_discount_cannot_reduce_taxable_below_zero(self):
        """Fixed discount larger than gross must cap discount at gross amount."""
        result = calculate_line_item(
            base_price=100,
            quantity=1,
            tax_percent=18,
            discount={"type": "FIXED", "value": 500},
        )

        assert result["gross_amount"] == Decimal("100.00")
        assert result["discount_amount"] == Decimal("100.00")
        assert result["taxable_amount"] == Decimal("0.00")
        assert result["tax_amount"] == Decimal("0.00")
        assert result["line_total"] == Decimal("0.00")

    def test_percentage_discount_cannot_exceed_100_percent(self):
        """Percentage discounts > 100% must raise a ValueError."""
        with pytest.raises(ValueError, match="Percentage discounts must not exceed 100%"):
            calculate_line_item(
                base_price=100,
                quantity=1,
                discount={"type": "PERCENT", "value": 105},
            )

    def test_invalid_quantity_handling(self):
        """Quantity <= 0 must raise ValueError."""
        with pytest.raises(ValueError, match="Quantity must be greater than zero"):
            calculate_line_item(base_price=100, quantity=0)

        with pytest.raises(ValueError, match="Quantity must be greater than zero"):
            calculate_line_item(base_price=100, quantity=-2)

    def test_negative_price_and_tax_handling(self):
        """Negative base price, variant extra, or tax must raise ValueError."""
        with pytest.raises(ValueError, match="Base price cannot be negative"):
            calculate_line_item(base_price=-10, quantity=1)

        with pytest.raises(ValueError, match="Variant extra price cannot be negative"):
            calculate_line_item(base_price=100, variant_extra=-5, quantity=1)

        with pytest.raises(ValueError, match="Tax percentage cannot be negative"):
            calculate_line_item(base_price=100, quantity=1, tax_percent=-5)
