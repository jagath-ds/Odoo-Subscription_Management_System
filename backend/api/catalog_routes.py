"""Product, plan, rule, and quotation-template endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, require_role
from ..core.database import get_db
from ..core.models import DiscountRule, Plan, Product, ProductVariant, QuotationTemplate, QuotationTemplateLine, TaxRule, User, UserRole
from ..core.schemas import (
    DiscountRuleCreate, DiscountRuleResponse, PlanCreate, PlanResponse,
    ProductCreate, ProductResponse, ProductUpdate, ProductVariantCreate,
    ProductVariantResponse, QuotationTemplateCreate, QuotationTemplateResponse,
    TaxRuleCreate, TaxRuleResponse,
)


router = APIRouter(prefix="/api/catalog", tags=["catalog"])
admin_only = require_role(UserRole.ADMIN)
admin_or_staff = require_role(UserRole.ADMIN, UserRole.STAFF)


@router.get("/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Product).filter(Product.is_active.is_(True)).order_by(Product.name).all()


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = Product(**payload.model_dump())
    db.add(product); db.commit(); db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit(); db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False
    db.commit()


@router.post("/products/{product_id}/variants", response_model=ProductVariantResponse, status_code=201)
def create_variant(product_id: int, payload: ProductVariantCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant); db.commit(); db.refresh(variant)
    return variant


@router.get("/plans", response_model=list[PlanResponse])
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Plan).order_by(Plan.name).all()


@router.post("/plans", response_model=PlanResponse, status_code=201)
def create_plan(payload: PlanCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    if payload.available_from and payload.available_until and payload.available_until < payload.available_from:
        raise HTTPException(400, "available_until must be on or after available_from")
    plan = Plan(**payload.model_dump())
    db.add(plan); db.commit(); db.refresh(plan)
    return plan


@router.get("/taxes", response_model=list[TaxRuleResponse])
def list_taxes(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(TaxRule).filter(TaxRule.is_active.is_(True)).order_by(TaxRule.name).all()


@router.post("/taxes", response_model=TaxRuleResponse, status_code=201)
def create_tax(payload: TaxRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    tax = TaxRule(**payload.model_dump())
    db.add(tax); db.commit(); db.refresh(tax)
    return tax


@router.get("/discounts", response_model=list[DiscountRuleResponse])
def list_discounts(db: Session = Depends(get_db), _: User = Depends(admin_or_staff)):
    return db.query(DiscountRule).order_by(DiscountRule.name).all()


@router.post("/discounts", response_model=DiscountRuleResponse, status_code=201)
def create_discount(payload: DiscountRuleCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    if payload.valid_from and payload.valid_until and payload.valid_until < payload.valid_from:
        raise HTTPException(400, "valid_until must be on or after valid_from")
    discount = DiscountRule(**payload.model_dump())
    db.add(discount); db.commit(); db.refresh(discount)
    return discount


@router.get("/templates", response_model=list[QuotationTemplateResponse])
def list_templates(db: Session = Depends(get_db), _: User = Depends(admin_or_staff)):
    return db.query(QuotationTemplate).order_by(QuotationTemplate.name).all()


@router.post("/templates", response_model=QuotationTemplateResponse, status_code=201)
def create_template(payload: QuotationTemplateCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    if not db.get(Plan, payload.plan_id):
        raise HTTPException(404, "Plan not found")
    product_ids = {line.product_id for line in payload.lines}
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    if len(products) != len(product_ids):
        raise HTTPException(404, "One or more products were not found")
    template = QuotationTemplate(name=payload.name, plan_id=payload.plan_id, validity_days=payload.validity_days)
    template.lines = [QuotationTemplateLine(**line.model_dump()) for line in payload.lines]
    db.add(template); db.commit(); db.refresh(template)
    return template
