import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CreditCard,
  Landmark,
  QrCode,
  Search,
  Wallet,
} from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatINR } from '@/lib/format'
import { listPayments } from '@/services/api'
import type { PaymentListItem, PaymentMethod } from '@/types/contracts'

function MethodBadge({ method }: { method: PaymentMethod }) {
  switch (method) {
    case 'UPI':
      return (
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 gap-1 font-mono text-[11px]">
          <QrCode className="size-3" /> UPI
        </Badge>
      )
    case 'BANK_TRANSFER':
      return (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary gap-1 font-mono text-[11px]">
          <Landmark className="size-3" /> Bank Transfer
        </Badge>
      )
    case 'CARD':
      return (
        <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-400 gap-1 font-mono text-[11px]">
          <CreditCard className="size-3" /> Card
        </Badge>
      )
    case 'CASH':
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 gap-1 font-mono text-[11px]">
          <Banknote className="size-3" /> Cash
        </Badge>
      )
  }
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const items = await listPayments()
      setPayments(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payments
    return payments.filter(
      (p) =>
        p.invoice_number.toLowerCase().includes(q) ||
        p.customer_name.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q)),
    )
  }, [payments, search])

  const totalCollected = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.amount, 0)
  }, [payments])

  const columns: Array<DataTableColumn<PaymentListItem>> = [
    {
      id: 'receipt',
      header: 'Receipt #',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          RCP-{String(row.id).padStart(4, '0')}
        </span>
      ),
    },
    {
      id: 'invoice_number',
      header: 'Invoice #',
      cell: (row) => (
        <Link
          to={`/invoices/${row.id}`}
          className="font-mono text-xs font-bold text-primary hover:underline"
        >
          {row.invoice_number}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="text-xs font-medium text-foreground">{row.customer_name}</span>
      ),
    },
    {
      id: 'method',
      header: 'Payment Method',
      cell: (row) => <MethodBadge method={row.payment_method} />,
    },
    {
      id: 'date',
      header: 'Posting Date',
      cell: (row) => (
        <span className="text-xs font-mono text-muted-foreground">
          {formatDate(row.payment_date)}
        </span>
      ),
    },
    {
      id: 'note',
      header: 'Reference / Note',
      cell: (row) => (
        <span className="text-xs text-muted-foreground truncate max-w-xs block">
          {row.note ?? '—'}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount Paid',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-emerald-400">
          {formatINR(row.amount)}
        </span>
      ),
      className: 'text-right pr-4',
      headClassName: 'text-right pr-4',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Transactions"
        description="Collected payments matched against invoices across UPI, NEFT bank transfers, and cards."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Transactions
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">
              {payments.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Total Collected
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-emerald-400">
              {formatINR(totalCollected)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by invoice #, customer or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Wallet className="mx-auto size-8 text-muted-foreground/40" />
              <p>No payments recorded yet.</p>
            </div>
          }
        />
      </Card>
    </div>
  )
}
