import type { DateStr, DiscountType, SubscriptionStatus } from '@/types/contracts'

export interface DiscountInput {
  type: DiscountType
  value: number
  min_qty: number
  min_purchase: number
  uses_left: number
  valid_from: DateStr | null
  valid_until: DateStr | null
}

export interface LineItemResult {
  unit_price: number
  gross_amount: number
  discount_amount: number
  discount_applied: boolean
  taxable_amount: number
  tax_amount: number
  line_total: number
}

export interface PlanFlags {
  auto_close: boolean
  can_close_early: boolean
  can_pause: boolean
  can_renew: boolean
}

export interface TransitionResult {
  allowed: boolean
  next_status: SubscriptionStatus
  next_billing_date: DateStr | null
  expiry_date: DateStr | null
  paused_at: DateStr | null
  error: string | null
}

export interface BillingDecision {
  action: 'BILL' | 'AUTO_CLOSE' | 'SKIP'
  billing_period_key: string
  next_billing_date: DateStr
  new_status: SubscriptionStatus
  reason: string
}
