"""Subscription creation, access, and lifecycle endpoints."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, require_role
from ..core.database import get_db
from ..core.models import (
    DiscountRule,
    Plan,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)
from ..core.schemas import InvoiceResponse, SubscriptionAction, SubscriptionCreate, SubscriptionResponse
from ..engine.billing import build_invoice
from ..engine.state_machine import apply_subscription_action, next_billing_date


router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])
staff_or_admin = require_role(UserRole.ADMIN, UserRole.STAFF)


def _can_access_customer(current_user: User, customer_id: int) -> bool:
    return current_user.role != UserRole.CUSTOMER or current_user.id == customer_id


def _load_subscription_or_404(db: Session, subscription_id: int) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access_customer(current_user, payload.customer_id):
        raise HTTPException(status_code=403, detail="Customers can only create their own subscriptions")
    customer = db.get(User, payload.customer_id)
    plan = db.get(Plan, payload.plan_id)
    if not customer or customer.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="Customer not found")
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.available_from and payload.start_date < plan.available_from:
        raise HTTPException(status_code=400, detail="Subscription starts before the plan is available")
    if plan.available_until and payload.start_date > plan.available_until:
        raise HTTPException(status_code=400, detail="Subscription starts after the plan availability window")
    if payload.expiry_date and payload.expiry_date < payload.start_date:
        raise HTTPException(status_code=400, detail="expiry_date must be on or after start_date")
    if payload.discount_id:
        discount = db.get(DiscountRule, payload.discount_id)
        if not discount or discount.scope.value != "SUBSCRIPTION":
            raise HTTPException(status_code=400, detail="Invalid subscription discount")

    product_ids = {line.product_id for line in payload.lines}
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()}
    if len(products) != len(product_ids) or any(not p.is_active for p in products.values()):
        raise HTTPException(status_code=400, detail="Every subscription line must use an active product")

    variant_ids = {line.variant_id for line in payload.lines if line.variant_id is not None}
    variants = {v.id: v for v in db.query(ProductVariant).filter(ProductVariant.id.in_(variant_ids)).all()}
    if len(variants) != len(variant_ids):
        raise HTTPException(status_code=400, detail="One or more product variants were not found")
    if any(variants[line.variant_id].product_id != line.product_id for line in payload.lines if line.variant_id):
        raise HTTPException(status_code=400, detail="A variant must belong to its selected product")

    for line in payload.lines:
        if line.tax_id and not db.get(TaxRule, line.tax_id):
            raise HTTPException(status_code=404, detail=f"Tax rule {line.tax_id} not found")
        if line.discount_id:
            discount = db.get(DiscountRule, line.discount_id)
            if not discount or discount.scope.value != "PRODUCT":
                raise HTTPException(status_code=400, detail="Invalid product discount")

    subscription = Subscription(
        sub_number=f"SUB-{date.today():%Y%m%d}-{uuid4().hex[:6].upper()}",
        customer_id=payload.customer_id,
        plan_id=payload.plan_id,
        discount_id=payload.discount_id,
        status=SubscriptionStatus.DRAFT,
        start_date=payload.start_date,
        next_billing_date=next_billing_date(payload.start_date, plan.billing_frequency.value),
        expiry_date=payload.expiry_date,
        payment_terms_days=payload.payment_terms_days,
    )
    for line in payload.lines:
        variant_extra = variants[line.variant_id].price_extra if line.variant_id else Decimal("0.00")
        subscription.lines.append(SubscriptionLine(
            product_id=line.product_id,
            variant_id=line.variant_id,
            tax_id=line.tax_id,
            discount_id=line.discount_id,
            quantity=line.quantity,
            unit_price=products[line.product_id].sales_price + variant_extra,
        ))
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Subscription)
    if current_user.role == UserRole.CUSTOMER:
        query = query.filter(Subscription.customer_id == current_user.id)
    return query.order_by(Subscription.id.desc()).all()


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subscription = _load_subscription_or_404(db, subscription_id)
    if not _can_access_customer(current_user, subscription.customer_id):
        raise HTTPException(status_code=403, detail="Not allowed to access this subscription")
    return subscription


@router.post("/{subscription_id}/actions", response_model=SubscriptionResponse)
def change_subscription_status(
    subscription_id: int,
    payload: SubscriptionAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subscription = _load_subscription_or_404(db, subscription_id)
    if current_user.role == UserRole.CUSTOMER:
        if subscription.customer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to change this subscription")
        if payload.action not in {"pause", "resume", "close"}:
            raise HTTPException(status_code=403, detail="Customers may only pause, resume, or close their own subscriptions")
    elif current_user.role not in {UserRole.ADMIN, UserRole.STAFF}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    plan = db.get(Plan, subscription.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    apply_subscription_action(subscription, plan, payload.action, date.today())
    db.commit()
    db.refresh(subscription)
    return subscription


@router.post("/{subscription_id}/invoice", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def generate_invoice(
    subscription_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(staff_or_admin),
):
    subscription = _load_subscription_or_404(db, subscription_id)
    invoice = build_invoice(db, subscription)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
