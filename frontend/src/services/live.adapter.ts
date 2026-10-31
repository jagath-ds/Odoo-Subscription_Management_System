import type { AppNotification, DemoAccount, Role, SessionUser } from '@/types/contracts'
import { ApiError, type LoginInput, type ResetLinkResult, type SignupInput } from './types'

/**
 * Live API branch. Member 4 wires this to FastAPI; paths mirror the shared
 * contract exactly. Nothing here is called while VITE_USE_MOCK is true.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      'LIVE_NOT_CONFIGURED',
      'VITE_API_BASE_URL is not set. Add it to .env to use the live API.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the Brightloop API.')
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: unknown) => (typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : null))
      .catch(() => null)
    throw new ApiError('INVALID_INPUT', detail ?? `Request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

export async function login(input: LoginInput): Promise<SessionUser> {
  return request<SessionUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function signup(input: SignupInput): Promise<SessionUser> {
  return request<SessionUser>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
