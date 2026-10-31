import type { AppNotification, DateStr, SessionUser } from '@/types/contracts'
import { DEMO_TODAY } from '@/mocks/fixtures'
import type { AppAction } from './actions'

export interface AppState {
  session: SessionUser | null
  today: DateStr
  notifications: AppNotification[]
  notificationsLoaded: boolean
}

export const initialAppState: AppState = {
  session: null,
  today: DEMO_TODAY,
  notifications: [],
  notificationsLoaded: false,
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.session }
    case 'CLEAR_SESSION':
      return { ...state, session: null }
    case 'SET_TODAY':
      return { ...state, today: action.today }
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.notifications, notificationsLoaded: true }
    case 'MARK_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
      }
    default:
      return state
  }
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((notification) => !notification.read).length
}
