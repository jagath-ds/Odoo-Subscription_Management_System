import type { AppNotification, DateStr, SessionUser } from '@/types/contracts'

export type AppAction =
  | { type: 'SET_SESSION'; session: SessionUser }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_TODAY'; today: DateStr }
  | { type: 'SET_NOTIFICATIONS'; notifications: AppNotification[] }
  | { type: 'MARK_NOTIFICATIONS_READ' }
