/**
 * Shared contracts with the FastAPI backend.
 * Field names are verbatim from the team contract — do not rename.
 */

export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER'
export type ProductType = 'SERVICE' | 'ADDON'
export type BillingFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type DiscountType = 'PERCENT' | 'FIXED'
export type DiscountScope = 'PRODUCT' | 'SUBSCRIPTION'
export type SubscriptionStatus =
  | 'DRAFT'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
export type InvoiceStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED'
export type PaymentMethod = 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CASH'

/** ISO calendar date, always `YYYY-MM-DD`. */
export type DateStr = string

/* ------------------------------------------------------------------ */
/* Entities (mirror DB columns)                                        */
/* ------------------------------------------------------------------ */

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  /** ISO timestamp from the API — not a calendar date. */
  created_at: string
}

export interface Product {
  id: number
  name: string
  product_type: ProductType
  sales_price: number
  cost_price: number
  notes: string | null
  is_active: boolean
}

export interface ProductVariant {
  id: number
  product_id: number
  attribute_name: string
  attribute_value: string
  price_extra: number
}

export interface TaxRule {
  id: number
  name: string
  rate_percent: number
  is_active: boolean
}

export interface DiscountRule {
  id: number
  name: string
  discount_type: DiscountType
  value: number
  scope: DiscountScope
  min_qty: number
  min_purchase: number
  valid_from: DateStr | null
  valid_until: DateStr | null
  max_uses: number | null
  current_uses: number
}

export interface Plan {
  id: number
  name: string
  billing_frequency: BillingFrequency
  plan_price: number
  min_qty: number
  available_from: DateStr | null
  available_until: DateStr | null
  auto_close: boolean
  can_close_early: boolean
  can_pause: boolean
  can_renew: boolean
}

export interface QuotationTemplate {
  id: number
  name: string
  plan_id: number
  validity_days: number
}

export interface QuotationTemplateLine {
  id: number
  template_id: number
  product_id: number
  variant_id: number | null
  quantity: number
}

export interface Subscription {
  id: number
  sub_number: string
  customer_id: number
  plan_id: number
  discount_id: number | null
  status: SubscriptionStatus
  start_date: DateStr
  next_billing_date: DateStr | null
  expiry_date: DateStr | null
  paused_at: DateStr | null
  payment_terms_days: number
}

export interface SubscriptionLine {
  id: number
  subscription_id: number
  product_id: number
  variant_id: number | null
  tax_id: number | null
  discount_id: number | null
  quantity: number
  unit_price: number
}

export interface Invoice {
  id: number
  invoice_number: string
  subscription_id: number
  customer_id: number
  billing_period_key: string
  status: InvoiceStatus
  issue_date: DateStr
  due_date: DateStr
  subtotal: number
  total_discount: number
  total_tax: number
  grand_total: number
  amount_paid: number
}

export interface InvoiceLine {
  id: number
  invoice_id: number
  product_name_snapshot: string
  variant_name_snapshot: string | null
  quantity: number
  unit_price_snapshot: number
  discount_amount: number
  tax_percent_snapshot: number
  tax_amount: number
  line_total: number
}

export interface Payment {
  id: number
  invoice_id: number
  payment_method: PaymentMethod
  amount: number
  payment_date: DateStr
  note: string | null
}

/* ------------------------------------------------------------------ */
/* Contract A — GET /api/subscriptions/{id}                            */
/* ------------------------------------------------------------------ */

export interface SubscriptionDetailLine {
  product_id: number
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  discount_amount: number
  discount_applied: boolean
  tax_percent: number
  tax_amount: number
  line_total: number
}

export interface SubscriptionSummary {
  subtotal: number
  line_discount_total: number
  subscription_discount: number
  total_discount: number
  total_tax: number
  grand_total: number
}

export interface PlanPermissions {
  auto_close: boolean
  can_close_early: boolean
  can_pause: boolean
  can_renew: boolean
}

export interface SubscriptionDetail {
  id: number
  sub_number: string
  customer_id: number
  customer_name: string
  plan_id: number
  plan_name: string
  billing_frequency: BillingFrequency
  status: SubscriptionStatus
  start_date: DateStr
  next_billing_date: DateStr
  expiry_date: DateStr | null
  paused_at: DateStr | null
  plan_permissions: PlanPermissions
  lines: SubscriptionDetailLine[]
  summary: SubscriptionSummary
}

/* ------------------------------------------------------------------ */
/* Contract B — GET /api/invoices/{id}                                 */
/* ------------------------------------------------------------------ */

export interface InvoiceLineSnapshot {
  product_name_snapshot: string
  variant_name_snapshot: string | null
  quantity: number
  unit_price_snapshot: number
  discount_amount: number
  tax_percent_snapshot: number
  tax_amount: number
  line_total: number
}

export interface PaymentRecord {
  id: number
  payment_method: PaymentMethod
  amount: number
  payment_date: DateStr
  note: string | null
}

export interface InvoiceDetail {
  id: number
  invoice_number: string
  subscription_id: number
  sub_number: string
  customer_name: string
  billing_period_key: string
  status: InvoiceStatus
  issue_date: DateStr
  due_date: DateStr
  is_overdue: boolean
  subtotal: number
  total_discount: number
  total_tax: number
  grand_total: number
  amount_paid: number
  amount_due: number
  lines: InvoiceLineSnapshot[]
  payments: PaymentRecord[]
}

/* ------------------------------------------------------------------ */
/* Contract C — GET /api/analytics/summary                             */
/* ------------------------------------------------------------------ */

export interface OverdueInvoiceRow {
  invoice_id: number
  invoice_number: string
  customer_name: string
  amount_due: number
  due_date: DateStr
  days_overdue: number
}

export interface AnalyticsSummary {
  query_time_ms: number
  active_subscriptions_count: number
  mrr_collected: number
  total_outstanding_owed: number
  overdue_invoices_count: number
  overdue_invoices: OverdueInvoiceRow[]
}

/* ------------------------------------------------------------------ */
/* List projections (derived from A/B — confirmed with Member 4)       */
/* ------------------------------------------------------------------ */

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface SubscriptionListItem {
  id: number
  sub_number: string
  customer_name: string
  plan_name: string
  billing_frequency: BillingFrequency
  status: SubscriptionStatus
  next_billing_date: DateStr
  expiry_date: DateStr | null
  grand_total: number
}

export interface InvoiceListItem {
  id: number
  invoice_number: string
  sub_number: string
  customer_name: string
  status: InvoiceStatus
  issue_date: DateStr
  due_date: DateStr
  is_overdue: boolean
  grand_total: number
  amount_paid: number
  amount_due: number
}

export interface PaymentListItem extends PaymentRecord {
  invoice_number: string
  customer_name: string
}

/* ------------------------------------------------------------------ */
/* Session + UI-level contracts                                        */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: number
  email: string
  full_name: string
  role: Role
}

export type NotificationKind = 'OVERDUE' | 'RENEWAL' | 'PAYMENT' | 'DISCOUNT'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  created_at: string
  read: boolean
}

export interface DemoAccount {
  role: Role
  label: string
  full_name: string
  email: string
  password: string
}
