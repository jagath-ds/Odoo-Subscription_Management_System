"""Admin catalog & rules studio: products, variants, plans, taxes, discounts, templates.

Reads are available to any authenticated user; every write is ADMIN-only.
"""

from typing import Callable, Type

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import admin_only, get_current_user, staff_or_admin
from ..core.database import get_db
from ..core.models import (
    DiscountRule,
    Plan,
    Product,
    ProductVariant,
    QuotationTemplate,
    QuotationTemplateLine,
    TaxRule,
    User,
    UserRole,
)
from ..core.schemas import (
    DiscountRuleCreate,
    DiscountRuleResponse,
    PlanCreate,
    PlanResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
    QuotationTemplateCreate,
    QuotationTemplateDetail,
    TaxRuleCreate,
    TaxRuleResponse,
)
from ..services.pricing_service import variant_label

router = APIRouter(prefix="/api", tags=["catalog"])


def _get_or_404(db: Session, model: Type, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


def _save(db: Session, obj):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This record is referenced by other data and cannot be changed that way")
    if obj is not None:
        db.refresh(obj)
    return obj


def _delete(db: Session, obj, archive: Callable[[], None] | None = None) -> None:
    """Hard delete; if the row is still referenced, archive it instead when possible."""
    db.delete(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if archive is None:
            raise HTTPException(status_code=409, detail="This record is in use and cannot be deleted")
        archive()
        db.commit()


def _check_window(start, end, label: str) -> None:
    if start and end and end < start:
        raise HTTPException(status_code=400, detail=f"{label}: end date must be on or after start date")


# Products & variants
@router.get("/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Product)
    if user.role != UserRole.ADMIN:
        query = query.filter(Product.is_active.is_(True))
    return query.order_by(Product.name).all()


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = Product(**payload.model_dump())
    db.add(product)
    return _save(db, product)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = _get_or_404(db, Product, product_id, "Product")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    return _save(db, product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = _get_or_404(db, Product, product_id, "Product")

    def archive():
        db.get(Product, product_id).is_active = False

    _delete(db, product, archive)


@router.post("/products/{product_id}/variants", response_model=ProductVariantResponse, status_code=201)
def create_variant(product_id: int, payload: ProductVariantCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _get_or_404(db, Product, product_id, "Product")
    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant)
    return _save(db, variant)


@router.put("/variants/{variant_id}", response_model=ProductVariantResponse)
def update_variant(variant_id: int, payload: ProductVariantCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    variant = _get_or_404(db, ProductVariant, variant_id, "Variant")
    for key, value in payload.model_dump().items():
        setattr(variant, key, value)
    return _save(db, variant)


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variant(variant_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _delete(db, _get_or_404(db, ProductVariant, variant_id, "Variant"))


# Plans
@router.get("/plans", response_model=list[PlanResponse])
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Plan).order_by(Plan.name).all()


@router.post("/plans", response_model=PlanResponse, status_code=201)
def create_plan(payload: PlanCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _check_window(payload.available_from, payload.available_until, "Plan availability")
    plan = Plan(**payload.model_dump())
    db.add(plan)
    return _save(db, plan)


@router.put("/plans/{plan_id}", response_model=PlanResponse)
def update_plan(plan_id: int, payload: PlanCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _check_window(payload.available_from, payload.available_until, "Plan availability")
    plan = _get_or_404(db, Plan, plan_id, "Plan")
    for key, value in payload.model_dump().items():
        setattr(plan, key, value)
    return _save(db, plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _delete(db, _get_or_404(db, Plan, plan_id, "Plan"))


# Tax rules
@router.get("/tax-rules", response_model=list[TaxRuleResponse])
def list_tax_rules(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(TaxRule).order_by(TaxRule.name).all()


@router.post("/tax-rules", response_model=TaxRuleResponse, status_code=201)
def create_tax_rule(payload: TaxRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    tax = TaxRule(**payload.model_dump())
    db.add(tax)
    return _save(db, tax)


@router.put("/tax-rules/{tax_id}", response_model=TaxRuleResponse)
def update_tax_rule(tax_id: int, payload: TaxRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    tax = _get_or_404(db, TaxRule, tax_id, "Tax rule")
    for key, value in payload.model_dump().items():
        setattr(tax, key, value)
    return _save(db, tax)


@router.delete("/tax-rules/{tax_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_rule(tax_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    tax = _get_or_404(db, TaxRule, tax_id, "Tax rule")

    def archive():
        db.get(TaxRule, tax_id).is_active = False

    _delete(db, tax, archive)


# Discount rules (admin-only creation)
@router.get("/discount-rules", response_model=list[DiscountRuleResponse])
def list_discount_rules(db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    return db.query(DiscountRule).order_by(DiscountRule.name).all()


@router.post("/discount-rules", response_model=DiscountRuleResponse, status_code=201)
def create_discount_rule(payload: DiscountRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _check_window(payload.valid_from, payload.valid_until, "Discount validity")
    if payload.discount_type.value == "PERCENT" and payload.value > 100:
        raise HTTPException(status_code=400, detail="Percentage discounts cannot exceed 100")
    rule = DiscountRule(**payload.model_dump(), current_uses=0)
    db.add(rule)
    return _save(db, rule)


@router.put("/discount-rules/{rule_id}", response_model=DiscountRuleResponse)
def update_discount_rule(rule_id: int, payload: DiscountRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _check_window(payload.valid_from, payload.valid_until, "Discount validity")
    if payload.discount_type.value == "PERCENT" and payload.value > 100:
        raise HTTPException(status_code=400, detail="Percentage discounts cannot exceed 100")
    rule = _get_or_404(db, DiscountRule, rule_id, "Discount rule")
    for key, value in payload.model_dump().items():
        setattr(rule, key, value)
    return _save(db, rule)


@router.delete("/discount-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _delete(db, _get_or_404(db, DiscountRule, rule_id, "Discount rule"))


# Quotation templates
def template_detail(db: Session, template: QuotationTemplate) -> dict:
    plan = db.get(Plan, template.plan_id)
    lines = []
    for line in template.lines:
        product = db.get(Product, line.product_id)
        variant = db.get(ProductVariant, line.variant_id) if line.variant_id else None
        lines.append({
            "id": line.id,
            "template_id": template.id,
            "product_id": line.product_id,
            "variant_id": line.variant_id,
            "quantity": line.quantity,
            "product_name": product.name if product else "",
            "variant_name": variant_label(variant),
        })
    return {
        "id": template.id,
        "name": template.name,
        "plan_id": template.plan_id,
        "plan_name": plan.name if plan else "",
        "validity_days": template.validity_days,
        "lines": lines,
    }


def _template_lines(db: Session, payload: QuotationTemplateCreate) -> list[QuotationTemplateLine]:
    _get_or_404(db, Plan, payload.plan_id, "Plan")
    for line in payload.lines:
        _get_or_404(db, Product, line.product_id, "Product")
        if line.variant_id:
            variant = _get_or_404(db, ProductVariant, line.variant_id, "Variant")
            if variant.product_id != line.product_id:
                raise HTTPException(status_code=400, detail="A variant must belong to its selected product")
    return [QuotationTemplateLine(**line.model_dump()) for line in payload.lines]


@router.get("/quotation-templates", response_model=list[QuotationTemplateDetail])
def list_templates(db: Session = Depends(get_db), _: User = Depends(staff_or_admin)):
    return [template_detail(db, t) for t in db.query(QuotationTemplate).order_by(QuotationTemplate.name).all()]


@router.post("/quotation-templates", response_model=QuotationTemplateDetail, status_code=201)
def create_template(payload: QuotationTemplateCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    template = QuotationTemplate(name=payload.name, plan_id=payload.plan_id, validity_days=payload.validity_days)
    template.lines = _template_lines(db, payload)
    db.add(template)
    return template_detail(db, _save(db, template))


@router.put("/quotation-templates/{template_id}", response_model=QuotationTemplateDetail)
def update_template(template_id: int, payload: QuotationTemplateCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    template = _get_or_404(db, QuotationTemplate, template_id, "Quotation template")
    template.lines = _template_lines(db, payload)
    template.name, template.plan_id, template.validity_days = payload.name, payload.plan_id, payload.validity_days
    return template_detail(db, _save(db, template))


@router.delete("/quotation-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    _delete(db, _get_or_404(db, QuotationTemplate, template_id, "Quotation template"))
