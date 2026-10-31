import { FileText, Store } from 'lucide-react'
import { PhasePlaceholder } from '@/components/common/PhasePlaceholder'

export function PortalHomePage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="My Subscriptions"
      description="Your own subscriptions, renewal dates and plan details. Customers only ever see their own records."
      icon={Store}
      bullets={[
        'Active, paused and closed subscriptions for this customer',
        'Renewal date and plan permissions in plain language',
        'Toggle add-ons such as WhatsApp Automated Alerts',
        'No access to other customers, invoices or revenue data',
      ]}
    />
  )
}

export function PortalInvoicesPage() {
  return (
    <PhasePlaceholder
      phase="Phase 4"
      title="My Invoices"
      description="Invoices issued to your account, with amount paid and amount still due."
      icon={FileText}
      bullets={[
        'Paid, partially paid and outstanding invoices',
        'Downloadable invoice document',
        'Payment history per invoice',
        'Overdue badge when the due date has passed',
      ]}
    />
  )
}
