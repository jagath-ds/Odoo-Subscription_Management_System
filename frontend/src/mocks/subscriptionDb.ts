import type {
  DateStr,
  Subscription,
  SubscriptionDetail,
  SubscriptionDetailLine,
  SubscriptionLine,
  SubscriptionListItem,
  SubscriptionStatus,
  SubscriptionSummary,
} from '@/types/contracts'
import {
  getDiscountRule,
  getPlan,
  getProduct,
  getQuotationTemplate,
  getTaxRule,
} from './catalogDb'
import { findUserById } from './db'
import { addCycle, addDays } from './engine/dates'
import { calculateLineItem } from './engine/lineItem'
import { roundHalfUp2, sumLines } from './engine/money'
import { checkSubscriptionTransition } from './engine/transitions'
import type { DiscountInput } from './engine/types'
import {
  SEED_CUSTOMERS,
  SEED_SUBSCRIPTION_LINES,
  SEED_SUBSCRIPTIONS,
  type CustomerUser,
} from './subscriptions.fixtures'

let subscriptions: Subscription[] = SEED_SUBSCRIPTIONS.map((s) => ({ ...s }))
let subscriptionLines: SubscriptionLine[] = SEED_SUBSCRIPTION_LINES.map((l) => ({ ...l }))
let customers: CustomerUser[] = SEED_CUSTOMERS.map((c) => ({ ...c }))
let nextSubId = 20
let nextLineId = 50

export function resetSubscriptionDb(): void {
  subscriptions = SEED_SUBSCRIPTIONS.map((s) => ({ ...s }))
  subscriptionLines = SEED_SUBSCRIPTION_LINES.map((l) => ({ ...l }))
  customers = SEED_CUSTOMERS.map((c) => ({ ...c }))
  nextSubId = 20
  nextLineId = 50
}

export function listCustomers(): CustomerUser[] {
  return customers.map((c) => ({ ...c }))
}

function resolveCustomerName(customerId: number): string {
  const customer = customers.find((c) => c.id === customerId)
  if (customer) return customer.company ? `${customer.company} (${customer.full_name})` : customer.full_name
  const user = findUserById(customerId)
  if (user) return user.full_name
  return `Customer #${customerId}`
}

export function computeSubscriptionDetail(sub: Subscription, todayStr: DateStr): SubscriptionDetail {
  const plan = getPlan(sub.plan_id)
  const customerName = resolveCustomerName(sub.customer_id)

  const lines = subscriptionLines.filter((l) => l.subscription_id === sub.id)
  const detailLines: SubscriptionDetailLine[] = lines.map((line) => {
    const product = getProduct(line.product_id)
    const variant = line.variant_id
      ? product?.variants.find((v) => v.id === line.variant_id)
      : undefined
    const taxRule = line.tax_id ? getTaxRule(line.tax_id) : undefined
    const taxPercent = taxRule?.rate_percent ?? 18

    const discountRule = line.discount_id
      ? getDiscountRule(line.discount_id)
      : sub.discount_id
        ? getDiscountRule(sub.discount_id)
        : undefined

    const discountInput: DiscountInput | null = discountRule
      ? {
          type: discountRule.discount_type,
          value: discountRule.value,
          min_qty: discountRule.min_qty,
          min_purchase: discountRule.min_purchase,
          uses_left:
            discountRule.max_uses !== null
              ? Math.max(0, discountRule.max_uses - discountRule.current_uses)
              : 9999,
          valid_from: discountRule.valid_from,
          valid_until: discountRule.valid_until,
        }
      : null

    const basePrice = product?.sales_price ?? line.unit_price
    const variantExtra = variant?.price_extra ?? 0

    const calc = calculateLineItem(
      basePrice,
      variantExtra,
      line.quantity,
      taxPercent,
      discountInput,
      todayStr,
    )

    return {
      product_id: line.product_id,
      product_name: product?.name ?? 'Unknown Product',
      variant_name: variant ? `${variant.attribute_name}: ${variant.attribute_value}` : null,
      quantity: line.quantity,
      unit_price: calc.unit_price,
      discount_amount: calc.discount_amount,
      discount_applied: calc.discount_applied,
      tax_percent: taxPercent,
      tax_amount: calc.tax_amount,
      line_total: calc.line_total,
    }
  })

  const subtotal = sumLines(detailLines, (l) => roundHalfUp2(l.unit_price * l.quantity))
  const line_discount_total = sumLines(detailLines, (l) => l.discount_amount)
  const subscription_discount = 0
  const total_discount = line_discount_total + subscription_discount
  const total_tax = sumLines(detailLines, (l) => l.tax_amount)
  const grand_total = sumLines(detailLines, (l) => l.line_total)

  const summary: SubscriptionSummary = {
    subtotal,
    line_discount_total,
    subscription_discount,
    total_discount,
    total_tax,
    grand_total,
  }

  return {
    id: sub.id,
    sub_number: sub.sub_number,
    customer_id: sub.customer_id,
    customer_name: customerName,
    plan_id: sub.plan_id,
    plan_name: plan?.name ?? 'Custom Plan',
    billing_frequency: plan?.billing_frequency ?? 'MONTHLY',
    status: sub.status,
    start_date: sub.start_date,
    next_billing_date: sub.next_billing_date ?? sub.start_date,
    expiry_date: sub.expiry_date,
    paused_at: sub.paused_at,
    plan_permissions: {
      auto_close: plan?.auto_close ?? false,
      can_close_early: plan?.can_close_early ?? true,
      can_pause: plan?.can_pause ?? true,
      can_renew: plan?.can_renew ?? true,
    },
    lines: detailLines,
    summary,
  }
}

export function listSubscriptions(
  query?: { customer_id?: number; status?: SubscriptionStatus; q?: string },
  todayStr: DateStr = '2026-10-31',
): SubscriptionListItem[] {
  let list = subscriptions

  if (query?.customer_id) {
    list = list.filter((s) => s.customer_id === query.customer_id)
  }

  if (query?.status) {
    list = list.filter((s) => s.status === query.status)
  }

  return list
    .map((sub) => {
      const detail = computeSubscriptionDetail(sub, todayStr)
      return {
        id: sub.id,
        sub_number: sub.sub_number,
        customer_name: detail.customer_name,
        plan_name: detail.plan_name,
        billing_frequency: detail.billing_frequency,
        status: sub.status,
        next_billing_date: detail.next_billing_date,
        expiry_date: detail.expiry_date,
        grand_total: detail.summary.grand_total,
      }
    })
    .filter((item) => {
      if (!query?.q) return true
      const needle = query.q.toLowerCase()
      return (
        item.sub_number.toLowerCase().includes(needle) ||
        item.customer_name.toLowerCase().includes(needle) ||
        item.plan_name.toLowerCase().includes(needle)
      )
    })
}

export function getSubscription(id: number, todayStr: DateStr = '2026-10-31'): SubscriptionDetail | undefined {
  const sub = subscriptions.find((s) => s.id === id)
  if (!sub) return undefined
  return computeSubscriptionDetail(sub, todayStr)
}

export function transitionSubscription(
  id: number,
  target_status: SubscriptionStatus,
  todayStr: DateStr = '2026-10-31',
): { success: boolean; detail?: SubscriptionDetail; error?: string } {
  const sub = subscriptions.find((s) => s.id === id)
  if (!sub) return { success: false, error: 'Subscription not found' }

  const plan = getPlan(sub.plan_id)
  const planFlags = {
    auto_close: plan?.auto_close ?? false,
    can_close_early: plan?.can_close_early ?? true,
    can_pause: plan?.can_pause ?? true,
    can_renew: plan?.can_renew ?? true,
  }

  const check = checkSubscriptionTransition(
    sub.status,
    target_status,
    planFlags,
    sub.next_billing_date,
    sub.expiry_date,
    sub.paused_at,
    todayStr,
  )

  if (!check.allowed) {
    return { success: false, error: check.error ?? 'Transition not allowed' }
  }

  sub.status = check.next_status
  sub.next_billing_date = check.next_billing_date
  sub.expiry_date = check.expiry_date
  sub.paused_at = check.paused_at

  return { success: true, detail: computeSubscriptionDetail(sub, todayStr) }
}

export interface CreateFromTemplateInput {
  template_id: number
  customer_id: number
  start_date: DateStr
  payment_terms_days?: number
  lines?: {
    product_id: number
    variant_id: number | null
    quantity: number
  }[]
}

export function createSubscriptionFromTemplate(
  input: CreateFromTemplateInput,
  todayStr: DateStr = '2026-10-31',
): SubscriptionDetail {
  const template = getQuotationTemplate(input.template_id)
  if (!template) throw new Error('Quotation template not found')

  const plan = getPlan(template.plan_id)
  if (!plan) throw new Error('Plan not found for template')

  const newId = nextSubId++
  const pad = (n: number) => n.toString().padStart(4, '0')
  const subNumber = `SUB-2026-${pad(newId)}`

  const startDate = input.start_date || todayStr
  const nextBilling = addCycle(startDate, plan.billing_frequency)
  const expiryDate = template.validity_days ? addDays(startDate, template.validity_days * 12) : null

  const newSub: Subscription = {
    id: newId,
    sub_number: subNumber,
    customer_id: input.customer_id,
    plan_id: template.plan_id,
    discount_id: null,
    status: 'DRAFT',
    start_date: startDate,
    next_billing_date: nextBilling,
    expiry_date: expiryDate,
    paused_at: null,
    payment_terms_days: input.payment_terms_days ?? 15,
  }

  subscriptions.push(newSub)

  const templateLineItems = input.lines && input.lines.length > 0 ? input.lines : template.lines
  for (const tLine of templateLineItems) {
    const product = getProduct(tLine.product_id)
    const variant = tLine.variant_id
      ? product?.variants.find((v) => v.id === tLine.variant_id)
      : undefined
    const unitPrice = (product?.sales_price ?? 1000) + (variant?.price_extra ?? 0)

    subscriptionLines.push({
      id: nextLineId++,
      subscription_id: newId,
      product_id: tLine.product_id,
      variant_id: tLine.variant_id ?? null,
      tax_id: 1, // GST 18%
      discount_id: null,
      quantity: tLine.quantity,
      unit_price: unitPrice,
    })
  }

  return computeSubscriptionDetail(newSub, todayStr)
}

export function toggleAddon(
  subscriptionId: number,
  productId: number,
  variantId: number | null,
  enabled: boolean,
  todayStr: DateStr = '2026-10-31',
): SubscriptionDetail {
  const sub = subscriptions.find((s) => s.id === subscriptionId)
  if (!sub) throw new Error('Subscription not found')

  if (enabled) {
    const product = getProduct(productId)
    const variant = variantId ? product?.variants.find((v) => v.id === variantId) : undefined
    const unitPrice = (product?.sales_price ?? 0) + (variant?.price_extra ?? 0)

    subscriptionLines.push({
      id: nextLineId++,
      subscription_id: subscriptionId,
      product_id: productId,
      variant_id: variantId,
      tax_id: 1,
      discount_id: null,
      quantity: 1,
      unit_price: unitPrice,
    })
  } else {
    subscriptionLines = subscriptionLines.filter(
      (l) => !(l.subscription_id === subscriptionId && l.product_id === productId),
    )
  }

  return computeSubscriptionDetail(sub, todayStr)
}
