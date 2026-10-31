import { CalendarClock, FileText, Layers, ScrollText, Wallet, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { PhasePlaceholder } from '@/components/common/PhasePlaceholder'

export function BillingDayPage() {
  return (
    <PhasePlaceholder
      phase="Phase 4"
      title="Billing Day"
      description="Simulate the billing date, run the batch, and watch invoices generate without ever billing twice."
      icon={CalendarClock}
      bullets={[
        'Simulate Billing Date picker driving the global clock',
        'Run Billing Day Batch with a five-stage pipeline animation',
        'Run Ledger showing BILL / SKIP / AUTO_CLOSE decisions per subscription',
        'Idempotency proof: pressing Run twice creates zero duplicate invoices',
      ]}
    />
  )
}

export function SubscriptionsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Subscriptions"
      description="Every subscription with its number, customer, plan, next billing date and status chevron ribbon."
      icon={Layers}
      bullets={[
        'Status flow: DRAFT → QUOTATION → CONFIRMED → ACTIVE → PAUSED / CLOSED',
        'Plan-flag gated actions with tooltips explaining disabled buttons',
        'Pause and resume with exact calendar date shift',
        'Renewals due within 30 days',
      ]}
    />
  )
}

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title={`Subscription ${id ?? ''}`}
      description="Contract A: customer, plan, permissions, order lines and totals for a single subscription."
      icon={Layers}
      bullets={[
        'Header card with plan permissions and next billing date',
        'Order lines with variant, discount and tax per line',
        'Summary: subtotal, discounts, tax, grand total',
        'Pause / close / renew actions enforced by the mirrored engine',
      ]}
      backTo={{ label: 'All subscriptions', to: '/subscriptions' }}
    />
  )
}

export function NewQuotationPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Create from Quotation Template"
      description="Start a subscription from a preset plan and product lines, valid for a fixed number of days."
      icon={ScrollText}
      bullets={[
        'Template picker with plan and product lines pre-filled',
        'Editable quantities, variants and tax rules',
        'Validity window and payment terms',
        'Converts to a CONFIRMED subscription with its own number',
      ]}
    />
  )
}

export function InvoicesPage() {
  return (
    <PhasePlaceholder
      phase="Phase 4"
      title="Invoices"
      description="Invoice snapshots, paid vs outstanding status, and the overdue chase list."
      icon={FileText}
      bullets={[
        'Server-style pagination over 6,000 seeded invoices',
        'Filters: status, due-date range, customer search',
        'Send Reminder action per overdue invoice',
        'Snapshot immutability — editing a product never rewrites history',
      ]}
    />
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PhasePlaceholder
      phase="Phase 4"
      title={`Invoice ${id ?? ''}`}
      description="Contract B: printable invoice document with snapshot lines, taxes and payment history."
      icon={FileText}
      bullets={[
        'Printable document with a dedicated print stylesheet',
        'Record Payment modal: method, amount, date, note',
        'CONFIRMED → PARTIALLY_PAID → PAID transitions',
        'Overpayment is refused by the engine, not the form',
      ]}
      backTo={{ label: 'All invoices', to: '/invoices' }}
    />
  )
}

export function PaymentsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 4"
      title="Payments"
      description="Every payment recorded against an invoice, with method, date and note."
      icon={Wallet}
      bullets={[
        'UPI, Bank Transfer, Card and Cash methods',
        'Payment history per invoice',
        'Collected vs outstanding reconciliation',
        'Amount due recomputed after each payment',
      ]}
    />
  )
}

export function TeamPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Staff Members"
      description="Only an Admin can add Staff. Customers never see this surface."
      icon={Users}
      bullets={[
        'Add Staff Member dialog with the same password policy',
        'Unique email enforced before submit',
        'Role assignment: ADMIN or STAFF only',
        'Audit of who can run billing and chase payments',
      ]}
    />
  )
}
