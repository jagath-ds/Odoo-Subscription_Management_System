import type {
  AppNotification,
  DateStr,
  DemoAccount,
  DiscountRule,
  Plan,
  Product,
  ProductVariant,
  ProductWithVariants,
  QuotationTemplate,
  QuotationTemplateDetail,
  Role,
  SessionUser,
  SubscriptionDetail,
  SubscriptionListItem,
  SubscriptionStatus,
  TaxRule,
  User,
} from '@/types/contracts'
import { roundMoney } from '@/lib/format'
import { validatePassword } from '@/lib/validation'
import {
  deleteDiscountRule as deleteDiscountRuleRecord,
  deletePlan as deletePlanRecord,
  deleteProduct as deleteProductRecord,
  deleteQuotationTemplate as deleteQuotationTemplateRecord,
  deleteTaxRule as deleteTaxRuleRecord,
  deleteVariant as deleteVariantRecord,
  getProduct,
  insertDiscountRule,
  insertPlan,
  insertProduct,
  insertQuotationTemplate,
  insertTaxRule,
  insertVariant,
  listDiscountRules as listDiscountRuleRecords,
  listPlans as listPlanRecords,
  listProducts as listProductRecords,
  listQuotationTemplates as listQuotationTemplateRecords,
  listTaxRules as listTaxRuleRecords,
  templateUsageForPlan,
  templateUsageForProduct,
  updateDiscountRule,
  updatePlan,
  updateProduct,
  updateQuotationTemplate,
  updateTaxRule,
  updateVariant,
} from '@/mocks/catalogDb'
import {
  findUserByEmail,
  insertStaff,
  insertUser,
  listNotifications as listDbNotifications,
  listStaff as listStaffDb,
  markAllNotificationsRead,
  resetMockDb,
  sessionForRole as buildSessionForRole,
  toSession,
} from '@/mocks/db'
import {
  createSubscriptionFromTemplate as createSubFromTemplateDb,
  getSubscription as getSubDb,
  listCustomers as listCustomersDb,
  listSubscriptions as listSubsDb,
  toggleAddon as toggleAddonDb,
  transitionSubscription as transitionSubDb,
} from '@/mocks/subscriptionDb'
import type { CustomerUser } from '@/mocks/subscriptions.fixtures'
import { DEMO_ACCOUNTS, DEMO_TODAY } from '@/mocks/fixtures'
import {
  ApiError,
  type AddStaffInput,
  type CreateFromTemplateInput,
  type DiscountRuleInput,
  type LoginInput,
  type PlanInput,
  type ProductInput,
  type ProductVariantInput,
  type QuotationTemplateInput,
  type ResetLinkResult,
  type SignupInput,
  type SubscriptionQuery,
  type TaxRuleInput,
  type ToggleAddonInput,
  type TransitionSubscriptionInput,
} from './types'

const MIN_LATENCY_MS = 180
const MAX_LATENCY_MS = 340

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function latency(): Promise<void> {
  const jitter = Math.round(MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS))
  await sleep(jitter)
}

export async function login(input: LoginInput): Promise<SessionUser> {
  await latency()
  const user = findUserByEmail(input.email)
  if (!user || user.password !== input.password) {
    throw new ApiError('INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }
  return toSession(user)
}

export async function signup(input: SignupInput): Promise<SessionUser> {
  await latency()
  const email = input.email.trim().toLowerCase()
  if (!input.full_name.trim()) {
    throw new ApiError('INVALID_INPUT', 'Enter your full name.')
  }
  if (findUserByEmail(email)) {
    throw new ApiError('EMAIL_TAKEN', 'An account already exists for this email.')
  }
  const passwordCheck = validatePassword(input.password)
  if (!passwordCheck.valid) {
    throw new ApiError('WEAK_PASSWORD', `Password needs: ${passwordCheck.failed.join(', ')}.`)
  }
  const user = insertUser({ email, full_name: input.full_name, password: input.password })
  return toSession(user)
}

export async function logout(): Promise<void> {
  await sleep(20)
}

export async function requestPasswordReset(email: string): Promise<ResetLinkResult> {
  await latency()
  await sleep(500)
  return { sent: true, email: email.trim().toLowerCase() }
}

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  await sleep(60)
  return DEMO_ACCOUNTS.map((account) => ({ ...account }))
}

export async function listNotifications(): Promise<AppNotification[]> {
  await sleep(80)
  return listDbNotifications()
}

export async function markNotificationsRead(): Promise<void> {
  await sleep(60)
  markAllNotificationsRead()
}

export async function sessionForRole(role: Role): Promise<SessionUser> {
  await sleep(90)
  return buildSessionForRole(role)
}

export async function resetDemoData(): Promise<void> {
  await sleep(200)
  resetMockDb()
}

/* ------------------------------------------------------------------ */
/* Catalog validation helpers                                          */
/* ------------------------------------------------------------------ */

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ApiError('INVALID_INPUT', `${label} is required.`)
  }
  return trimmed
}

function requireNumber(
  value: number,
  label: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  if (!Number.isFinite(value)) {
    throw new ApiError('INVALID_INPUT', `${label} must be a number.`)
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new ApiError('INVALID_INPUT', `${label} must be a whole number.`)
  }
  if (options.min !== undefined && value < options.min) {
    throw new ApiError('INVALID_INPUT', `${label} must be at least ${options.min}.`)
  }
  if (options.max !== undefined && value > options.max) {
    throw new ApiError('INVALID_INPUT', `${label} must be at most ${options.max}.`)
  }
  return value
}

function requireUnique(
  rows: Array<{ id: number; name: string }>,
  name: string,
  label: string,
  ignoreId?: number,
): void {
  const needle = name.trim().toLowerCase()
  const clash = rows.find(
    (row) => row.id !== ignoreId && row.name.trim().toLowerCase() === needle,
  )
  if (clash) {
    throw new ApiError('CONFLICT', `${label} "${name.trim()}" already exists.`)
  }
}

function normalizeDate(value: DateStr | null): DateStr | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function assertDateWindow(
  from: DateStr | null,
  until: DateStr | null,
  label: string,
): void {
  if (from && until && from > until) {
    throw new ApiError('INVALID_INPUT', `${label} cannot start after it ends.`)
  }
}

function validateProductInput(input: ProductInput, ignoreId?: number): ProductInput {
  const name = requireText(input.name, 'Product name')
  requireUnique(listProductRecords(), name, 'Product', ignoreId)
  return {
    name,
    product_type: input.product_type,
    sales_price: roundMoney(requireNumber(input.sales_price, 'Sales price', { min: 0 })),
    cost_price: roundMoney(requireNumber(input.cost_price, 'Cost price', { min: 0 })),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    is_active: input.is_active,
  }
}

function validateVariantInput(
  productId: number,
  input: ProductVariantInput,
  ignoreId?: number,
): ProductVariantInput {
  const attributeName = requireText(input.attribute_name, 'Attribute name')
  const attributeValue = requireText(input.attribute_value, 'Attribute value')
  const product = getProduct(productId)
  const duplicate = product?.variants.find(
    (variant) =>
      variant.id !== ignoreId &&
      variant.attribute_name.trim().toLowerCase() === attributeName.toLowerCase() &&
      variant.attribute_value.trim().toLowerCase() === attributeValue.toLowerCase(),
  )
  if (duplicate) {
    throw new ApiError(
      'CONFLICT',
      `Variant "${attributeName}: ${attributeValue}" already exists for this product.`,
    )
  }
  return {
    attribute_name: attributeName,
    attribute_value: attributeValue,
    price_extra: roundMoney(requireNumber(input.price_extra, 'Price extra', { min: 0 })),
  }
}

function validatePlanInput(input: PlanInput, ignoreId?: number): PlanInput {
  const name = requireText(input.name, 'Plan name')
  requireUnique(listPlanRecords(), name, 'Plan', ignoreId)
  const availableFrom = normalizeDate(input.available_from)
  const availableUntil = normalizeDate(input.available_until)
  assertDateWindow(availableFrom, availableUntil, 'Availability window')
  return {
    name,
    billing_frequency: input.billing_frequency,
    plan_price: roundMoney(requireNumber(input.plan_price, 'Plan price', { min: 0 })),
    min_qty: requireNumber(input.min_qty, 'Minimum quantity', { min: 1, integer: true }),
    available_from: availableFrom,
    available_until: availableUntil,
    auto_close: input.auto_close,
    can_close_early: input.can_close_early,
    can_pause: input.can_pause,
    can_renew: input.can_renew,
  }
}

function validateTaxRuleInput(input: TaxRuleInput, ignoreId?: number): TaxRuleInput {
  const name = requireText(input.name, 'Tax name')
  requireUnique(listTaxRuleRecords(), name, 'Tax rule', ignoreId)
  return {
    name,
    rate_percent: roundMoney(
      requireNumber(input.rate_percent, 'Tax rate', { min: 0, max: 100 }),
    ),
    is_active: input.is_active,
  }
}

function validateDiscountRuleInput(
  input: DiscountRuleInput,
  ignoreId?: number,
): DiscountRuleInput {
  const name = requireText(input.name, 'Discount name')
  requireUnique(listDiscountRuleRecords(), name, 'Discount rule', ignoreId)
  const value = requireNumber(input.value, 'Discount value', { min: 0.01 })
  if (input.discount_type === 'PERCENT' && value > 100) {
    throw new ApiError('INVALID_INPUT', 'A percentage discount cannot exceed 100%.')
  }
  const validFrom = normalizeDate(input.valid_from)
  const validUntil = normalizeDate(input.valid_until)
  assertDateWindow(validFrom, validUntil, 'Validity window')

  const existing = ignoreId
    ? listDiscountRuleRecords().find((rule) => rule.id === ignoreId)
    : undefined
  const maxUses =
    input.max_uses === null
      ? null
      : requireNumber(input.max_uses, 'Maximum uses', { min: 1, integer: true })
  if (maxUses !== null && existing && maxUses < existing.current_uses) {
    throw new ApiError(
      'INVALID_INPUT',
      `Maximum uses cannot be below the ${existing.current_uses} uses already recorded.`,
    )
  }

  return {
    name,
    discount_type: input.discount_type,
    value: input.discount_type === 'FIXED' ? roundMoney(value) : value,
    scope: input.scope,
    min_qty: requireNumber(input.min_qty, 'Minimum quantity', { min: 1, integer: true }),
    min_purchase: roundMoney(
      requireNumber(input.min_purchase, 'Minimum purchase', { min: 0 }),
    ),
    valid_from: validFrom,
    valid_until: validUntil,
    max_uses: maxUses,
  }
}

function validateTemplateInput(
  input: QuotationTemplateInput,
  ignoreId?: number,
): QuotationTemplateInput {
  const name = requireText(input.name, 'Template name')
  requireUnique(listQuotationTemplateRecords(), name, 'Template', ignoreId)
  if (!listPlanRecords().some((plan) => plan.id === input.plan_id)) {
    throw new ApiError('INVALID_INPUT', 'Choose a plan for this template.')
  }
  const validityDays = requireNumber(input.validity_days, 'Validity days', {
    min: 1,
    integer: true,
  })
  if (input.lines.length === 0) {
    throw new ApiError('INVALID_INPUT', 'Add at least one product line.')
  }

  const seen = new Set<string>()
  const lines = input.lines.map((line, index) => {
    const product = getProduct(line.product_id)
    if (!product) {
      throw new ApiError('INVALID_INPUT', `Line ${index + 1}: choose a product.`)
    }
    if (line.variant_id !== null) {
      const variant = product.variants.find((candidate) => candidate.id === line.variant_id)
      if (!variant) {
        throw new ApiError(
          'INVALID_INPUT',
          `Line ${index + 1}: that variant does not belong to ${product.name}.`,
        )
      }
    }
    const quantity = requireNumber(line.quantity, `Line ${index + 1} quantity`, {
      min: 1,
      integer: true,
    })
    const key = `${line.product_id}:${line.variant_id ?? 'none'}`
    if (seen.has(key)) {
      throw new ApiError('INVALID_INPUT', `Line ${index + 1} duplicates ${product.name}.`)
    }
    seen.add(key)
    return { product_id: line.product_id, variant_id: line.variant_id, quantity }
  })

  return { name, plan_id: input.plan_id, validity_days: validityDays, lines }
}

/* ------------------------------------------------------------------ */
/* Products & variants                                                 */
/* ------------------------------------------------------------------ */

export async function listProducts(): Promise<ProductWithVariants[]> {
  await sleep(120)
  return listProductRecords()
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await latency()
  return insertProduct(validateProductInput(input))
}

export async function editProduct(id: number, input: ProductInput): Promise<Product> {
  await latency()
  const updated = updateProduct(id, validateProductInput(input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That product no longer exists.')
  return updated
}

export async function removeProduct(id: number): Promise<void> {
  await latency()
  const usage = templateUsageForProduct(id)
  if (usage > 0) {
    throw new ApiError(
      'CONFLICT',
      `This product is used by ${usage} quotation template line${usage === 1 ? '' : 's'}. Remove it from those templates first.`,
    )
  }
  if (!deleteProductRecord(id)) throw new ApiError('NOT_FOUND', 'That product no longer exists.')
}

export async function createProductVariant(
  productId: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  await latency()
  if (!getProduct(productId)) throw new ApiError('NOT_FOUND', 'That product no longer exists.')
  return insertVariant(productId, validateVariantInput(productId, input))
}

export async function editProductVariant(
  id: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  await latency()
  const existing = listProductRecords()
    .flatMap((product) => product.variants)
    .find((variant) => variant.id === id)
  if (!existing) throw new ApiError('NOT_FOUND', 'That variant no longer exists.')
  const updated = updateVariant(id, validateVariantInput(existing.product_id, input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That variant no longer exists.')
  return updated
}

export async function removeProductVariant(id: number): Promise<void> {
  await latency()
  if (!deleteVariantRecord(id)) throw new ApiError('NOT_FOUND', 'That variant no longer exists.')
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export async function listPlans(): Promise<Plan[]> {
  await sleep(110)
  return listPlanRecords()
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  await latency()
  return insertPlan(validatePlanInput(input))
}

export async function editPlan(id: number, input: PlanInput): Promise<Plan> {
  await latency()
  const updated = updatePlan(id, validatePlanInput(input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That plan no longer exists.')
  return updated
}

export async function removePlan(id: number): Promise<void> {
  await latency()
  const usage = templateUsageForPlan(id)
  if (usage > 0) {
    throw new ApiError(
      'CONFLICT',
      `This plan is used by ${usage} quotation template${usage === 1 ? '' : 's'}. Remove it from those templates first.`,
    )
  }
  if (!deletePlanRecord(id)) throw new ApiError('NOT_FOUND', 'That plan no longer exists.')
}

/* ------------------------------------------------------------------ */
/* Tax rules                                                           */
/* ------------------------------------------------------------------ */

export async function listTaxRules(): Promise<TaxRule[]> {
  await sleep(100)
  return listTaxRuleRecords()
}

export async function createTaxRule(input: TaxRuleInput): Promise<TaxRule> {
  await latency()
  return insertTaxRule(validateTaxRuleInput(input))
}

export async function editTaxRule(id: number, input: TaxRuleInput): Promise<TaxRule> {
  await latency()
  const updated = updateTaxRule(id, validateTaxRuleInput(input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That tax rule no longer exists.')
  return updated
}

export async function removeTaxRule(id: number): Promise<void> {
  await latency()
  if (!deleteTaxRuleRecord(id)) throw new ApiError('NOT_FOUND', 'That tax rule no longer exists.')
}

/* ------------------------------------------------------------------ */
/* Discount rules                                                      */
/* ------------------------------------------------------------------ */

export async function listDiscountRules(): Promise<DiscountRule[]> {
  await sleep(110)
  return listDiscountRuleRecords()
}

export async function createDiscountRule(input: DiscountRuleInput): Promise<DiscountRule> {
  await latency()
  return insertDiscountRule(validateDiscountRuleInput(input))
}

export async function editDiscountRule(
  id: number,
  input: DiscountRuleInput,
): Promise<DiscountRule> {
  await latency()
  const updated = updateDiscountRule(id, validateDiscountRuleInput(input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That discount rule no longer exists.')
  return updated
}

export async function removeDiscountRule(id: number): Promise<void> {
  await latency()
  if (!deleteDiscountRuleRecord(id)) {
    throw new ApiError('NOT_FOUND', 'That discount rule no longer exists.')
  }
}

/* ------------------------------------------------------------------ */
/* Quotation templates                                                 */
/* ------------------------------------------------------------------ */

export async function listQuotationTemplates(): Promise<QuotationTemplateDetail[]> {
  await sleep(120)
  return listQuotationTemplateRecords()
}

export async function createQuotationTemplate(
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  await latency()
  return insertQuotationTemplate(validateTemplateInput(input))
}

export async function editQuotationTemplate(
  id: number,
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  await latency()
  const updated = updateQuotationTemplate(id, validateTemplateInput(input, id))
  if (!updated) throw new ApiError('NOT_FOUND', 'That template no longer exists.')
  return updated
}

export async function removeQuotationTemplate(id: number): Promise<void> {
  await latency()
  if (!deleteQuotationTemplateRecord(id)) {
    throw new ApiError('NOT_FOUND', 'That template no longer exists.')
  }
}

/* ------------------------------------------------------------------ */
/* Subscriptions & quotations (Contract A)                             */
/* ------------------------------------------------------------------ */

export async function listSubscriptions(
  q?: SubscriptionQuery,
): Promise<SubscriptionListItem[]> {
  await sleep(150)
  return listSubsDb(
    {
      customer_id: q?.customer_id,
      status: q?.status as SubscriptionStatus | undefined,
      q: q?.q,
    },
    DEMO_TODAY,
  )
}

export async function getSubscription(id: number): Promise<SubscriptionDetail> {
  await latency()
  const detail = getSubDb(id, DEMO_TODAY)
  if (!detail) throw new ApiError('NOT_FOUND', 'Subscription not found.')
  return detail
}

export async function transitionSubscription(
  input: TransitionSubscriptionInput,
): Promise<SubscriptionDetail> {
  await latency()
  const res = transitionSubDb(input.id, input.target_status, DEMO_TODAY)
  if (!res.success || !res.detail) {
    throw new ApiError('CONFLICT', res.error ?? 'Transition not allowed by plan rules.')
  }
  return res.detail
}

export async function createSubscriptionFromTemplate(
  input: CreateFromTemplateInput,
): Promise<SubscriptionDetail> {
  await latency()
  try {
    return createSubFromTemplateDb(input, DEMO_TODAY)
  } catch (err: unknown) {
    throw new ApiError('INVALID_INPUT', err instanceof Error ? err.message : 'Failed to create subscription')
  }
}

export async function toggleAddon(input: ToggleAddonInput): Promise<SubscriptionDetail> {
  await latency()
  try {
    return toggleAddonDb(
      input.subscription_id,
      input.product_id,
      input.variant_id,
      input.enabled,
      DEMO_TODAY,
    )
  } catch (err: unknown) {
    throw new ApiError('INVALID_INPUT', err instanceof Error ? err.message : 'Failed to toggle add-on')
  }
}

export async function listCustomers(): Promise<CustomerUser[]> {
  await sleep(100)
  return listCustomersDb()
}

/* ------------------------------------------------------------------ */
/* Staff team management                                               */
/* ------------------------------------------------------------------ */

export async function listStaff(): Promise<User[]> {
  await sleep(120)
  return listStaffDb()
}

export async function addStaff(input: AddStaffInput): Promise<User> {
  await latency()
  const email = input.email.trim().toLowerCase()
  if (!input.full_name.trim()) {
    throw new ApiError('INVALID_INPUT', 'Enter full name for the staff member.')
  }
  if (findUserByEmail(email)) {
    throw new ApiError('EMAIL_TAKEN', 'An account already exists for this email.')
  }
  const passwordResult = validatePassword(input.password)
  if (!passwordResult.valid) {
    throw new ApiError(
      'WEAK_PASSWORD',
      'Password must be 9+ characters with at least one uppercase letter, one lowercase letter and one special character.',
    )
  }
  return insertStaff({
    email,
    full_name: input.full_name.trim(),
    role: input.role,
    password: input.password,
  })
}

