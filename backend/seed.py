"""Create repeatable demo data for local development.

Run from the repository root with:
    python -m backend.seed
"""

import os
from decimal import Decimal

from sqlalchemy.orm import Session

from .core.auth import hash_password
from .core.database import Base, SessionLocal, engine
from .core.models import BillingFrequency, Plan, Product, ProductType, TaxRule, User, UserRole


ADMIN_EMAIL = os.getenv("DEMO_ADMIN_EMAIL", "admin@brightloop.local")
CUSTOMER_EMAIL = os.getenv("DEMO_CUSTOMER_EMAIL", "customer@brightloop.local")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Brightloop@123")


def get_or_create_user(db: Session, email: str, name: str, role: UserRole) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(
        email=email,
        full_name=name,
        role=role,
        password_hash=hash_password(DEMO_PASSWORD),
    )
    db.add(user)
    db.flush()
    return user


def get_or_create_product(
    db: Session,
    name: str,
    product_type: ProductType,
    sales_price: Decimal,
    cost_price: Decimal,
) -> Product:
    product = db.query(Product).filter(Product.name == name).first()
    if product:
        return product
    product = Product(
        name=name,
        product_type=product_type,
        sales_price=sales_price,
        cost_price=cost_price,
        is_active=True,
    )
    db.add(product)
    db.flush()
    return product


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        get_or_create_user(db, ADMIN_EMAIL, "BrightLoop Admin", UserRole.ADMIN)
        get_or_create_user(db, CUSTOMER_EMAIL, "Demo Customer", UserRole.CUSTOMER)

        get_or_create_product(
            db,
            "Starter Support",
            ProductType.SERVICE,
            Decimal("999.00"),
            Decimal("300.00"),
        )
        get_or_create_product(
            db,
            "Priority Support Add-on",
            ProductType.ADDON,
            Decimal("299.00"),
            Decimal("75.00"),
        )

        if not db.query(Plan).filter(Plan.name == "Monthly Starter").first():
            db.add(
                Plan(
                    name="Monthly Starter",
                    billing_frequency=BillingFrequency.MONTHLY,
                    plan_price=Decimal("999.00"),
                    min_qty=1,
                    can_pause=True,
                    can_renew=True,
                )
            )

        if not db.query(TaxRule).filter(TaxRule.name == "GST 18%").first():
            db.add(TaxRule(name="GST 18%", rate_percent=Decimal("18.00"), is_active=True))

        db.commit()
        print("Demo data is ready.")
        print(f"Admin:    {ADMIN_EMAIL}")
        print(f"Customer: {CUSTOMER_EMAIL}")
        print(f"Password: {DEMO_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
