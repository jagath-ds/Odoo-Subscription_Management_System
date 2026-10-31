"""Create repeatable demo data (safe to run more than once).

Run from the repository root (inside the venv):
    python -m backend.seed

Mirrors the Team Blueprint example: Brightloop Cloud ERP with an Odoo brand
variant (+560), a WhatsApp add-on, GST 18%, a 10% bulk-seat discount, monthly
and annual plans, and an enterprise quotation template.
"""

import os
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .core.auth import hash_password
from .core.database import Base, SessionLocal, engine
from .core.models import (
    BillingFrequency,
    DiscountRule,
    DiscountScope,
    DiscountType,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    Plan,
    Product,
    ProductType,
    ProductVariant,
    QuotationTemplate,
    QuotationTemplateLine,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)

ADMIN_EMAIL = os.getenv("DEMO_ADMIN_EMAIL", "admin@brightloop.local")
STAFF_EMAIL = os.getenv("DEMO_STAFF_EMAIL", "staff@brightloop.local")
CUSTOMER_EMAIL = os.getenv("DEMO_CUSTOMER_EMAIL", "customer@brightloop.local")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Brightloop@123")


def get_or_create(db: Session, model, lookup: dict, **values):
    obj = db.query(model).filter_by(**lookup).first()
    if obj:
        return obj
    obj = model(**lookup, **values)
    db.add(obj)
    db.flush()
    return obj


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        password = hash_password(DEMO_PASSWORD)
        get_or_create(db, User, {"email": ADMIN_EMAIL}, full_name="Brightloop Admin", role=UserRole.ADMIN, password_hash=password)
        get_or_create(db, User, {"email": STAFF_EMAIL}, full_name="Sam Sales (Staff)", role=UserRole.STAFF, password_hash=password)
        acme = get_or_create(db, User, {"email": CUSTOMER_EMAIL}, full_name="Acme Retail Pvt Ltd", role=UserRole.CUSTOMER, password_hash=password)
        nova = get_or_create(db, User, {"email": "billing@novatraders.example"}, full_name="Nova Traders", role=UserRole.CUSTOMER, password_hash=password)

        gst = get_or_create(db, TaxRule, {"name": "GST 18%"}, rate_percent=Decimal("18.00"), is_active=True)

        erp = get_or_create(
            db, Product, {"name": "Brightloop Cloud ERP"},
            product_type=ProductType.SERVICE, sales_price=Decimal("2000.00"), cost_price=Decimal("500.00"),
            notes="Core ERP seat licence", is_active=True,
        )
        odoo = get_or_create(db, ProductVariant, {"product_id": erp.id, "attribute_name": "Brand", "attribute_value": "Odoo"}, price_extra=Decimal("560.00"))
        get_or_create(db, ProductVariant, {"product_id": erp.id, "attribute_name": "Brand", "attribute_value": "Standard"}, price_extra=Decimal("0.00"))
        whatsapp = get_or_create(
            db, Product, {"name": "WhatsApp Automated Alerts"},
            product_type=ProductType.ADDON, sales_price=Decimal("300.00"), cost_price=Decimal("60.00"),
            notes="Add-on customers can switch on/off from the portal", is_active=True,
        )

        monthly = get_or_create(
            db, Plan, {"name": "Monthly Starter Plan"},
            billing_frequency=BillingFrequency.MONTHLY, plan_price=Decimal("2000.00"), min_qty=1,
            auto_close=False, can_close_early=True, can_pause=True, can_renew=True,
        )
        annual = get_or_create(
            db, Plan, {"name": "Annual Enterprise Plan"},
            billing_frequency=BillingFrequency.YEARLY, plan_price=Decimal("24000.00"), min_qty=5,
            auto_close=True, can_close_early=False, can_pause=True, can_renew=True,
        )

        get_or_create(
            db, DiscountRule, {"name": "10% Off for >=10 seats"},
            discount_type=DiscountType.PERCENT, value=Decimal("10.00"), scope=DiscountScope.PRODUCT,
            min_qty=10, min_purchase=Decimal("0.00"), valid_from=date(date.today().year, 1, 1),
            valid_until=date(date.today().year, 12, 31), max_uses=50, current_uses=0,
        )

        if not db.query(QuotationTemplate).filter_by(name="Enterprise Annual Offer").first():
            template = QuotationTemplate(name="Enterprise Annual Offer", plan_id=annual.id, validity_days=30)
            template.lines = [
                QuotationTemplateLine(product_id=erp.id, variant_id=odoo.id, quantity=10),
                QuotationTemplateLine(product_id=whatsapp.id, quantity=1),
            ]
            db.add(template)

        db.flush()
        seed_sample_activity(db, acme, nova, annual, monthly, erp, odoo, whatsapp, gst)

        db.commit()
        print("Demo data is ready.")
        print(f"  Admin:    {ADMIN_EMAIL}")
        print(f"  Staff:    {STAFF_EMAIL}")
        print(f"  Customer: {CUSTOMER_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _subscription(db, number, customer, plan, status, start, lines, gst, paused_at=None):
    sub = Subscription(
        sub_number=number, customer_id=customer.id, plan_id=plan.id, status=status,
        start_date=start, next_billing_date=start, expiry_date=start + timedelta(days=365),
        paused_at=paused_at, payment_terms_days=15, quotation_valid_until=date.today() + timedelta(days=30),
    )
    sub.lines = [
        SubscriptionLine(product_id=p.id, variant_id=v.id if v else None, tax_id=gst.id, quantity=q,
                         unit_price=p.sales_price + (v.price_extra if v else Decimal("0")))
        for p, v, q in lines
    ]
    db.add(sub)
    db.flush()
    return sub


def seed_sample_activity(db, acme, nova, annual, monthly, erp, odoo, whatsapp, gst) -> None:
    """Sample subscriptions and invoices in every status (created once)."""
    from .services.invoicing import build_invoice

    if db.query(Subscription).filter(Subscription.sub_number.like("SUB-DEMO-%")).first():
        return
    today = date.today()

    # Active monthly subscription with a full invoice history.
    active = _subscription(db, "SUB-DEMO-0001", acme, monthly, SubscriptionStatus.ACTIVE, today - timedelta(days=95),
                           [(erp, odoo, 3), (whatsapp, None, 1)], gst)
    history = [
        (today - timedelta(days=95), InvoiceStatus.PAID, "full"),
        (today - timedelta(days=65), InvoiceStatus.PARTIALLY_PAID, "half"),
        (today - timedelta(days=35), InvoiceStatus.CONFIRMED, None),   # overdue (due 15 days after issue)
        (today - timedelta(days=5), InvoiceStatus.CONFIRMED, None),    # open, not yet due
    ]
    for issued, status, paid in history:
        inv = build_invoice(db, active, f"{active.sub_number}:{issued.isoformat()}", issued, status=status)
        db.flush()
        if paid:
            amount = inv.grand_total if paid == "full" else (inv.grand_total / 2).quantize(Decimal("0.01"))
            inv.amount_paid = amount
            db.add(Payment(invoice_id=inv.id, payment_method=PaymentMethod.UPI, amount=amount,
                           payment_date=issued + timedelta(days=3), note="Seeded payment"))
    active.next_billing_date = today + timedelta(days=25)

    # Draft invoice on a second active (enterprise, discounted) subscription.
    enterprise = _subscription(db, "SUB-DEMO-0002", nova, annual, SubscriptionStatus.ACTIVE, today - timedelta(days=1),
                               [(erp, odoo, 10), (whatsapp, None, 1)], gst)
    build_invoice(db, enterprise, f"{enterprise.sub_number}:{enterprise.start_date.isoformat()}", today, status=InvoiceStatus.DRAFT)
    enterprise.next_billing_date = enterprise.start_date.replace(year=enterprise.start_date.year + 1)

    # Paused and quotation-stage subscriptions for the lifecycle demo.
    _subscription(db, "SUB-DEMO-0003", acme, annual, SubscriptionStatus.PAUSED, today - timedelta(days=40),
                  [(erp, None, 5)], gst, paused_at=today - timedelta(days=7))
    _subscription(db, "SUB-DEMO-0004", nova, monthly, SubscriptionStatus.QUOTATION, today, [(erp, odoo, 2)], gst)
    db.flush()


if __name__ == "__main__":
    seed()
