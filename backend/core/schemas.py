"""Pydantic request and response contracts for the BrightLoop API."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    BillingFrequency,
    DiscountScope,
    DiscountType,
    InvoiceStatus,
    PaymentMethod,
    ProductType,
    SubscriptionStatus,
    UserRole,
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Authentication and users
class PublicUserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)
    role: UserRole = UserRole.CUSTOMER


class UserResponse(APIModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    created_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Catalog
class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    product_type: ProductType
    sales_price: Decimal = Field(ge=0, decimal_places=2)
    cost_price: Decimal = Field(ge=0, decimal_places=2)
    notes: Optional[str] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    product_type: Optional[ProductType] = None
    sales_price: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    cost_price: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProductVariantCreate(BaseModel):
    attribute_name: str = Field(min_length=1, max_length=80)
    attribute_value: str = Field(min_length=1, max_length=120)
    price_extra: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)


class ProductVariantResponse(APIModel):
    id: int
    product_id: int
    attribute_name: str
    attribute_value: str
    price_extra: Decimal


class ProductResponse(APIModel):
    id: int
    name: str
    product_type: ProductType
    sales_price: Decimal
    cost_price: Decimal
    notes: Optional[str] = None
    is_active: bool
    variants: list[ProductVariantResponse] = []


class TaxRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rate_percent: Decimal = Field(ge=0, le=100, decimal_places=2)
    is_active: bool = True


class TaxRuleResponse(APIModel):
    id: int
    name: str
    rate_percent: Decimal
    is_active: bool


class DiscountRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    discount_type: DiscountType
    value: Decimal = Field(ge=0, decimal_places=2)
    scope: DiscountScope
    min_qty: int = Field(default=0, ge=0)
    min_purchase: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    max_uses: Optional[int] = Field(default=None, ge=1)


class DiscountRuleResponse(APIModel):
    id: int
    name: str
    discount_type: DiscountType
    value: Decimal
    scope: DiscountScope
    min_qty: int
    min_purchase: Decimal
    valid_from: Optional[date]
    valid_until: Optional[date]
    max_uses: Optional[int]
    current_uses: int


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    billing_frequency: BillingFrequency
    plan_price: Decimal = Field(ge=0, decimal_places=2)
    min_qty: int = Field(default=1, ge=1)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    auto_close: bool = False
    can_close_early: bool = True
    can_pause: bool = True
    can_renew: bool = True


class PlanResponse(APIModel):
    id: int
    name: str
    billing_frequency: BillingFrequency
    plan_price: Decimal
    min_qty: int
    available_from: Optional[date]
    available_until: Optional[date]
    auto_close: bool
    can_close_early: bool
    can_pause: bool
    can_renew: bool


# Quotations
class QuotationTemplateLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)


class QuotationTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    plan_id: int
    validity_days: int = Field(default=30, ge=1, le=365)
    lines: list[QuotationTemplateLineCreate] = Field(min_length=1)


class QuotationTemplateLineResponse(APIModel):
    id: int
    template_id: int
    product_id: int
    variant_id: Optional[int]
    quantity: int


class QuotationTemplateResponse(APIModel):
    id: int
    name: str
    plan_id: int
    validity_days: int
    lines: list[QuotationTemplateLineResponse] = []


# Subscriptions
class SubscriptionLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    tax_id: Optional[int] = None
    discount_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)


class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: int
    discount_id: Optional[int] = None
    start_date: date
    expiry_date: Optional[date] = None
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    lines: list[SubscriptionLineCreate] = Field(min_length=1)


class SubscriptionLineResponse(APIModel):
    id: int
    subscription_id: int
    product_id: int
    variant_id: Optional[int]
    tax_id: Optional[int]
    discount_id: Optional[int]
    quantity: int
    unit_price: Decimal


class SubscriptionResponse(APIModel):
    id: int
    sub_number: str
    customer_id: int
    plan_id: int
    discount_id: Optional[int]
    status: SubscriptionStatus
    start_date: date
    next_billing_date: Optional[date]
    expiry_date: Optional[date]
    paused_at: Optional[date]
    payment_terms_days: int
    lines: list[SubscriptionLineResponse] = []


class SubscriptionAction(BaseModel):
    action: str = Field(pattern="^(quotation|confirm|activate|pause|resume|renew|close)$")
    reason: Optional[str] = Field(default=None, max_length=500)


# Invoices and payments
class PaymentCreate(BaseModel):
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0, decimal_places=2)
    payment_date: date
    note: Optional[str] = None


class PaymentResponse(APIModel):
    id: int
    invoice_id: int
    payment_method: PaymentMethod
    amount: Decimal
    payment_date: date
    note: Optional[str]


class InvoiceLineResponse(APIModel):
    id: int
    invoice_id: int
    product_name_snapshot: str
    variant_name_snapshot: Optional[str]
    quantity: int
    unit_price_snapshot: Decimal
    discount_amount: Decimal
    tax_percent_snapshot: Decimal
    tax_amount: Decimal
    line_total: Decimal


class InvoiceResponse(APIModel):
    id: int
    invoice_number: str
    subscription_id: int
    customer_id: int
    billing_period_key: str
    status: InvoiceStatus
    issue_date: date
    due_date: date
    subtotal: Decimal
    total_discount: Decimal
    total_tax: Decimal
    grand_total: Decimal
    amount_paid: Decimal
    lines: list[InvoiceLineResponse] = []


class InvoiceAction(BaseModel):
    action: str = Field(pattern="^(confirm|cancel|send)$")
    note: Optional[str] = Field(default=None, max_length=500)


class InvoiceSummary(BaseModel):
    invoice_id: int
    invoice_number: str
    status: InvoiceStatus
    due_date: date
    grand_total: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    overdue: bool
