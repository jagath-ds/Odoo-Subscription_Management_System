import type { AppNotification, DateStr, DemoAccount, Role, SessionUser } from '@/types/contracts'

/** The simulated "today" for the demo. Phase 4 moves this with the time machine. */
function localToday(): DateStr {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Mock mode keeps a fixed demo date; live mode uses the real calendar date.
export const DEMO_TODAY: DateStr =
  (import.meta.env.VITE_USE_MOCK ?? 'false') === 'true' ? '2026-10-31' : localToday()

export const DEMO_PASSWORD = 'Brightloop@123'

export interface DemoUser extends SessionUser {
  password: string
  created_at: DateStr
  reset_token: string | null
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 1,
    email: 'admin@brightloop.local',
    full_name: 'Ananya Rao',
    role: 'ADMIN',
    password: DEMO_PASSWORD,
    created_at: '2026-01-08',
    reset_token: null,
  },
  {
    id: 2,
    email: 'staff@brightloop.local',
    full_name: 'Karan Mehta',
    role: 'STAFF',
    password: DEMO_PASSWORD,
    created_at: '2026-02-14',
    reset_token: null,
  },
  {
    id: 3,
    email: 'customer@brightloop.local',
    full_name: 'Priya Nair',
    role: 'CUSTOMER',
    password: DEMO_PASSWORD,
    created_at: '2026-03-02',
    reset_token: null,
  },
]

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'ADMIN',
    label: 'Finance Lead',
    full_name: 'Ananya Rao',
    email: 'admin@brightloop.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'STAFF',
    label: 'Staff Operations',
    full_name: 'Karan Mehta',
    email: 'staff@brightloop.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'CUSTOMER',
    label: 'Customer Portal',
    full_name: 'Priya Nair',
    email: 'customer@brightloop.local',
    password: DEMO_PASSWORD,
  },
]

export function demoUserForRole(role: Role): DemoUser {
  const match = DEMO_USERS.find((user) => user.role === role)
  if (!match) throw new Error(`No demo user seeded for role ${role}`)
  return match
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export function seedNotifications(): AppNotification[] {
  return [
    {
      id: 'ntf-overdue-1',
      kind: 'OVERDUE',
      title: 'Invoice INV-2026-0412 is 18 days overdue',
      body: '₹3,020.00 outstanding · Meridian Labs · due 13 Oct 2026',
      href: '/invoices',
      created_at: minutesAgo(9),
      read: false,
    },
    {
      id: 'ntf-renewal-1',
      kind: 'RENEWAL',
      title: 'SUB-0087 renews in 3 days',
      body: 'Annual Enterprise Plan · 12 seats · auto-renew enabled',
      href: '/subscriptions',
      created_at: minutesAgo(42),
      read: false,
    },
    {
      id: 'ntf-overdue-2',
      kind: 'OVERDUE',
      title: 'Invoice INV-2026-0388 is 7 days overdue',
      body: '₹12,600.00 outstanding · Nova Retail · payment terms 15 days',
      href: '/invoices',
      created_at: minutesAgo(95),
      read: false,
    },
    {
      id: 'ntf-discount-1',
      kind: 'DISCOUNT',
      title: '“10% Off 10+ Seats” has 9 uses left',
      body: 'Applies to subscriptions with 10 or more seats until 31 Dec 2026',
      href: '/catalog/discount-rules',
      created_at: minutesAgo(180),
      read: true,
    },
    {
      id: 'ntf-payment-1',
      kind: 'PAYMENT',
      title: '₹2,000.00 received from Meridian Labs',
      body: 'UPI · matched to INV-2026-0391 · partially paid',
      href: '/payments',
      created_at: minutesAgo(260),
      read: true,
    },
  ]
}
