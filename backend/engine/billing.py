"""Invoice construction and billing calculations."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..core.models import (
    DiscountRule,
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionStatus,
    TaxRule,
)
from .pricing import discount_amount, money, tax_amount


def build_invoice(db: Session, subscription: Subscription) -> Invoice:
    if subscription.status not in {SubscriptionStatus.CONFIRMED, SubscriptionStatus.ACTIVE}:
        raise HTTPException(status_code=409, detail="Only confirmed or active subscriptions can be invoiced")
    billing_date = subscription.next_billing_date or subscription.start_date
    period_key = billing_date.strftime("%Y-%m")
    if db.query(Invoice).filter(
        Invoice.subscription_id == subscription.id,
        Invoice.billing_period_key == period_key,
    ).first():
        raise HTTPException(status_code=409, detail="Invoice already exists for this billing period")

    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")
    line_data = []
    applied_discount_ids = set()

    subscription_discount = db.get(DiscountRule, subscription.discount_id) if subscription.discount_id else None
    if subscription.discount_id and not subscription_discount:
        raise HTTPException(status_code=404, detail="Subscription discount not found")
    if subscription_discount and subscription_discount.scope.value != "SUBSCRIPTION":
        raise HTTPException(status_code=400, detail="Subscription discount must use SUBSCRIPTION scope")

    for line in subscription.lines:
        product = db.get(Product, line.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {line.product_id} not found")
        variant = db.get(ProductVariant, line.variant_id) if line.variant_id else None
        tax_rule = db.get(TaxRule, line.tax_id) if line.tax_id else None
        line_discount_rule = db.get(DiscountRule, line.discount_id) if line.discount_id else None
        if line.variant_id and not variant:
            raise HTTPException(status_code=404, detail=f"Variant {line.variant_id} not found")
        if line.tax_id and not tax_rule:
            raise HTTPException(status_code=404, detail=f"Tax rule {line.tax_id} not found")
        if line.discount_id and not line_discount_rule:
            raise HTTPException(status_code=404, detail=f"Discount rule {line.discount_id} not found")
        if line_discount_rule and line_discount_rule.scope.value != "PRODUCT":
            raise HTTPException(status_code=400, detail="Line discount must use PRODUCT scope")

        line_base = money(line.unit_price * line.quantity)
        line_discount = discount_amount(line_base, line.quantity, line_discount_rule, date.today())
        taxable = money(line_base - line_discount)
        line_tax = tax_amount(taxable, tax_rule)
        line_total = money(taxable + line_tax)
        subtotal += line_base
        total_discount += line_discount
        total_tax += line_tax
        if line_discount and line_discount_rule:
            applied_discount_ids.add(line_discount_rule.id)
        line_data.append((line, product, variant, line_discount, line_tax, line_total, tax_rule))

    subscription_discount_value = discount_amount(
        subtotal - total_discount,
        sum(line.quantity for line in subscription.lines),
        subscription_discount,
        date.today(),
    )
    total_discount += subscription_discount_value
    for discount_id in applied_discount_ids:
        db.get(DiscountRule, discount_id).current_uses += 1
    if subscription_discount_value and subscription_discount:
        subscription_discount.current_uses += 1

    invoice = Invoice(
        invoice_number=f"INV-{date.today():%Y%m%d}-{uuid4().hex[:6].upper()}",
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        billing_period_key=period_key,
        status=InvoiceStatus.CONFIRMED,
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=subscription.payment_terms_days),
        subtotal=money(subtotal),
        total_discount=money(total_discount),
        total_tax=money(total_tax),
        grand_total=money(subtotal - total_discount + total_tax),
        amount_paid=Decimal("0.00"),
    )
    for line, product, variant, line_discount, line_tax, line_total, tax_rule in line_data:
        invoice.lines.append(InvoiceLine(
            product_name_snapshot=product.name,
            variant_name_snapshot=(f"{variant.attribute_name}: {variant.attribute_value}" if variant else None),
            quantity=line.quantity,
            unit_price_snapshot=line.unit_price,
            discount_amount=line_discount,
            tax_percent_snapshot=(tax_rule.rate_percent if tax_rule else Decimal("0.00")),
            tax_amount=line_tax,
            line_total=line_total,
        ))
    return invoice
