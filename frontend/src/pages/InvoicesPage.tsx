import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronRight,
  CreditCard,
  FileText,
  Filter,
  Search,
  Send,
} from 'lucide-react'
import { RecordPaymentDialog } from '@/components/billing/RecordPaymentDialog'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatINR } from '@/lib/format'
import { getInvoice, listInvoices, sendReminder } from '@/services/api'
import type { InvoiceDetail, InvoiceListItem } from '@/types/contracts'

const STATUS_FILTERS = [
  { label: 'All Invoices', value: 'ALL' },
  { label: 'Overdue Only', value: 'OVERDUE' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid in Full', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const items = await listInvoices()
      setInvoices(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'OVERDUE'
            ? inv.is_overdue
            : inv.status === statusFilter

      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q) ||
        inv.sub_number.toLowerCase().includes(q)

      return matchesStatus && matchesSearch
    })
  }, [invoices, statusFilter, search])

  const stats = useMemo(() => {
    const total = invoices.length
    const overdue = invoices.filter((i) => i.is_overdue).length
    const outstanding = invoices
      .filter((i) => i.status !== 'CANCELLED')
      .reduce((acc, i) => acc + i.amount_due, 0)
    const paid = invoices.reduce((acc, i) => acc + i.amount_paid, 0)
    return { total, overdue, outstanding, paid }
  }, [invoices])

  async function handleOpenPayment(id: number) {
    try {
      const detail = await getInvoice(id)
      setSelectedInvoice(detail)
      setPaymentDialogOpen(true)
    } catch (err: unknown) {
      toast.error('Could not load invoice details')
    }
  }

  async function handleSendReminder(invoiceId: number) {
    try {
      const res = await sendReminder(invoiceId)
      toast.success(`Payment reminder sent to ${res.to}`)
    } catch {
      toast.error('Failed to send reminder')
    }
  }

  const columns: Array<DataTableColumn<InvoiceListItem>> = [
    {
      id: 'invoice_number',
      header: 'Invoice #',
      cell: (row) => (
        <Link
          to={`/invoices/${row.id}`}
          className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          {row.invoice_number}
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-foreground">{row.customer_name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{row.sub_number}</div>
        </div>
      ),
    },
    {
      id: 'dates',
      header: 'Issue / Due Date',
      cell: (row) => (
        <div className="space-y-0.5 text-xs font-mono">
          <div className="text-muted-foreground">Issued: {formatDate(row.issue_date)}</div>
          <div className={row.is_overdue ? 'text-rose-400 font-semibold' : 'text-foreground'}>
            Due: {formatDate(row.due_date)}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={
              row.status === 'PAID'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]'
                : row.status === 'PARTIALLY_PAID'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold text-[11px]'
                  : row.status === 'CANCELLED'
                    ? 'border-zinc-600/40 bg-zinc-800/40 text-zinc-400 text-[11px]'
                    : 'border-sky-500/40 bg-sky-500/10 text-sky-400 text-[11px]'
            }
          >
            {row.status}
          </Badge>
          {row.is_overdue && (
            <Badge variant="outline" className="border-rose-500/40 bg-rose-500/15 text-rose-400 font-semibold text-[10px]">
              Overdue
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'grand_total',
      header: 'Grand Total',
      cell: (row) => (
        <div className="space-y-0.5 text-right font-mono text-xs">
          <div className="font-semibold text-foreground">{formatINR(row.grand_total)}</div>
          {row.amount_paid > 0 && (
            <div className="text-[10px] text-emerald-400">Paid: {formatINR(row.amount_paid)}</div>
          )}
        </div>
      ),
      className: 'text-right',
      headClassName: 'text-right',
    },
    {
      id: 'amount_due',
      header: 'Amount Due',
      cell: (row) => (
        <div className="text-right font-mono text-xs">
          <span
            className={
              row.amount_due > 0
                ? row.is_overdue
                  ? 'text-rose-400 font-bold'
                  : 'text-amber-400 font-semibold'
                : 'text-muted-foreground'
            }
          >
            {formatINR(row.amount_due)}
          </span>
        </div>
      ),
      className: 'text-right',
      headClassName: 'text-right',
    },
    {
      id: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5 pr-3">
          {row.amount_due > 0 && row.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleOpenPayment(row.id)}
            >
              <CreditCard className="size-3 text-emerald-400" />
              Pay
            </Button>
          )}
          {row.is_overdue && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-rose-400 hover:text-rose-300"
              onClick={() => handleSendReminder(row.id)}
            >
              <Send className="size-3" />
              Chase
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => navigate(`/invoices/${row.id}`)}
          >
            View
          </Button>
        </div>
      ),
      className: 'text-right pr-4',
      headClassName: 'text-right pr-4',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Receivables"
        description="Immutable snapshot records, automated tax calculations, payment matching, and overdue receivables chase."
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Invoices
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">
              Overdue Invoices
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-rose-400">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
              Total Outstanding
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-amber-400">
              {formatINR(stats.outstanding)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Collected Revenue
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-emerald-400">
              {formatINR(stats.paid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, customer, sub #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'ALL')}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={filteredInvoices}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <FileText className="mx-auto size-8 text-muted-foreground/40" />
              <p>No invoices match the selected criteria.</p>
            </div>
          }
        />
      </Card>

      <RecordPaymentDialog
        invoice={selectedInvoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
