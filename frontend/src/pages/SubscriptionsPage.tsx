import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  ChevronRight,
  Filter,
  Layers,
  Plus,
  Search,
} from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { SubscriptionStatusBadge } from '@/components/subscriptions/SubscriptionBadges'
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
import { listSubscriptions } from '@/services/api'
import type { SubscriptionListItem } from '@/types/contracts'

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Closed', value: 'CLOSED' },
]

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  async function loadData() {
    setLoading(true)
    try {
      const items = await listSubscriptions()
      setSubscriptions(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesStatus =
        statusFilter === 'ALL' || sub.status === statusFilter
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        sub.sub_number.toLowerCase().includes(query) ||
        sub.customer_name.toLowerCase().includes(query) ||
        sub.plan_name.toLowerCase().includes(query)
      return matchesStatus && matchesSearch
    })
  }, [subscriptions, statusFilter, search])

  const counts = useMemo(() => {
    return {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
      paused: subscriptions.filter((s) => s.status === 'PAUSED').length,
      confirmed: subscriptions.filter((s) => s.status === 'CONFIRMED').length,
    }
  }, [subscriptions])

  const columns: Array<DataTableColumn<SubscriptionListItem>> = [
    {
      id: 'sub_number',
      header: 'Subscription #',
      cell: (row) => (
        <Link
          to={`/subscriptions/${row.id}`}
          className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          {row.sub_number}
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="font-medium text-foreground text-xs">{row.customer_name}</span>
      ),
    },
    {
      id: 'plan',
      header: 'Plan & Frequency',
      cell: (row) => (
        <div className="space-y-0.5 text-xs">
          <div className="font-medium text-foreground">{row.plan_name}</div>
          <div className="text-[11px] text-muted-foreground capitalize">
            {row.billing_frequency.toLowerCase()}
          </div>
        </div>
      ),
    },
    {
      id: 'next_billing',
      header: 'Next Billing Day',
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
          <CalendarClock className="size-3 text-primary/70 shrink-0" />
          {formatDate(row.next_billing_date)}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <SubscriptionStatusBadge status={row.status} />,
    },
    {
      id: 'total',
      header: 'Cycle Amount',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {formatINR(row.grand_total)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/subscriptions/${row.id}`)}
        >
          Manage
        </Button>
      ),
      className: 'text-right pr-4',
      headClassName: 'text-right pr-4',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every contracted subscription with plan controls, automated billing dates, and status lifecycle."
        actions={
          <Button
            size="sm"
            className="gap-1.5 shadow-sm"
            onClick={() => navigate('/quotations/new')}
          >
            <Plus className="size-3.5" />
            Create from Template
          </Button>
        }
      />

      {/* KPI stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Contracts
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">
              {counts.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Active Billing
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-emerald-400">
              {counts.active}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
              Paused Cycles
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-amber-400">
              {counts.paused}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider">
              Confirmed Pending
            </p>
            <p className="mt-1 text-2xl font-bold font-mono text-indigo-400">
              {counts.confirmed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search subscription # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'ALL')}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value} className="text-xs">
                  {filter.label}
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
          rows={filteredSubscriptions}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Layers className="mx-auto size-8 text-muted-foreground/40" />
              <p>No subscriptions match the selected criteria.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('ALL')
                }}
              >
                Clear Filters
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  )
}
