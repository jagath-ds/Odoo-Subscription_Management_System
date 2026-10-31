import type { AppNotification, SessionUser } from '@/types/contracts'
import { DEMO_TODAY, DEMO_USERS, demoUserForRole, seedNotifications, type DemoUser } from './fixtures'

/**
 * In-memory mock database for the frontend. Mutated only through the mock
 * adapter in services/mock.adapter.ts — components never touch this module.
 */

let users: DemoUser[] = DEMO_USERS.map((user) => ({ ...user }))
let notifications: AppNotification[] = seedNotifications()
let nextUserId = 100

export function findUserByEmail(email: string): DemoUser | undefined {
  const needle = email.trim().toLowerCase()
  return users.find((user) => user.email.toLowerCase() === needle)
}

export function findUserById(id: number): DemoUser | undefined {
  return users.find((user) => user.id === id)
}

export function insertUser(input: {
  email: string
  full_name: string
  password: string
}): DemoUser {
  const user: DemoUser = {
    id: nextUserId++,
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    role: 'CUSTOMER',
    password: input.password,
    created_at: DEMO_TODAY,
    reset_token: null,
  }
  users = [...users, user]
  return user
}

export function toSession(user: DemoUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  }
}

export function sessionForRole(role: SessionUser['role']): SessionUser {
  return toSession(demoUserForRole(role))
}

export function listNotifications(): AppNotification[] {
  return notifications.map((notification) => ({ ...notification }))
}

export function markAllNotificationsRead(): void {
  notifications = notifications.map((notification) => ({ ...notification, read: true }))
}

export function resetMockDb(): void {
  users = DEMO_USERS.map((user) => ({ ...user }))
  notifications = seedNotifications()
  nextUserId = 100
}
