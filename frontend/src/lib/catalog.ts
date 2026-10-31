import type { BillingFrequency, DateStr, DiscountRule, Plan } from '@/types/contracts'
import { formatDate } from './format'

export const FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
}

export type DiscountState = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'EXHAUSTED'

/** Derived state for a discount rule — the DB only stores the raw limits. */
export function discountState(rule: DiscountRule, today: DateStr): DiscountState {
  if (rule.max_uses !== null && rule.current_uses >= rule.max_uses) return 'EXHAUSTED'
  if (rule.valid_until && rule.valid_until < today) return 'EXPIRED'
  if (rule.valid_from && rule.valid_from > today) return 'SCHEDULED'
  return 'ACTIVE'
}

export type PlanAvailability = 'AVAILABLE' | 'SCHEDULED' | 'EXPIRED'

export function planAvailability(plan: Plan, today: DateStr): PlanAvailability {
  if (plan.available_from && plan.available_from > today) return 'SCHEDULED'
  if (plan.available_until && plan.available_until < today) return 'EXPIRED'
  return 'AVAILABLE'
}

export function formatWindow(from: DateStr | null, until: DateStr | null): string {
  if (!from && !until) return 'No window'
  if (from && !until) return `From ${formatDate(from)}`
  if (!from && until) return `Until ${formatDate(until)}`
  return `${formatDate(from as DateStr)} – ${formatDate(until as DateStr)}`
}
