/**
 * The single data-access surface for the UI.
 *
 * Components import ONLY from this module. Flipping USE_MOCK (via
 * VITE_USE_MOCK=false) swaps every call to the FastAPI backend with zero
 * component changes.
 */
import type {
  AppNotification,
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
  TaxRule,
  User,
} from '@/types/contracts'
import type { CustomerUser } from '@/mocks/subscriptions.fixtures'
import * as live from './live.adapter'
import * as mock from './mock.adapter'
import type {
  AddStaffInput,
  CreateFromTemplateInput,
  DiscountRuleInput,
  LoginInput,
  PlanInput,
  ProductInput,
  ProductVariantInput,
  QuotationTemplateInput,
  ResetLinkResult,
  SignupInput,
  SubscriptionQuery,
  TaxRuleInput,
  ToggleAddonInput,
  TransitionSubscriptionInput,
} from './types'

export { ApiError } from './types'
export type {
  AddStaffInput,
  CreateFromTemplateInput,
  DiscountRuleInput,
  LoginInput,
  PlanInput,
  ProductInput,
  ProductVariantInput,
  QuotationTemplateInput,
  ResetLinkResult,
  SignupInput,
  SubscriptionQuery,
  TaxRuleInput,
  ToggleAddonInput,
  TransitionSubscriptionInput,
} from './types'

export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

function route<T>(mockCall: () => Promise<T>, liveCall: () => Promise<T>): Promise<T> {
  return USE_MOCK ? mockCall() : liveCall()
}

export function login(input: LoginInput): Promise<SessionUser> {
  return route(() => mock.login(input), () => live.login(input))
}

export function signup(input: SignupInput): Promise<SessionUser> {
  return route(() => mock.signup(input), () => live.signup(input))
}

export function logout(): Promise<void> {
  return route(() => mock.logout(), () => live.logout())
}

export function requestPasswordReset(email: string): Promise<ResetLinkResult> {
  return route(() => mock.requestPasswordReset(email), () => live.requestPasswordReset(email))
}

export function getDemoAccounts(): Promise<DemoAccount[]> {
  return route(() => mock.getDemoAccounts(), () => live.getDemoAccounts())
}

export function listNotifications(): Promise<AppNotification[]> {
  return route(() => mock.listNotifications(), () => live.listNotifications())
}

export function markNotificationsRead(): Promise<void> {
  return route(() => mock.markNotificationsRead(), () => live.markNotificationsRead())
}

export function sessionForRole(role: Role): Promise<SessionUser> {
  return route(() => mock.sessionForRole(role), () => live.sessionForRole(role))
}

export function resetDemoData(): Promise<void> {
  return route(() => mock.resetDemoData(), () => live.resetDemoData())
}

/* ------------------------------------------------------------------ */
/* Catalog & rules                                                     */
/* ------------------------------------------------------------------ */

export function listProducts(): Promise<ProductWithVariants[]> {
  return route(() => mock.listProducts(), () => live.listProducts())
}

export function createProduct(input: ProductInput): Promise<Product> {
  return route(() => mock.createProduct(input), () => live.createProduct(input))
}

export function updateProduct(id: number, input: ProductInput): Promise<Product> {
  return route(() => mock.editProduct(id, input), () => live.editProduct(id, input))
}

export function deleteProduct(id: number): Promise<void> {
  return route(() => mock.removeProduct(id), () => live.removeProduct(id))
}

export function createProductVariant(
  productId: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  return route(
    () => mock.createProductVariant(productId, input),
    () => live.createProductVariant(productId, input),
  )
}

export function updateProductVariant(
  id: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  return route(
    () => mock.editProductVariant(id, input),
    () => live.editProductVariant(id, input),
  )
}

export function deleteProductVariant(id: number): Promise<void> {
  return route(() => mock.removeProductVariant(id), () => live.removeProductVariant(id))
}

export function listPlans(): Promise<Plan[]> {
  return route(() => mock.listPlans(), () => live.listPlans())
}

export function createPlan(input: PlanInput): Promise<Plan> {
  return route(() => mock.createPlan(input), () => live.createPlan(input))
}

export function updatePlan(id: number, input: PlanInput): Promise<Plan> {
  return route(() => mock.editPlan(id, input), () => live.editPlan(id, input))
}

export function deletePlan(id: number): Promise<void> {
  return route(() => mock.removePlan(id), () => live.removePlan(id))
}

export function listTaxRules(): Promise<TaxRule[]> {
  return route(() => mock.listTaxRules(), () => live.listTaxRules())
}

export function createTaxRule(input: TaxRuleInput): Promise<TaxRule> {
  return route(() => mock.createTaxRule(input), () => live.createTaxRule(input))
}

export function updateTaxRule(id: number, input: TaxRuleInput): Promise<TaxRule> {
  return route(() => mock.editTaxRule(id, input), () => live.editTaxRule(id, input))
}

export function deleteTaxRule(id: number): Promise<void> {
  return route(() => mock.removeTaxRule(id), () => live.removeTaxRule(id))
}

export function listDiscountRules(): Promise<DiscountRule[]> {
  return route(() => mock.listDiscountRules(), () => live.listDiscountRules())
}

export function createDiscountRule(input: DiscountRuleInput): Promise<DiscountRule> {
  return route(() => mock.createDiscountRule(input), () => live.createDiscountRule(input))
}

export function updateDiscountRule(id: number, input: DiscountRuleInput): Promise<DiscountRule> {
  return route(() => mock.editDiscountRule(id, input), () => live.editDiscountRule(id, input))
}

export function deleteDiscountRule(id: number): Promise<void> {
  return route(() => mock.removeDiscountRule(id), () => live.removeDiscountRule(id))
}

export function listQuotationTemplates(): Promise<QuotationTemplateDetail[]> {
  return route(() => mock.listQuotationTemplates(), () => live.listQuotationTemplates())
}

export function createQuotationTemplate(
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  return route(
    () => mock.createQuotationTemplate(input),
    () => live.createQuotationTemplate(input),
  )
}

export function updateQuotationTemplate(
  id: number,
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  return route(
    () => mock.editQuotationTemplate(id, input),
    () => live.editQuotationTemplate(id, input),
  )
}

export function deleteQuotationTemplate(id: number): Promise<void> {
  return route(
    () => mock.removeQuotationTemplate(id),
    () => live.removeQuotationTemplate(id),
  )
}

/* ------------------------------------------------------------------ */
/* Subscriptions & quotations (Contract A)                             */
/* ------------------------------------------------------------------ */

export function listSubscriptions(q?: SubscriptionQuery): Promise<SubscriptionListItem[]> {
  return route(() => mock.listSubscriptions(q), () => live.listSubscriptions(q))
}

export function getSubscription(id: number): Promise<SubscriptionDetail> {
  return route(() => mock.getSubscription(id), () => live.getSubscription(id))
}

export function transitionSubscription(
  input: TransitionSubscriptionInput,
): Promise<SubscriptionDetail> {
  return route(() => mock.transitionSubscription(input), () => live.transitionSubscription(input))
}

export function createSubscriptionFromTemplate(
  input: CreateFromTemplateInput,
): Promise<SubscriptionDetail> {
  return route(
    () => mock.createSubscriptionFromTemplate(input),
    () => live.createSubscriptionFromTemplate(input),
  )
}

export function toggleAddon(input: ToggleAddonInput): Promise<SubscriptionDetail> {
  return route(() => mock.toggleAddon(input), () => live.toggleAddon(input))
}

export function listCustomers(): Promise<CustomerUser[]> {
  return route(() => mock.listCustomers(), () => live.listCustomers())
}

/* ------------------------------------------------------------------ */
/* Staff team management                                               */
/* ------------------------------------------------------------------ */

export function listStaff(): Promise<User[]> {
  return route(() => mock.listStaff(), () => live.listStaff())
}

export function addStaff(input: AddStaffInput): Promise<User> {
  return route(() => mock.addStaff(input), () => live.addStaff(input))
}

