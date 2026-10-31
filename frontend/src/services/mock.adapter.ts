import type { AppNotification, DemoAccount, Role, SessionUser } from '@/types/contracts'
import { validatePassword } from '@/lib/validation'
import {
  findUserByEmail,
  insertUser,
  listNotifications as listDbNotifications,
  markAllNotificationsRead,
  resetMockDb,
  sessionForRole as buildSessionForRole,
  toSession,
} from '@/mocks/db'
import { DEMO_ACCOUNTS } from '@/mocks/fixtures'
import {
  ApiError,
  type LoginInput,
  type ResetLinkResult,
  type SignupInput,
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
