import { BadgePercent, Layers, Package, ReceiptText, ScrollText } from 'lucide-react'
import { PhasePlaceholder } from '@/components/common/PhasePlaceholder'

export function ProductsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Products & Variants"
      description="Catalog records only: name, type, sales price, cost price and variants such as Brand = Odoo (+₹560)."
      icon={Package}
      bullets={[
        'SERVICE and ADDON product types',
        'Variant pricing that feeds unit price at subscription time',
        'Editing a price never touches existing invoice snapshots',
        'Active / inactive catalog records',
      ]}
    />
  )
}

export function PlansPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Plans"
      description="Billing frequency, minimum quantity and the four permissions that gate every subscription action."
      icon={Layers}
      bullets={[
        'DAILY, WEEKLY, MONTHLY and YEARLY billing frequencies',
        'Auto-close at end date, early close, pause, renew toggles',
        'Availability window with minimum quantity',
        'Permissions enforced by the mirrored transition engine',
      ]}
    />
  )
}

export function TaxRulesPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Tax Rules"
      description="Admin-defined rates such as GST 18%, applied at billing time and frozen into the invoice snapshot."
      icon={ReceiptText}
      bullets={[
        'Rate per rule with active / inactive state',
        'Applied per invoice line, never hardcoded',
        'Tax percent stored on the snapshot',
        'Editing a rate does not change issued invoices',
      ]}
    />
  )
}

export function DiscountRulesPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Discount Rules"
      description="Percentage or fixed discounts with minimum quantity, minimum purchase, validity window and usage limit."
      icon={BadgePercent}
      bullets={[
        'PERCENT and FIXED discount types',
        'PRODUCT or SUBSCRIPTION scope',
        'Stops applying when expired or usage limit is reached',
        'Usage counter increments once per billed invoice',
      ]}
    />
  )
}

export function QuotationTemplatesPage() {
  return (
    <PhasePlaceholder
      phase="Phase 3"
      title="Quotation Templates"
      description="Preset plan and product lines that sales reps turn into subscriptions in one step."
      icon={ScrollText}
      bullets={[
        'Template lines: product, optional variant, quantity',
        'Validity in days for the quotation',
        'One template produces many subscriptions',
        'Staff can use templates but never create them',
      ]}
    />
  )
}
