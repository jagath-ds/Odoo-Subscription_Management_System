import type {
  AppNotification,
  BillingFrequency,
  DateStr,
  DemoAccount,
  DiscountScope,
  DiscountType,
  ProductType,
  Role,
  SessionUser,
} from '@/types/contracts'

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIVE_NOT_CONFIGURED'
  | 'NETWORK'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput {
  full_name: string
  email: string
  password: string
}

export interface ResetPasswordInput {
  token: string
  new_password: string
}

export interface ResetLinkResult {
  sent: boolean
  email: string
}

/* ------------------------------------------------------------------ */
/* Catalog write payloads — field names match the DB columns           */
/* ------------------------------------------------------------------ */

export interface ProductInput {
  name: string
  product_type: ProductType
  sales_price: number
  cost_price: number
  notes: string | null
  is_active: boolean
}

export interface ProductVariantInput {
  attribute_name: string
  attribute_value: string
  price_extra: number
}

export interface PlanInput {
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

export interface TaxRuleInput {
  name: string
  rate_percent: number
  is_active: boolean
}

export interface DiscountRuleInput {
  name: string
  discount_type: DiscountType
  value: number
  scope: DiscountScope
  min_qty: number
  min_purchase: number
  valid_from: DateStr | null
  valid_until: DateStr | null
  max_uses: number | null
}

export interface QuotationTemplateLineInput {
  product_id: number
  variant_id: number | null
  quantity: number
}

export interface QuotationTemplateInput {
  name: string
  plan_id: number
  validity_days: number
  lines: QuotationTemplateLineInput[]
}

/* ------------------------------------------------------------------ */
/* Subscription & staff payloads                                      */
/* ------------------------------------------------------------------ */

export interface SubscriptionQuery {
  customer_id?: number
  status?: string
  q?: string
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

export interface TransitionSubscriptionInput {
  id: number
  target_status: import('@/types/contracts').SubscriptionStatus
}

export interface ToggleAddonInput {
  subscription_id: number
  product_id: number
  variant_id: number | null
  enabled: boolean
}

export interface AddStaffInput {
  full_name: string
  email: string
  password: string
  role: Role
}

/**
 * Shape returned by `POST /api/auth/login` and `/api/auth/signup` once the
 * backend is live. The adapter also accepts a bare `SessionUser` so the API
 * can evolve without breaking the client.
 */
export interface AuthPayload {
  access_token: string
  token_type: string
  user: SessionUser
}

export interface AuthApi {
  login(input: LoginInput): Promise<SessionUser>
  signup(input: SignupInput): Promise<SessionUser>
  logout(): Promise<void>
  requestPasswordReset(email: string): Promise<ResetLinkResult>
  getDemoAccounts(): Promise<DemoAccount[]>
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>
  sessionForRole(role: Role): Promise<SessionUser>
}
