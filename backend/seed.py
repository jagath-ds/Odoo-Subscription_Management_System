"""Create repeatable demo data (safe to run more than once).

Run from the repository root (inside the venv):
    python -m backend.seed

Mirrors the Team Blueprint example: Brightloop Cloud ERP with an Odoo brand
variant (+560), a WhatsApp add-on, GST 18%, a 10% bulk-seat discount, monthly
and annual plans, and an enterprise quotation template.
"""

import os
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from .core.auth import hash_password
from .core.database import Base, SessionLocal, engine
from .core.models import (
    BillingFrequency,
    DiscountRule,
    DiscountScope,
    DiscountType,
    Plan,
    Product,
    ProductType,
    ProductVariant,
    QuotationTemplate,
    QuotationTemplateLine,
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
        get_or_create(db, User, {"email": CUSTOMER_EMAIL}, full_name="Acme Retail Pvt Ltd", role=UserRole.CUSTOMER, password_hash=password)

        get_or_create(db, TaxRule, {"name": "GST 18%"}, rate_percent=Decimal("18.00"), is_active=True)

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

        get_or_create(
            db, Plan, {"name": "Monthly Starter"},
            billing_frequency=BillingFrequency.MONTHLY, plan_price=Decimal("2000.00"), min_qty=1,
            auto_close=False, can_close_early=True, can_pause=True, can_renew=True,
        )
        annual = get_or_create(
            db, Plan, {"name": "Annual Enterprise"},
            billing_frequency=BillingFrequency.YEARLY, plan_price=Decimal("24000.00"), min_qty=5,
            auto_close=True, can_close_early=False, can_pause=True, can_renew=True,
        )

        get_or_create(
            db, DiscountRule, {"name": "Bulk Seats 10%"},
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


if __name__ == "__main__":
    seed()
