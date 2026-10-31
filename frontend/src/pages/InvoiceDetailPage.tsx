import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  Printer,
  Send,
  XCircle,
} from 'lucide-react'
import { RecordPaymentDialog } from '@/components/billing/RecordPaymentDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatINR } from '@/lib/format'
import { useSession } from '@/mocks/store/AppStore'
import {
  cancelInvoice,
  confirmInvoice,
  getInvoice,
  sendInvoice,
} from '@/services/api'
import type { InvoiceDetail } from '@/types/contracts'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCustomer = useSession()?.role === 'CUSTOMER'
  const backTo = isCustomer ? '/portal/invoices' : '/invoices'
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invoiceId = Number(id)

  async function loadData() {
    if (isNaN(invoiceId)) {
      setError('Invalid invoice ID')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getInvoice(invoiceId)
      setInvoice(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load invoice')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [invoiceId])

  async function handleConfirm() {
    if (!invoice) return
    try {
      const updated = await confirmInvoice(invoice.id)
      setInvoice(updated)
      toast.success('Invoice confirmed')
    } catch {
      toast.error('Failed to confirm invoice')
    }
  }

  async function handleCancel() {
    if (!invoice) return
    if (!confirm('Are you sure you want to cancel this invoice?')) return
    try {
      const updated = await cancelInvoice(invoice.id)
      setInvoice(updated)
      toast.info('Invoice cancelled')
    } catch {
      toast.error('Failed to cancel invoice')
    }
  }

  async function handleSend() {
    if (!invoice) return
    try {
      const updated = await sendInvoice(invoice.id)
      setInvoice(updated)
      toast.success(`Invoice dispatched to ${invoice.customer_name}`)
    } catch {
      toast.error('Failed to send invoice')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="p-8 text-center space-y-4">
        <FileText className="mx-auto size-12 text-destructive" />
        <h2 className="text-lg font-bold text-foreground">Invoice Not Found</h2>
        <p className="text-sm text-muted-foreground">{error ?? 'This invoice does not exist.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
          Back to all invoices
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top action bar (hidden on print) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="space-y-1">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="size-3.5" />
            Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {invoice.invoice_number}
            </h1>
            <Badge
              variant="outline"
              className={
                invoice.status === 'PAID'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
                  : invoice.status === 'PARTIALLY_PAID'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold'
                    : invoice.status === 'CANCELLED'
                      ? 'border-zinc-600/40 bg-zinc-800/40 text-zinc-400'
                      : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
              }
            >
              {invoice.status}
            </Badge>
            {invoice.is_overdue && (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/15 text-rose-400 font-semibold">
                OVERDUE
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isCustomer && invoice.status === 'DRAFT' && (
            <Button size="sm" onClick={handleConfirm} className="gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              Confirm Invoice
            </Button>
          )}

          {!isCustomer &&
            invoice.amount_due > 0 &&
            (invoice.status === 'CONFIRMED' || invoice.status === 'PARTIALLY_PAID') && (
            <Button
              size="sm"
              onClick={() => setPaymentDialogOpen(true)}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <CreditCard className="size-3.5" />
              Record Payment
            </Button>
          )}

          {!isCustomer && invoice.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSend}
              className="gap-1.5 text-xs"
            >
              <Send className="size-3.5" />
              Send to Customer
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs"
          >
            <Printer className="size-3.5" />
            Print / PDF
          </Button>

          {!isCustomer &&
            (invoice.status === 'DRAFT' || invoice.status === 'CONFIRMED') &&
            invoice.amount_paid === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <XCircle className="size-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Snapshot Immutability Guarantee Notice (Print hidden) */}
      <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground print:hidden">
        <Lock className="size-4 shrink-0 text-emerald-400" />
        <div>
          <span className="font-semibold text-foreground">Immutable Snapshot Architecture:</span>{' '}
          All product names, variants, prices, and GST rates are frozen snapshots from the billing run. Future catalog price updates will never alter historical accounting data.
        </div>
      </div>

      {/* Printable Invoice Document */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm print:border-none print:shadow-none print:bg-white print:text-black">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/40 pb-6 print:border-zinc-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-emerald-500 print:bg-black" />
                <span className="font-bold text-lg tracking-tight text-foreground print:text-black">
                  BRIGHTLOOP SOFTWARE
                </span>
              </div>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Subscription & Recurring Billing ERP
              </p>
              <p className="text-[11px] text-muted-foreground font-mono print:text-zinc-500">
                GSTIN: 29AABCB1234F1Z8 · Bengaluru, Karnataka, India
              </p>
            </div>

            <div className="sm:text-right space-y-1 font-mono text-xs">
              <p className="text-sm font-bold text-foreground print:text-black">
                {invoice.invoice_number}
              </p>
              <p className="text-muted-foreground print:text-zinc-600">
                Period Key: <span className="font-semibold">{invoice.billing_period_key}</span>
              </p>
              <p className="text-muted-foreground print:text-zinc-600">
                Date Issued: <span className="text-foreground print:text-black">{formatDate(invoice.issue_date)}</span>
              </p>
              <p className="text-muted-foreground print:text-zinc-600">
                Payment Due: <span className="font-semibold text-foreground print:text-black">{formatDate(invoice.due_date)}</span>
              </p>
            </div>
          </div>

          {/* Billed To / Subscription */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-zinc-500">
                Billed To
              </span>
              <p className="text-sm font-bold text-foreground print:text-black">
                {invoice.customer_name}
              </p>
            </div>
            <div className="space-y-1 sm:text-right">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-zinc-500">
                Originating Subscription
              </span>
              <p className="font-mono font-semibold text-primary print:text-black">
                <Link to={`/subscriptions/${invoice.subscription_id}`} className="hover:underline">
                  {invoice.sub_number}
                </Link>
              </p>
            </div>
          </div>

          {/* Snapshot Lines Table */}
          <div className="overflow-x-auto border rounded-lg border-border/40 print:border-zinc-300">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs text-muted-foreground print:text-zinc-700">
                  <TableHead className="w-[40%]">Item Description (Snapshot)</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax Rate</TableHead>
                  <TableHead className="text-right pr-4">Total (INR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line, idx) => (
                  <TableRow key={idx} className="text-xs print:text-black">
                    <TableCell className="font-medium py-3">
                      <div>{line.product_name_snapshot}</div>
                      {line.variant_name_snapshot && (
                        <div className="text-[11px] text-muted-foreground print:text-zinc-600 font-mono">
                          {line.variant_name_snapshot}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{line.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground print:text-zinc-700">
                      {formatINR(line.unit_price_snapshot)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.discount_amount > 0 ? (
                        <span className="text-emerald-400 print:text-black">
                          -{formatINR(line.discount_amount)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground print:text-zinc-700">
                      {line.tax_percent_snapshot}%
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold pr-4">
                      {formatINR(line.line_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground print:text-zinc-600">
                <span>Subtotal (Gross)</span>
                <span className="font-mono text-foreground print:text-black">
                  {formatINR(invoice.subtotal)}
                </span>
              </div>

              {invoice.total_discount > 0 && (
                <div className="flex justify-between text-emerald-400 print:text-black font-medium">
                  <span>Discount Applied</span>
                  <span className="font-mono">-{formatINR(invoice.total_discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground print:text-zinc-600">
                <span>GST Tax (Exclusive)</span>
                <span className="font-mono text-foreground print:text-black">
                  {formatINR(invoice.total_tax)}
                </span>
              </div>

              <div className="flex justify-between border-t border-border/60 print:border-zinc-400 pt-2 text-sm font-bold text-foreground print:text-black">
                <span>Grand Total</span>
                <span className="font-mono text-emerald-400 print:text-black">
                  {formatINR(invoice.grand_total)}
                </span>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground print:text-zinc-600">
                <span>Amount Paid</span>
                <span className="font-mono text-foreground print:text-black">
                  {formatINR(invoice.amount_paid)}
                </span>
              </div>

              <div className="flex justify-between border-t border-border/40 print:border-zinc-300 pt-2 text-sm font-bold">
                <span>Balance Due</span>
                <span
                  className={`font-mono ${
                    invoice.amount_due > 0
                      ? invoice.is_overdue
                        ? 'text-rose-400 print:text-black font-bold'
                        : 'text-amber-400 print:text-black'
                      : 'text-emerald-400 print:text-black'
                  }`}
                >
                  {formatINR(invoice.amount_due)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History Table */}
          {invoice.payments.length > 0 && (
            <div className="pt-4 border-t border-border/40 print:border-zinc-300 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-zinc-600">
                Payment History & Receipts ({invoice.payments.length})
              </h3>
              <div className="overflow-x-auto border rounded-lg border-border/40 print:border-zinc-300">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent text-xs text-muted-foreground print:text-zinc-700">
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Posting Date</TableHead>
                      <TableHead>Reference / Note</TableHead>
                      <TableHead className="text-right pr-4">Amount Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((p) => (
                      <TableRow key={p.id} className="text-xs print:text-black">
                        <TableCell className="font-medium font-mono">{p.payment_method}</TableCell>
                        <TableCell className="font-mono text-muted-foreground print:text-zinc-700">
                          {formatDate(p.payment_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground print:text-zinc-700">
                          {p.note ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-400 print:text-black pr-4">
                          {formatINR(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        invoice={invoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSuccess={(updated) => setInvoice(updated)}
      />
    </div>
  )
}
