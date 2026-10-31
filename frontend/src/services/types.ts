import type {
  AppNotification,
  DemoAccount,
  Role,
  SessionUser,
} from '@/types/contracts'

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_INPUT'
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

export interface ResetLinkResult {
  sent: boolean
  email: string
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
