/**
 * The single data-access surface for the UI.
 *
 * Components import ONLY from this module. Flipping USE_MOCK (via
 * VITE_USE_MOCK=false) swaps every call to the FastAPI backend with zero
 * component changes.
 */
import type { AppNotification, DemoAccount, Role, SessionUser } from '@/types/contracts'
import * as live from './live.adapter'
import * as mock from './mock.adapter'
import type { LoginInput, ResetLinkResult, SignupInput } from './types'

export { ApiError } from './types'
export type { LoginInput, SignupInput, ResetLinkResult } from './types'

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
