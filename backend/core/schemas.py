"""Pydantic request and response contracts for the BrightLoop API.

Field names follow the Team Blueprint Section 5 shared contracts so the React
frontend (`frontend/src/types/contracts.ts`) can consume responses directly.
Money is stored as exact `Decimal` but serialised to JSON as a number.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

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

Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Authentication and users
# --------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=72)


class PublicUserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)


class UserCreate(PublicUserCreate):
    role: UserRole = UserRole.STAFF


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class ForgotPasswordResponse(BaseModel):
    sent: bool
    email: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=1, max_length=72)


class UserResponse(APIModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    created_at: Optional[datetime] = None


class SessionUser(APIModel):
    id: int
    email: str
    full_name: str
    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: SessionUser


class CustomerResponse(BaseModel):
    id: int
    full_name: str
    email: str
    company: str


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------
class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    product_type: ProductType
    sales_price: Money = Field(ge=0)
    cost_price: Money = Field(ge=0)
    notes: Optional[str] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    product_type: Optional[ProductType] = None
    sales_price: Optional[Money] = Field(default=None, ge=0)
    cost_price: Optional[Money] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProductVariantCreate(BaseModel):
    attribute_name: str = Field(min_length=1, max_length=80)
    attribute_value: str = Field(min_length=1, max_length=120)
    price_extra: Money = Field(default=Decimal("0.00"), ge=0)


class ProductVariantResponse(APIModel):
    id: int
    product_id: int
    attribute_name: str
    attribute_value: str
    price_extra: Money


class ProductResponse(APIModel):
    id: int
    name: str
    product_type: ProductType
    sales_price: Money
    cost_price: Money
    notes: Optional[str] = None
    is_active: bool
    variants: list[ProductVariantResponse] = []


class TaxRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rate_percent: Money = Field(ge=0, le=100)
    is_active: bool = True


class TaxRuleResponse(APIModel):
    id: int
    name: str
    rate_percent: Money
    is_active: bool


class DiscountRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    discount_type: DiscountType
    value: Money = Field(ge=0)
    scope: DiscountScope
    min_qty: int = Field(default=0, ge=0)
    min_purchase: Money = Field(default=Decimal("0.00"), ge=0)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    max_uses: Optional[int] = Field(default=None, ge=1)


class DiscountRuleResponse(APIModel):
    id: int
    name: str
    discount_type: DiscountType
    value: Money
    scope: DiscountScope
    min_qty: int
    min_purchase: Money
    valid_from: Optional[date]
    valid_until: Optional[date]
    max_uses: Optional[int]
    current_uses: int


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    billing_frequency: BillingFrequency
    plan_price: Money = Field(ge=0)
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
    plan_price: Money
    min_qty: int
    available_from: Optional[date]
    available_until: Optional[date]
    auto_close: bool
    can_close_early: bool
    can_pause: bool
    can_renew: bool


# --------------------------------------------------------------------------
# Quotation templates
# --------------------------------------------------------------------------
class QuotationTemplateLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)


class QuotationTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    plan_id: int
    validity_days: int = Field(default=30, ge=1, le=365)
    lines: list[QuotationTemplateLineCreate] = Field(min_length=1)


class QuotationTemplateLineDetail(BaseModel):
    id: int
    template_id: int
    product_id: int
    variant_id: Optional[int]
    quantity: int
    product_name: str
    variant_name: Optional[str]


class QuotationTemplateDetail(BaseModel):
    id: int
    name: str
    plan_id: int
    plan_name: str
    validity_days: int
    lines: list[QuotationTemplateLineDetail] = []


# --------------------------------------------------------------------------
# Subscriptions (Contract A)
# --------------------------------------------------------------------------
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


class TemplateLineOverride(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)


class CreateFromTemplate(BaseModel):
    template_id: int
    customer_id: int
    start_date: date
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    lines: Optional[list[TemplateLineOverride]] = None


class TransitionRequest(BaseModel):
    target_status: SubscriptionStatus


class ToggleAddonRequest(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    enabled: bool


class PlanPermissions(BaseModel):
    auto_close: bool
    can_close_early: bool
    can_pause: bool
    can_renew: bool


class SubscriptionDetailLine(BaseModel):
    product_id: int
    product_name: str
    variant_name: Optional[str]
    quantity: int
    unit_price: Money
    discount_amount: Money
    discount_applied: bool
    tax_percent: Money
    tax_amount: Money
    line_total: Money


class SubscriptionSummary(BaseModel):
    subtotal: Money
    line_discount_total: Money
    subscription_discount: Money
    total_discount: Money
    total_tax: Money
    grand_total: Money


class SubscriptionDetail(BaseModel):
    id: int
    sub_number: str
    customer_id: int
    customer_name: str
    plan_id: int
    plan_name: str
    billing_frequency: BillingFrequency
    status: SubscriptionStatus
    start_date: date
    next_billing_date: Optional[date]
    expiry_date: Optional[date]
    paused_at: Optional[date]
    plan_permissions: PlanPermissions
    lines: list[SubscriptionDetailLine]
    summary: SubscriptionSummary


class SubscriptionListItem(BaseModel):
    id: int
    sub_number: str
    customer_name: str
    plan_name: str
    billing_frequency: BillingFrequency
    status: SubscriptionStatus
    next_billing_date: Optional[date]
    expiry_date: Optional[date]
    grand_total: Money


# --------------------------------------------------------------------------
# Invoices and payments (Contract B)
# --------------------------------------------------------------------------
class PaymentCreate(BaseModel):
    invoice_id: int
    payment_method: PaymentMethod
    amount: Money = Field(gt=0)
    payment_date: date
    note: Optional[str] = None


class PaymentRecord(APIModel):
    id: int
    payment_method: PaymentMethod
    amount: Money
    payment_date: date
    note: Optional[str]


class PaymentListItem(PaymentRecord):
    invoice_id: int
    invoice_number: str
    customer_name: str


class InvoiceLineSnapshot(APIModel):
    product_name_snapshot: str
    variant_name_snapshot: Optional[str]
    quantity: int
    unit_price_snapshot: Money
    discount_amount: Money
    tax_percent_snapshot: Money
    tax_amount: Money
    line_total: Money


class InvoiceListItem(BaseModel):
    id: int
    invoice_number: str
    subscription_id: int
    sub_number: str
    customer_name: str
    status: InvoiceStatus
    issue_date: date
    due_date: date
    is_overdue: bool
    grand_total: Money
    amount_paid: Money
    amount_due: Money


class InvoiceDetail(InvoiceListItem):
    billing_period_key: str
    subtotal: Money
    total_discount: Money
    total_tax: Money
    lines: list[InvoiceLineSnapshot]
    payments: list[PaymentRecord]


class ReminderResponse(BaseModel):
    sent: Literal[True] = True
    to: str


# --------------------------------------------------------------------------
# Billing day and analytics (Contract C)
# --------------------------------------------------------------------------
class BillingRunRequest(BaseModel):
    today: Optional[date] = None


class BillingRunDecision(BaseModel):
    sub_number: str
    customer_name: str
    action: Literal["BILL", "SKIP", "AUTO_CLOSE"]
    period_key: str
    amount: Money
    reason: str


class BillingRunReport(BaseModel):
    ran_at: datetime
    today: date
    billed: int
    skipped: int
    auto_closed: int
    total_amount: Money
    decisions: list[BillingRunDecision]
    duration_ms: float


class OverdueInvoiceRow(BaseModel):
    invoice_id: int
    invoice_number: str
    customer_name: str
    amount_due: Money
    due_date: date
    days_overdue: int


class AnalyticsSummary(BaseModel):
    query_time_ms: float
    active_subscriptions_count: int
    mrr_collected: Money
    total_outstanding_owed: Money
    overdue_invoices_count: int
    overdue_invoices: list[OverdueInvoiceRow]


class AppNotification(BaseModel):
    id: str
    kind: Literal["OVERDUE", "RENEWAL", "PAYMENT", "DISCOUNT"]
    title: str
    body: str
    href: str
    created_at: datetime
    read: bool = False
