import type { DateStr, SubscriptionStatus } from '@/types/contracts'
import { addDays, diffDays } from './dates'
import type { PlanFlags, TransitionResult } from './types'

export function checkSubscriptionTransition(
  current_status: SubscriptionStatus,
  target_status: SubscriptionStatus,
  plan_flags: PlanFlags,
  next_billing_date: DateStr | null,
  expiry_date: DateStr | null,
  paused_at: DateStr | null,
  today_str: DateStr,
): TransitionResult {
  if (current_status === target_status) {
    return {
      allowed: true,
      next_status: target_status,
      next_billing_date,
      expiry_date,
      paused_at,
      error: null,
    }
  }

  // 1. Validate status flow
  const allowedNext: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    DRAFT: ['QUOTATION', 'CONFIRMED', 'CLOSED'],
    QUOTATION: ['CONFIRMED', 'CLOSED'],
    CONFIRMED: ['ACTIVE', 'CLOSED'],
    ACTIVE: ['PAUSED', 'CLOSED'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    CLOSED: ['ACTIVE', 'CONFIRMED'], // renewal
  }

  if (!allowedNext[current_status]?.includes(target_status)) {
    return {
      allowed: false,
      next_status: current_status,
      next_billing_date,
      expiry_date,
      paused_at,
      error: `Cannot transition from ${current_status} to ${target_status}`,
    }
  }

  // 2. Validate plan permissions
  if (target_status === 'PAUSED' && !plan_flags.can_pause) {
    return {
      allowed: false,
      next_status: current_status,
      next_billing_date,
      expiry_date,
      paused_at,
      error: 'This plan does not allow pausing',
    }
  }

  if (target_status === 'CLOSED' && current_status === 'ACTIVE' && !plan_flags.can_close_early) {
    return {
      allowed: false,
      next_status: current_status,
      next_billing_date,
      expiry_date,
      paused_at,
      error: 'This plan does not allow early closure',
    }
  }

  if (current_status === 'CLOSED' && (target_status === 'ACTIVE' || target_status === 'CONFIRMED') && !plan_flags.can_renew) {
    return {
      allowed: false,
      next_status: current_status,
      next_billing_date,
      expiry_date,
      paused_at,
      error: 'This plan does not allow renewal',
    }
  }

  // 3. Compute date mutations
  let newNextBilling = next_billing_date
  let newExpiry = expiry_date
  let newPausedAt = paused_at

  if (target_status === 'PAUSED') {
    newPausedAt = today_str
  } else if (current_status === 'PAUSED' && target_status === 'ACTIVE') {
    if (paused_at) {
      const daysPaused = Math.max(0, diffDays(today_str, paused_at))
      if (daysPaused > 0) {
        if (newNextBilling) {
          newNextBilling = addDays(newNextBilling, daysPaused)
        }
        if (newExpiry) {
          newExpiry = addDays(newExpiry, daysPaused)
        }
      }
    }
    newPausedAt = null
  }

  return {
    allowed: true,
    next_status: target_status,
    next_billing_date: newNextBilling,
    expiry_date: newExpiry,
    paused_at: newPausedAt,
    error: null,
  }
}
