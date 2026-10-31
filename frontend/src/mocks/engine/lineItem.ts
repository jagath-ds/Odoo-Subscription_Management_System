import type { DateStr } from '@/types/contracts'
import { isWithinWindow } from './dates'
import { roundHalfUp2 } from './money'
import type { DiscountInput, LineItemResult } from './types'

/**
 * Pure calculation function for a single line item.
 * Mirrors Member 2's backend Python pricing engine exactly.
 */
export function calculateLineItem(
  base_price: number,
  variant_extra: number,
  quantity: number,
  tax_percent: number,
  discount: DiscountInput | null,
  today_str: DateStr,
): LineItemResult {
  const unit_price = roundHalfUp2(base_price + variant_extra)
  const gross_amount = roundHalfUp2(unit_price * quantity)

  let discount_amount = 0
  let discount_applied = false

  if (discount) {
    const withinDate = isWithinWindow(today_str, discount.valid_from, discount.valid_until)
    const meetsQty = quantity >= discount.min_qty
    const meetsPurchase = gross_amount >= discount.min_purchase
    const hasUses = discount.uses_left > 0

    if (withinDate && meetsQty && meetsPurchase && hasUses) {
      discount_applied = true
      if (discount.type === 'PERCENT') {
        discount_amount = roundHalfUp2(gross_amount * (discount.value / 100))
      } else {
        discount_amount = roundHalfUp2(Math.min(discount.value, gross_amount))
      }
    }
  }

  const taxable_amount = roundHalfUp2(Math.max(0, gross_amount - discount_amount))
  const tax_amount = roundHalfUp2(taxable_amount * (tax_percent / 100))
  const line_total = roundHalfUp2(taxable_amount + tax_amount)

  return {
    unit_price,
    gross_amount,
    discount_amount,
    discount_applied,
    taxable_amount,
    tax_amount,
    line_total,
  }
}
