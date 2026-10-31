"""Quotations & subscriptions (Contract A): creation, lifecycle, add-ons, invoicing."""

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from datetime import timedelta

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..core.auth import get_current_user, staff_or_admin
from ..core.database import get_db
from ..core.models import (
    DiscountRule,
    DiscountScope,
    Plan,
    Product,
    ProductType,
    ProductVariant,
    QuotationTemplate,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)
from ..core.schemas import (
    CreateFromTemplate,
    InvoiceDetail,
    SubscriptionCreate,
    SubscriptionDetail,
    SubscriptionListItem,
    ToggleAddonRequest,
    TransitionRequest,
)
from ..engine import check_subscription_transition
from ..services.invoicing import invoice_now
from ..services.presenters import invoice_detail, subscription_detail, subscription_list

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# Lifecycle moves a CUSTOMER may make on their own subscription via the portal.
CUSTOMER_TRANSITIONS = {
    (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED),
    (SubscriptionStatus.PAUSED, SubscriptionStatus.ACTIVE),
    (SubscriptionStatus.CLOSED, SubscriptionStatus.ACTIVE),
    (SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED),
}


def _load(db: Session, subscription_id: int, user: User) -> Subscription:
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if user.role == UserRole.CUSTOMER and sub.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this subscription")
    return sub


def _default_tax_id(db: Session) -> Optional[int]:
    tax = db.query(TaxRule).filter(TaxRule.is_active.is_(True)).order_by(TaxRule.id).first()
    return tax.id if tax else None


def _default_expiry(plan: Plan, start: date) -> date:
    if plan.available_until and plan.available_until > start:
        return plan.available_until
    return start + relativedelta(years=1)


def _validate_header(db: Session, customer_id: int, plan: Plan, start: date, expiry: Optional[date]) -> None:
    customer = db.get(User, customer_id)
    if not customer or customer.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="Customer not found")
    if plan.available_from and start < plan.available_from:
        raise HTTPException(status_code=400, detail="Subscription starts before the plan is available")
    if plan.available_until and start > plan.available_until:
        raise HTTPException(status_code=400, detail="Subscription starts after the plan availability window")
    if expiry and expiry < start:
        raise HTTPException(status_code=400, detail="expiry_date must be on or after start_date")


def _build_lines(db: Session, plan: Plan, raw_lines: list[dict], enforce_min_qty: bool = True) -> list[SubscriptionLine]:
    default_tax = _default_tax_id(db)
    lines, service_qty, total_qty = [], 0, 0
    for raw in raw_lines:
        product = db.get(Product, raw["product_id"])
        if not product or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {raw['product_id']} is not an active product")
        extra = Decimal("0.00")
        if raw.get("variant_id"):
            variant = db.get(ProductVariant, raw["variant_id"])
            if not variant or variant.product_id != product.id:
                raise HTTPException(status_code=400, detail="A variant must belong to its selected product")
            extra = variant.price_extra or Decimal("0.00")
        tax_id = raw.get("tax_id") or default_tax
        if raw.get("tax_id") and not db.get(TaxRule, raw["tax_id"]):
            raise HTTPException(status_code=404, detail=f"Tax rule {raw['tax_id']} not found")
        if raw.get("discount_id"):
            rule = db.get(DiscountRule, raw["discount_id"])
            if not rule or rule.scope != DiscountScope.PRODUCT:
                raise HTTPException(status_code=400, detail="Line discounts must be PRODUCT-scope rules")
        quantity = int(raw.get("quantity") or 1)
        total_qty += quantity
        if product.product_type == ProductType.SERVICE:
            service_qty += quantity
        lines.append(SubscriptionLine(
            product_id=product.id,
            variant_id=raw.get("variant_id"),
            tax_id=tax_id,
            discount_id=raw.get("discount_id"),
            quantity=quantity,
            unit_price=(product.sales_price or Decimal("0.00")) + extra,
        ))
    seats = service_qty or total_qty
    if enforce_min_qty and plan.min_qty and seats < plan.min_qty:
        raise HTTPException(status_code=400, detail=f"Plan '{plan.name}' requires a minimum quantity of {plan.min_qty}")
    return lines


def _new_subscription(customer_id, plan, start, expiry, terms, discount_id, status_, validity_days) -> Subscription:
    return Subscription(
        sub_number=f"SUB-{start:%Y%m}-{uuid4().hex[:6].upper()}",
        customer_id=customer_id,
        plan_id=plan.id,
        discount_id=discount_id,
        status=status_,
        start_date=start,
        next_billing_date=start,  # first period is billed on the start date
        expiry_date=expiry,
        payment_terms_days=terms,
        quotation_valid_until=date.today() + timedelta(days=validity_days),
    )


@router.get("", response_model=list[SubscriptionListItem])
def list_subscriptions(
    customer_id: Optional[int] = None,
    status: Optional[SubscriptionStatus] = None,  # noqa: A002 - matches the frontend query param
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Subscription).options(selectinload(Subscription.lines))
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Subscription.customer_id == user.id)
    elif customer_id:
        query = query.filter(Subscription.customer_id == customer_id)
    if status:
        query = query.filter(Subscription.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.join(User, User.id == Subscription.customer_id).filter(
            or_(Subscription.sub_number.ilike(like), User.full_name.ilike(like))
        )
    return subscription_list(db, query.order_by(Subscription.id.desc()).limit(500).all())


@router.get("/{subscription_id}", response_model=SubscriptionDetail)
def get_subscription(subscription_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return subscription_detail(db, _load(db, subscription_id, user))


@router.post("", response_model=SubscriptionDetail, status_code=status.HTTP_201_CREATED)
def create_subscription(payload: SubscriptionCreate, db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    """Create a quotation from scratch (status DRAFT)."""
    plan = db.get(Plan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    _validate_header(db, payload.customer_id, plan, payload.start_date, payload.expiry_date)
    if payload.discount_id:
        rule = db.get(DiscountRule, payload.discount_id)
        if not rule or rule.scope != DiscountScope.SUBSCRIPTION:
            raise HTTPException(status_code=400, detail="Subscription discounts must be SUBSCRIPTION-scope rules")
    sub = _new_subscription(
        payload.customer_id, plan, payload.start_date,
        payload.expiry_date or _default_expiry(plan, payload.start_date),
        payload.payment_terms_days, payload.discount_id, SubscriptionStatus.DRAFT,
        payload.quotation_validity_days,
    )
    sub.lines = _build_lines(db, plan, [line.model_dump() for line in payload.lines])
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return subscription_detail(db, sub)


@router.post("/from-template", response_model=SubscriptionDetail, status_code=status.HTTP_201_CREATED)
def create_from_template(payload: CreateFromTemplate, db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    """One-click quotation: plan and product lines are copied from the template."""
    template = db.get(QuotationTemplate, payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Quotation template not found")
    plan = db.get(Plan, template.plan_id)
    _validate_header(db, payload.customer_id, plan, payload.start_date, None)
    raw_lines = (
        [line.model_dump() for line in payload.lines]
        if payload.lines
        else [{"product_id": l.product_id, "variant_id": l.variant_id, "quantity": l.quantity} for l in template.lines]
    )
    sub = _new_subscription(
        payload.customer_id, plan, payload.start_date, _default_expiry(plan, payload.start_date),
        payload.payment_terms_days if payload.payment_terms_days is not None else 30,
        None, SubscriptionStatus.DRAFT, template.validity_days,
    )
    sub.lines = _build_lines(db, plan, raw_lines)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return subscription_detail(db, sub)


@router.post("/{subscription_id}/transition", response_model=SubscriptionDetail)
def transition_subscription(
    subscription_id: int,
    payload: TransitionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sub = _load(db, subscription_id, user)
    target = payload.target_status
    if user.role == UserRole.CUSTOMER and (sub.status, target) not in CUSTOMER_TRANSITIONS:
        raise HTTPException(status_code=403, detail="Customers may only pause, resume, renew, or close their own subscriptions")
    plan = db.get(Plan, sub.plan_id)
    today = date.today()
    if (
        target == SubscriptionStatus.CONFIRMED
        and sub.status in {SubscriptionStatus.DRAFT, SubscriptionStatus.QUOTATION}
        and sub.quotation_valid_until
        and today > sub.quotation_valid_until
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Quotation expired on {sub.quotation_valid_until}; create a new quotation to confirm it",
        )
    result = check_subscription_transition(
        current_status=sub.status.value,
        target_status=target.value,
        plan_flags={"can_pause": plan.can_pause, "can_close_early": plan.can_close_early, "can_renew": plan.can_renew},
        next_billing_date=sub.next_billing_date,
        expiry_date=sub.expiry_date,
        paused_at=sub.paused_at,
        today_str=today,
    )
    if not result["allowed"]:
        raise HTTPException(status_code=409, detail=result["error"])

    renewing = sub.status == SubscriptionStatus.CLOSED and target == SubscriptionStatus.ACTIVE
    sub.status = SubscriptionStatus(result["next_status"])
    sub.next_billing_date = date.fromisoformat(result["next_billing_date"]) if result["next_billing_date"] else None
    sub.expiry_date = date.fromisoformat(result["expiry_date"]) if result["expiry_date"] else None
    sub.paused_at = date.fromisoformat(result["paused_at"]) if result["paused_at"] else None
    if renewing:
        term = (sub.expiry_date - sub.start_date) if sub.expiry_date else None
        sub.next_billing_date = today
        if term and sub.expiry_date <= today:
            sub.expiry_date = today + term
    if sub.status == SubscriptionStatus.ACTIVE and sub.next_billing_date is None:
        sub.next_billing_date = sub.start_date
    db.commit()
    db.refresh(sub)
    return subscription_detail(db, sub)


@router.post("/{subscription_id}/toggle-addon", response_model=SubscriptionDetail)
def toggle_addon(
    subscription_id: int,
    payload: ToggleAddonRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Customers switch add-ons on/off; the change applies from the next invoice."""
    sub = _load(db, subscription_id, user)
    if sub.status == SubscriptionStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Closed subscriptions cannot be changed")
    product = db.get(Product, payload.product_id)
    if not product or product.product_type != ProductType.ADDON or not product.is_active:
        raise HTTPException(status_code=400, detail="Only active add-on products can be toggled")
    existing = [l for l in sub.lines if l.product_id == product.id]
    if payload.enabled and not existing:
        plan = db.get(Plan, sub.plan_id)
        # Add-ons don't count towards the plan's seat minimum.
        raw = [{"product_id": product.id, "variant_id": payload.variant_id, "quantity": 1}]
        line = _build_lines(db, plan, raw, enforce_min_qty=False)[0]
        sub.lines.append(line)
    elif not payload.enabled:
        for line in existing:
            sub.lines.remove(line)
    db.commit()
    db.refresh(sub)
    return subscription_detail(db, sub)


@router.post("/{subscription_id}/invoice", response_model=InvoiceDetail, status_code=status.HTTP_201_CREATED)
def generate_invoice(subscription_id: int, db: Session = Depends(get_db), user: User = Depends(staff_or_admin)):
    """Manually create a DRAFT invoice for the current billing period."""
    sub = _load(db, subscription_id, user)
    return invoice_detail(db, invoice_now(db, sub, date.today()))
