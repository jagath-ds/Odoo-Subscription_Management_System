import type { InvoiceLineSnapshot, SubscriptionDetail } from '@/types/contracts'

/**
 * Snapshot Pattern: Copies text names, prices, discounts, and tax rates at
 * billing time so future catalog edits never alter past invoices.
 */
export function buildInvoiceLines(subDetail: SubscriptionDetail): InvoiceLineSnapshot[] {
  return subDetail.lines.map((line) => ({
    product_name_snapshot: line.product_name,
    variant_name_snapshot: line.variant_name,
    quantity: line.quantity,
    unit_price_snapshot: line.unit_price,
    discount_amount: line.discount_amount,
    tax_percent_snapshot: line.tax_percent,
    tax_amount: line.tax_amount,
    line_total: line.line_total,
  }))
}
