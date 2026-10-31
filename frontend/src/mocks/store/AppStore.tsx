import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { SessionUser } from '@/types/contracts'
import { listNotifications } from '@/services/api'
import type { AppAction } from './actions'
import { appReducer, initialAppState, unreadCount, type AppState } from './reducer'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => void
  unread: number
  refreshNotifications: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const SESSION_KEY = 'brightloop.session'

function readStoredSession(): SessionUser | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionUser> | null
    if (
      !parsed ||
      typeof parsed.id !== 'number' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.full_name !== 'string' ||
      (parsed.role !== 'ADMIN' && parsed.role !== 'STAFF' && parsed.role !== 'CUSTOMER')
    ) {
      return null
    }
    return {
      id: parsed.id,
      email: parsed.email,
      full_name: parsed.full_name,
      role: parsed.role,
    }
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState, (base) => ({
    ...base,
    session: readStoredSession(),
  }))

  const refreshNotifications = useCallback(async () => {
    const notifications = await listNotifications()
    dispatch({ type: 'SET_NOTIFICATIONS', notifications })
  }, [])

  useEffect(() => {
    void refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    try {
      if (state.session) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session))
      } else {
        window.sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {
      // Storage can be unavailable (private mode); the in-memory session still works.
    }
  }, [state.session])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      unread: unreadCount(state.notifications),
      refreshNotifications,
    }),
    [state, refreshNotifications],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used inside <AppProvider>')
  }
  return context
}

export function useSession(): SessionUser | null {
  return useApp().state.session
}
