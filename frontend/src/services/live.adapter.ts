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
  TaxRule,
} from '@/types/contracts'
import {
  ApiError,
  type AuthPayload,
  type DiscountRuleInput,
  type LoginInput,
  type PlanInput,
  type ProductInput,
  type ProductVariantInput,
  type QuotationTemplateInput,
  type ResetLinkResult,
  type SignupInput,
  type TaxRuleInput,
} from './types'

/**
 * Live API branch. Member 4 wires this to FastAPI; paths mirror the shared
 * contract exactly. Nothing here is called while VITE_USE_MOCK is true.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'brightloop.token'

export function getAuthToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_KEY, token)
    } else {
      window.sessionStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode); requests just go unauthenticated.
  }
}

function isAuthPayload(value: AuthPayload | SessionUser): value is AuthPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AuthPayload).access_token === 'string' &&
    typeof (value as AuthPayload).user === 'object' &&
    (value as AuthPayload).user !== null
  )
}

function acceptAuth(payload: AuthPayload | SessionUser): SessionUser {
  if (isAuthPayload(payload)) {
    setAuthToken(payload.access_token)
    return payload.user
  }
  return payload
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      'LIVE_NOT_CONFIGURED',
      'VITE_API_BASE_URL is not set. Add it to .env to use the live API.',
    )
  }

  const token = getAuthToken()

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the Brightloop API.')
  }

  if (!response.ok) {
    if (response.status === 401) setAuthToken(null)
    const detail = await response
      .json()
      .then((body: unknown) => (typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : null))
      .catch(() => null)
    throw new ApiError('INVALID_INPUT', detail ?? `Request failed with status ${response.status}.`)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('NETWORK', 'The Brightloop API returned an invalid JSON payload.')
  }
}

export async function login(input: LoginInput): Promise<SessionUser> {
  const payload = await request<AuthPayload | SessionUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return acceptAuth(payload)
}

export async function signup(input: SignupInput): Promise<SessionUser> {
  const payload = await request<AuthPayload | SessionUser>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return acceptAuth(payload)
}

export async function logout(): Promise<void> {
  setAuthToken(null)
}

export async function requestPasswordReset(email: string): Promise<ResetLinkResult> {
  return request<ResetLinkResult>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  return []
}

export async function listNotifications(): Promise<AppNotification[]> {
  return request<AppNotification[]>('/api/notifications')
}

export async function markNotificationsRead(): Promise<void> {
  await request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' })
}

export async function sessionForRole(_role: Role): Promise<SessionUser> {
  throw new ApiError('INVALID_INPUT', 'Role switching is a mock-only demo affordance.')
}

export async function resetDemoData(): Promise<void> {
  throw new ApiError('INVALID_INPUT', 'Demo data reset is a mock-only affordance.')
}

/* ------------------------------------------------------------------ */
/* Catalog & rules                                                     */
/* ------------------------------------------------------------------ */

export async function listProducts(): Promise<ProductWithVariants[]> {
  return request<ProductWithVariants[]>('/api/products')
}

export async function createProduct(input: ProductInput): Promise<Product> {
  return request<Product>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editProduct(id: number, input: ProductInput): Promise<Product> {
  return request<Product>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeProduct(id: number): Promise<void> {
  await request<void>(`/api/products/${id}`, { method: 'DELETE' })
}

export async function createProductVariant(
  productId: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  return request<ProductVariant>(`/api/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editProductVariant(
  id: number,
  input: ProductVariantInput,
): Promise<ProductVariant> {
  return request<ProductVariant>(`/api/variants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeProductVariant(id: number): Promise<void> {
  await request<void>(`/api/variants/${id}`, { method: 'DELETE' })
}

export async function listPlans(): Promise<Plan[]> {
  return request<Plan[]>('/api/plans')
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  return request<Plan>('/api/plans', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editPlan(id: number, input: PlanInput): Promise<Plan> {
  return request<Plan>(`/api/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removePlan(id: number): Promise<void> {
  await request<void>(`/api/plans/${id}`, { method: 'DELETE' })
}

export async function listTaxRules(): Promise<TaxRule[]> {
  return request<TaxRule[]>('/api/tax-rules')
}

export async function createTaxRule(input: TaxRuleInput): Promise<TaxRule> {
  return request<TaxRule>('/api/tax-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editTaxRule(id: number, input: TaxRuleInput): Promise<TaxRule> {
  return request<TaxRule>(`/api/tax-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeTaxRule(id: number): Promise<void> {
  await request<void>(`/api/tax-rules/${id}`, { method: 'DELETE' })
}

export async function listDiscountRules(): Promise<DiscountRule[]> {
  return request<DiscountRule[]>('/api/discount-rules')
}

export async function createDiscountRule(input: DiscountRuleInput): Promise<DiscountRule> {
  return request<DiscountRule>('/api/discount-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editDiscountRule(
  id: number,
  input: DiscountRuleInput,
): Promise<DiscountRule> {
  return request<DiscountRule>(`/api/discount-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeDiscountRule(id: number): Promise<void> {
  await request<void>(`/api/discount-rules/${id}`, { method: 'DELETE' })
}

export async function listQuotationTemplates(): Promise<QuotationTemplateDetail[]> {
  return request<QuotationTemplateDetail[]>('/api/quotation-templates')
}

export async function createQuotationTemplate(
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  return request<QuotationTemplate>('/api/quotation-templates', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function editQuotationTemplate(
  id: number,
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  return request<QuotationTemplate>(`/api/quotation-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeQuotationTemplate(id: number): Promise<void> {
  await request<void>(`/api/quotation-templates/${id}`, { method: 'DELETE' })
}
