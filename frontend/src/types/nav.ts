import {
  BadgePercent,
  CalendarClock,
  FileText,
  LayoutDashboard,
  Layers,
  Package,
  ReceiptText,
  ScrollText,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/types/contracts'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles: Role[]
  description: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL: Role[] = ['ADMIN', 'STAFF', 'CUSTOMER']
const INTERNAL: Role[] = ['ADMIN', 'STAFF']
const ADMIN_ONLY: Role[] = ['ADMIN']

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Revenue',
    items: [
      {
        label: 'Finance Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        roles: INTERNAL,
        description: 'MRR, outstanding and overdue at a glance',
      },
      {
        label: 'Billing Day',
        to: '/billing',
        icon: CalendarClock,
        roles: INTERNAL,
        description: 'Run the billing batch and generate invoices',
      },
    ],
  },
  {
    label: 'Subscriptions',
    items: [
      {
        label: 'Subscriptions',
        to: '/subscriptions',
        icon: Layers,
        roles: INTERNAL,
        description: 'Every subscription and its status',
      },
      {
        label: 'Quotations',
        to: '/quotations/new',
        icon: ScrollText,
        roles: INTERNAL,
        description: 'Start a subscription from a quotation template',
      },
    ],
  },
  {
    label: 'Billing',
    items: [
      {
        label: 'Invoices',
        to: '/invoices',
        icon: FileText,
        roles: INTERNAL,
        description: 'Invoices, snapshots and overdue chase',
      },
      {
        label: 'Payments',
        to: '/payments',
        icon: Wallet,
        roles: INTERNAL,
        description: 'Collected payments matched to invoices',
      },
    ],
  },
  {
    label: 'Catalog & Rules',
    items: [
      {
        label: 'Products & Variants',
        to: '/catalog/products',
        icon: Package,
        roles: ADMIN_ONLY,
        description: 'Catalog records, variants and pricing',
      },
      {
        label: 'Plans',
        to: '/catalog/plans',
        icon: Layers,
        roles: ADMIN_ONLY,
        description: 'Billing frequency and plan permissions',
      },
      {
        label: 'Tax Rules',
        to: '/catalog/tax-rules',
        icon: ReceiptText,
        roles: ADMIN_ONLY,
        description: 'Tax rates applied at billing time',
      },
      {
        label: 'Discount Rules',
        to: '/catalog/discount-rules',
        icon: BadgePercent,
        roles: ADMIN_ONLY,
        description: 'Percentage or fixed discounts with limits',
      },
      {
        label: 'Quotation Templates',
        to: '/catalog/quotation-templates',
        icon: ScrollText,
        roles: ADMIN_ONLY,
        description: 'Preset plan and product lines',
      },
    ],
  },
  {
    label: 'Team',
    items: [
      {
        label: 'Staff Members',
        to: '/team',
        icon: Users,
        roles: ADMIN_ONLY,
        description: 'Add and review internal staff access',
      },
    ],
  },
  {
    label: 'Self-Service Portal',
    items: [
      {
        label: 'My Subscriptions',
        to: '/portal',
        icon: Store,
        roles: ALL,
        description: 'Your subscriptions and renewals',
      },
      {
        label: 'My Invoices',
        to: '/portal/invoices',
        icon: FileText,
        roles: ALL,
        description: 'Invoices and payment status',
      },
    ],
  },
]

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}

export function homeForRole(role: Role): string {
  return role === 'CUSTOMER' ? '/portal' : '/dashboard'
}

export function findNavItem(pathname: string): { group: string; item: NavItem } | null {
  const candidates = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ group: group.label, item })),
  ).sort((a, b) => b.item.to.length - a.item.to.length)

  return (
    candidates.find(
      ({ item }) => pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? null
  )
}
