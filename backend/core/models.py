import enum
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Date, DateTime,
    Text, Enum, ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# --- ENUMS ---
class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    CUSTOMER = "CUSTOMER"

class ProductType(str, enum.Enum):
    SERVICE = "SERVICE"
    ADDON = "ADDON"

class DiscountType(str, enum.Enum):
    PERCENT = "PERCENT"
    FIXED = "FIXED"

class DiscountScope(str, enum.Enum):
    PRODUCT = "PRODUCT"
    SUBSCRIPTION = "SUBSCRIPTION"

class BillingFrequency(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"

class SubscriptionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    QUOTATION = "QUOTATION"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class PaymentMethod(str, enum.Enum):
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"
    CARD = "CARD"
    CASH = "CASH"

# --- TABLE 1: users ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CUSTOMER)
    reset_token = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

# --- TABLE 2: products ---
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    product_type = Column(Enum(ProductType), nullable=False)
    sales_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete")

# --- TABLE 3: product_variants ---
class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    attribute_name = Column(String, nullable=False)
    attribute_value = Column(String, nullable=False)
    price_extra = Column(Numeric(12, 2), default=0)
    product = relationship("Product", back_populates="variants")

# --- TABLE 4: tax_rules ---
class TaxRule(Base):
    __tablename__ = "tax_rules"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    rate_percent = Column(Numeric(5, 2), nullable=False)
    is_active = Column(Boolean, default=True)

# --- TABLE 5: discount_rules ---
class DiscountRule(Base):
    __tablename__ = "discount_rules"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    discount_type = Column(Enum(DiscountType), nullable=False)
    value = Column(Numeric(12, 2), nullable=False)
    scope = Column(Enum(DiscountScope), nullable=False)
    min_qty = Column(Integer, default=0)
    min_purchase = Column(Numeric(12, 2), default=0)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    max_uses = Column(Integer, nullable=True)
    current_uses = Column(Integer, default=0)

# --- TABLE 6: plans ---
class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    billing_frequency = Column(Enum(BillingFrequency), nullable=False)
    plan_price = Column(Numeric(12, 2), nullable=False)
    min_qty = Column(Integer, default=1)
    available_from = Column(Date, nullable=True)
    available_until = Column(Date, nullable=True)
    auto_close = Column(Boolean, default=False)
    can_close_early = Column(Boolean, default=True)
    can_pause = Column(Boolean, default=True)
    can_renew = Column(Boolean, default=True)

# --- TABLE 7: quotation_templates ---
class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    validity_days = Column(Integer, default=30)
    lines = relationship("QuotationTemplateLine", back_populates="template", cascade="all, delete-orphan")

# --- TABLE 8: quotation_template_lines ---
class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"
    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    quantity = Column(Integer, default=1)
    template = relationship("QuotationTemplate", back_populates="lines")

# --- TABLE 9: subscriptions ---
class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True)
    sub_number = Column(String, unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    discount_id = Column(Integer, ForeignKey("discount_rules.id"), nullable=True)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.DRAFT)
    start_date = Column(Date, nullable=False)
    next_billing_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    paused_at = Column(Date, nullable=True)
    payment_terms_days = Column(Integer, default=30)
    # Last day a QUOTATION can be confirmed (created_on + template validity_days).
    quotation_valid_until = Column(Date, nullable=True)
    lines = relationship("SubscriptionLine", back_populates="subscription", cascade="all, delete-orphan")
    __table_args__ = (
        Index("ix_sub_status_billing", "status", "next_billing_date"),
    )

# --- TABLE 10: subscription_lines ---
class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"
    id = Column(Integer, primary_key=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    tax_id = Column(Integer, ForeignKey("tax_rules.id"), nullable=True)
    discount_id = Column(Integer, ForeignKey("discount_rules.id"), nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    subscription = relationship("Subscription", back_populates="lines")

# --- TABLE 11: invoices ---
class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    invoice_number = Column(String, unique=True, nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    billing_period_key = Column(String, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(12, 2), default=0)
    total_discount = Column(Numeric(12, 2), default=0)
    total_tax = Column(Numeric(12, 2), default=0)
    grand_total = Column(Numeric(12, 2), default=0)
    amount_paid = Column(Numeric(12, 2), default=0)
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete")
    __table_args__ = (
        UniqueConstraint("subscription_id", "billing_period_key", name="uq_invoice_period"),
        Index("ix_invoice_status_due", "status", "due_date"),
    )

# --- TABLE 12: invoice_lines ---
class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_name_snapshot = Column(String, nullable=False)
    variant_name_snapshot = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price_snapshot = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0)
    tax_percent_snapshot = Column(Numeric(5, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    line_total = Column(Numeric(12, 2), nullable=False)
    invoice = relationship("Invoice", back_populates="lines")

# --- TABLE 13 (bonus): payments ---
class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    invoice = relationship("Invoice", back_populates="payments")
