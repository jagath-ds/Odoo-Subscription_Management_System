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

export interface AuthApi {
  login(input: LoginInput): Promise<SessionUser>
  signup(input: SignupInput): Promise<SessionUser>
  requestPasswordReset(email: string): Promise<ResetLinkResult>
  getDemoAccounts(): Promise<DemoAccount[]>
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>
  sessionForRole(role: Role): Promise<SessionUser>
}
