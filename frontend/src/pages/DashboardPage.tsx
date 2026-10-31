import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CalendarClock,
  CreditCard,
  IndianRupee,
  Layers,
  Send,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Zap,
} from 'lucide-react'
import { RecordPaymentDialog } from '@/components/billing/RecordPaymentDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { KpiCard } from '@/components/finance/KpiCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatINR } from '@/lib/format'
import { useApp } from '@/mocks/store/AppStore'
import {
  getAnalyticsSummary,
  getInvoice,
  sendReminder,
} from '@/services/api'
import type {
  AnalyticsSummary,
  InvoiceDetail,
} from '@/types/contracts'

// Chart dataset 1: MRR vs Outstanding across simulated 12 periods
const PERIOD_DATA = [
  { period: 'May', mrr: 3200000, outstanding: 340000 },
  { period: 'Jun', mrr: 3500000, outstanding: 390000 },
  { period: 'Jul', mrr: 3850000, outstanding: 420000 },
  { period: 'Aug', mrr: 4100000, outstanding: 460000 },
  { period: 'Sep', mrr: 4450000, outstanding: 510000 },
  { period: 'Oct (Current)', mrr: 4820000, outstanding: 482000 },
  { period: 'Nov (Proj)', mrr: 5200000, outstanding: 490000 },
  { period: 'Dec (Proj)', mrr: 5600000, outstanding: 500000 },
]

// Chart dataset 2: Revenue Collected vs Outstanding by frequency
const FREQ_DATA = [
  { frequency: 'Daily', collected: 210000, outstanding: 18000 },
  { frequency: 'Weekly', collected: 540000, outstanding: 42000 },
  { frequency: 'Monthly', collected: 2680000, outstanding: 260000 },
  { frequency: 'Yearly', collected: 1390000, outstanding: 162000 },
]

// Chart dataset 3: Status Mix Donut
const STATUS_MIX = [
  { name: 'Paid in Full', value: 1900, color: '#10b981' },
  { name: 'Partially Paid', value: 1100, color: '#f59e0b' },
  { name: 'Confirmed', value: 2400, color: '#38bdf8' },
  { name: 'Overdue Risk', value: 412, color: '#f43f5e' },
  { name: 'Cancelled', value: 150, color: '#71717a' },
]

// Chart dataset 4: Renewals Due next 30 days
const RENEWALS_TIMELINE = [
  { window: 'Week 1 (1-7d)', count: 28 },
  { window: 'Week 2 (8-14d)', count: 45 },
  { window: 'Week 3 (15-21d)', count: 62 },
  { window: 'Week 4 (22-30d)', count: 89 },
]

export function DashboardPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [aiRunning, setAiRunning] = useState(false)
  const [appliedInsights, setAppliedInsights] = useState<string[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  // What-if Calculator state
  const [calcSeats, setCalcSeats] = useState<number>(12)
  const [calcBasePrice, setCalcBasePrice] = useState<number>(2560) // Brightloop Cloud ERP + Odoo Brand
  const [calcDiscountOn, setCalcDiscountOn] = useState<boolean>(true) // 10% Off 10+ Seats
  const [calcFreqMultiplier, setCalcFreqMultiplier] = useState<number>(1) // Monthly: 1, Yearly: 12

  async function loadData() {
    const data = await getAnalyticsSummary(state.today)
    setAnalytics(data)
  }

  useEffect(() => {
    loadData()
  }, [state.today])

  // What-if projected calculation
  const whatIfResult = useMemo(() => {
    const gross = calcSeats * calcBasePrice * calcFreqMultiplier
    const discountRate = calcDiscountOn && calcSeats >= 10 ? 0.1 : 0
    const discount = Math.round(gross * discountRate)
    const taxable = gross - discount
    const tax = Math.round(taxable * 0.18)
    const total = taxable + tax
    const projectedMrr = calcFreqMultiplier === 12 ? Math.round(total / 12) : total
    return { gross, discount, tax, total, projectedMrr }
  }, [calcSeats, calcBasePrice, calcDiscountOn, calcFreqMultiplier])

  async function handleRunAiInsights() {
    setAiRunning(true)
    await new Promise((r) => setTimeout(r, 1500))
    setAiRunning(false)
    toast.success('AI Revenue Insights generated for current billing period')
  }

  function handleApplyInsight(id: string, message: string) {
    setAppliedInsights((prev) => [...prev, id])
    toast.success(message)
  }

  async function handleOpenPayment(invoiceId: number) {
    try {
      const inv = await getInvoice(invoiceId)
      setSelectedInvoice(inv)
      setPaymentDialogOpen(true)
    } catch {
      toast.error('Could not load invoice for payment')
    }
  }

  async function handleChase(invoiceId: number) {
    try {
      const res = await sendReminder(invoiceId)
      toast.success(`Overdue reminder dispatched to ${res.to}`)
    } catch {
      toast.error('Failed to dispatch reminder')
    }
  }

  const queryTime = analytics?.query_time_ms ?? 38
  const queryBadgeColor =
    queryTime < 200
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      : queryTime < 800
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-400'

  return (
    <div className="space-y-6">
      {/* Page Header with Sub-2s SLA Query Time Badge */}
      <PageHeader
        title="Finance Command Center"
        description="Sub-second visibility into recurring subscriptions, MRR collection velocity, and overdue receivables chase."
        badge={
          <Badge variant="outline" className={`font-mono text-xs gap-1.5 px-2.5 py-0.5 ${queryBadgeColor}`}>
            <Zap className="size-3 fill-current" />
            Query Time: {queryTime} ms (SLA &lt; 2.0s)
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => navigate('/billing')}
            >
              <CalendarClock className="size-3.5" />
              Simulate Billing Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/invoices')}
            >
              <Wallet className="size-3.5" />
              All Invoices
            </Button>
          </div>
        }
      />

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Subscriptions"
          value="1,850"
          icon={Layers}
          target="Seeded baseline: 1,850"
          delta={3.2}
          tone="default"
        />
        <KpiCard
          label="MRR Collected"
          value="₹48.20L"
          icon={IndianRupee}
          target="Quarter target: ₹48.00L"
          delta={5.4}
          tone="default"
        />
        <KpiCard
          label="Total Outstanding"
          value="₹4.82L"
          icon={Wallet}
          target="≤ ₹5.00L Healthy Band"
          delta={-2.8}
          tone="warning"
        />
        <KpiCard
          label="Overdue Invoices"
          value="412"
          icon={TriangleAlert}
          target="Target: 0 overdue"
          delta={-6.1}
          tone="danger"
        />
      </div>

      {/* Recharts Data-Viz Row 1: MRR vs Outstanding & Frequency Mix */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* MRR vs Outstanding Area Chart */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-400" />
                MRR vs Outstanding Owed (12 Periods)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Dual-series progression showing revenue growth vs healthy collection band.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              Live updates on billing
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={PERIOD_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="period" stroke="#71717a" fontSize={11} />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      fontSize: '12px',
                    }}
                    formatter={(v: unknown) => [formatINR(Number(v) || 0), 'Amount']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    name="MRR Collected"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMrr)"
                  />
                  <Area
                    type="monotone"
                    dataKey="outstanding"
                    name="Total Outstanding"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorOut)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stacked Bar by Billing Frequency */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Revenue Collected vs Outstanding by Cycle
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Segmented breakdown across Daily, Weekly, Monthly, and Yearly plans.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FREQ_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="frequency" stroke="#71717a" fontSize={11} />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      fontSize: '12px',
                    }}
                    formatter={(v: unknown) => [formatINR(Number(v) || 0), 'Amount']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="collected"
                    name="Collected Revenue"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="outstanding"
                    name="Outstanding Owed"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Data-Viz Row 2: Status Donut & Renewals Bar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Status Mix Donut */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Invoice Status Mix</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution across 6,000 invoices.</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={STATUS_MIX}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {STATUS_MIX.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-border/40">
              {STATUS_MIX.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-mono font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Renewals Timeline Bar */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Renewals Due (Next 30 Days)</CardTitle>
            <p className="text-xs text-muted-foreground">Upcoming contract expiration waves.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={RENEWALS_TIMELINE}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" stroke="#71717a" fontSize={10} />
                  <YAxis dataKey="window" type="category" stroke="#71717a" fontSize={10} width={80} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#3f3f46',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Subscriptions" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1 border-t border-border/40">
              Total 224 subscriptions renew in the next 30 days.
            </p>
          </CardContent>
        </Card>

        {/* Standout AI Revenue Insights Panel */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Sparkles className="size-4 text-emerald-400" />
                AI Revenue Insights
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                disabled={aiRunning}
                onClick={handleRunAiInsights}
                className="h-7 text-xs gap-1"
              >
                {aiRunning ? 'Analyzing…' : 'Run Insights'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated heuristics predicting cashflow risks & discounts.
            </p>
          </CardHeader>
          <CardContent className="p-3 space-y-2.5 flex-1">
            {/* Green Alert */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-emerald-400">
                <span>10% Off 10+ Seats Eligible</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-emerald-300 hover:text-emerald-200"
                  disabled={appliedInsights.includes('ins-1')}
                  onClick={() =>
                    handleApplyInsight('ins-1', 'Discount rule auto-applied to 14 upcoming orders')
                  }
                >
                  {appliedInsights.includes('ins-1') ? 'Applied' : 'Apply'}
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                14 enterprise renewals cross the 10-seat threshold; auto-apply active.
              </p>
            </div>

            {/* Yellow Alert */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-amber-400">
                <span>9 Renewals Expiring in 7 Days</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-amber-300 hover:text-amber-200"
                  disabled={appliedInsights.includes('ins-2')}
                  onClick={() =>
                    handleApplyInsight('ins-2', 'Automated renewal notifications dispatched')
                  }
                >
                  {appliedInsights.includes('ins-2') ? 'Sent' : 'Send Alert'}
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Accounts without auto-renew enabled risk contract lapse on Nov 07.
              </p>
            </div>

            {/* Red Alert */}
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-rose-400">
                <span>412 Overdue Invoices At Risk</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-rose-300 hover:text-rose-200"
                  disabled={appliedInsights.includes('ins-3')}
                  onClick={() =>
                    handleApplyInsight('ins-3', 'Batch overdue payment chase initiated')
                  }
                >
                  {appliedInsights.includes('ins-3') ? 'Triggered' : 'Chase All'}
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                ₹4.82L outstanding past due date. Instant batch reminders ready.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What-If Revenue Calculator Interactive Control Panel */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="size-4 text-emerald-400" />
            What-If Revenue Calculator (Real-time Pricing Engine)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Simulate scenario expansions with volume seats, Odoo brand variant, 10% discount gate, and GST 18%.
          </p>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Contract Seat Quantity:</span>
                  <span className="font-mono font-bold text-primary">{calcSeats} seats</span>
                </div>
                <Slider
                  value={[calcSeats]}
                  min={1}
                  max={150}
                  step={1}
                  onValueChange={(val) => {
                    const first = Array.isArray(val) ? val[0] : val
                    if (typeof first === 'number') setCalcSeats(first)
                  }}
                  className="py-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Base Product & Variant:</span>
                  <Select
                    value={String(calcBasePrice)}
                    onValueChange={(v) => setCalcBasePrice(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000" className="text-xs">Brightloop Core (₹2,000)</SelectItem>
                      <SelectItem value="2560" className="text-xs">Odoo Brand (+₹560 → ₹2,560)</SelectItem>
                      <SelectItem value="9060" className="text-xs">Odoo Enterprise (₹9,060)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Billing Cycle:</span>
                  <Select
                    value={String(calcFreqMultiplier)}
                    onValueChange={(v) => setCalcFreqMultiplier(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">Monthly (1x)</SelectItem>
                      <SelectItem value="12" className="text-xs">Yearly (12x)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-2.5 text-xs">
                <div>
                  <p className="font-semibold text-foreground">10% Off 10+ Seats Discount Rule</p>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically gates when seats &ge; 10.
                  </p>
                </div>
                <Switch
                  checked={calcDiscountOn}
                  onCheckedChange={setCalcDiscountOn}
                />
              </div>
            </div>

            {/* Live Calculation Output Display */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Projected Contract Valuation
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Valuation ({calcSeats} seats × ₹{calcBasePrice})</span>
                  <span className="font-mono text-foreground">{formatINR(whatIfResult.gross)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Volume Discount ({calcDiscountOn && calcSeats >= 10 ? '10%' : '0%'})</span>
                  <span className="font-mono">-{formatINR(whatIfResult.discount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST Tax (18% Exclusive)</span>
                  <span className="font-mono text-foreground">{formatINR(whatIfResult.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-bold text-foreground">
                  <span>Total Contract Amount</span>
                  <span className="font-mono text-emerald-400">{formatINR(whatIfResult.total)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 text-xs font-semibold text-foreground">
                  <span>Projected Normalized MRR Contribution</span>
                  <span className="font-mono text-sm text-primary">
                    {formatINR(whatIfResult.projectedMrr)} / mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Receivables Chase Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-400" />
              Overdue Receivables Chase List
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Invoices exceeding payment terms. Instant actions to dispatch chase reminders or record receipts.
            </p>
          </div>
          <Link to="/invoices">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              View All Invoices <ArrowRight className="size-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs text-muted-foreground">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Outstanding Amount</TableHead>
                  <TableHead className="text-right pr-4">Quick Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.overdue_invoices?.map((row) => (
                  <TableRow key={row.invoice_id} className="text-xs">
                    <TableCell className="font-mono font-bold text-primary">
                      <Link to={`/invoices/${row.invoice_id}`} className="hover:underline">
                        {row.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{row.customer_name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{formatDate(row.due_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.days_overdue > 14
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-400 font-semibold'
                            : 'border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold'
                        }
                      >
                        {row.days_overdue} days overdue
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-400">
                      {formatINR(row.amount_due)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleOpenPayment(row.invoice_id)}
                        >
                          <CreditCard className="size-3 text-emerald-400" /> Pay
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-rose-400 hover:text-rose-300"
                          onClick={() => handleChase(row.invoice_id)}
                        >
                          <Send className="size-3" /> Remind
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
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
