import { useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FastForward,
  Play,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/format'
import { addDays, addMonths, addWeeks } from '@/mocks/engine/dates'
import { DEMO_TODAY } from '@/mocks/fixtures'
import type { BillingRunReport } from '@/mocks/invoices.fixtures'
import { runBillingDay } from '@/services/api'

const PIPELINE_STAGES = [
  'Due subscriptions identified',
  'Discount windows & limits verified',
  'GST Tax (18%) computed from rules',
  'Immutable invoice snapshots created',
  'Ledger updated & notifications dispatched',
]

export function BillingDayPage() {
  const [currentDate, setCurrentDate] = useState<string>(DEMO_TODAY)
  const [running, setRunning] = useState(false)
  const [activeStage, setActiveStage] = useState<number>(-1)
  const [report, setReport] = useState<BillingRunReport | null>(null)

  function advanceDate(days: number) {
    setCurrentDate((prev) => addDays(prev, days))
    toast.info(`Clock advanced by ${days} day(s)`)
  }

  function advanceWeeks(weeks: number) {
    setCurrentDate((prev) => addWeeks(prev, weeks))
    toast.info(`Clock advanced by ${weeks} week(s)`)
  }

  function advanceMonth() {
    setCurrentDate((prev) => addMonths(prev, 1))
    toast.info('Clock advanced by +1 month (calendar math applied)')
  }

  function resetDate() {
    setCurrentDate(DEMO_TODAY)
    toast.info('Clock reset to initial demo date')
  }

  async function handleRunBatch() {
    setRunning(true)
    setActiveStage(0)

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setActiveStage(i)
      await new Promise((r) => setTimeout(r, 220))
    }

    try {
      const res = await runBillingDay(currentDate)
      setReport(res)
      if (res.billed > 0) {
        toast.success(
          `Batch complete: ${res.billed} invoice(s) generated totaling ${formatINR(res.total_amount)} in ${res.duration_ms}ms`,
        )
      } else {
        toast.info(
          `0 invoices created · ${res.skipped} already billed for this cycle — nothing billed twice.`,
        )
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Batch execution failed')
    } finally {
      setRunning(false)
      setActiveStage(-1)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Day Simulator"
        description="Simulate recurring billing cycles, test automated batch invoicing, and verify 100% idempotency."
      />

      {/* Time-Travel Control Bar */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-emerald-400" />
              Time-Travel Simulator Clock
            </span>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">
              Simulated: {currentDate}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Simulate Date:</span>
              <Input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="w-40 h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => advanceDate(1)}
              >
                +1 Day
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => advanceWeeks(1)}
              >
                +1 Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={advanceMonth}
              >
                <FastForward className="size-3" />
                +1 Month
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1 text-muted-foreground"
                onClick={resetDate}
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" />
                Batch Engine & Idempotency Guarantee
              </p>
              <p>
                Each subscription is keyed by <code className="font-mono text-foreground font-semibold">{`{sub_number}:{next_billing_date}`}</code>. Running the batch multiple times on the same date will skip already-billed cycles.
              </p>
            </div>
            <Button
              size="sm"
              disabled={running}
              onClick={handleRunBatch}
              className="gap-2 font-semibold shadow-sm shrink-0"
            >
              <Play className="size-3.5 fill-current" />
              {running ? 'Running Batch Pipeline…' : 'Run Billing Day Batch'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 5-Stage Animated Pipeline Visualizer */}
      {running && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-400 animate-pulse" />
              Batch Execution Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-2 sm:grid-cols-5">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isDone = activeStage > idx
                const isActive = activeStage === idx
                return (
                  <div
                    key={stage}
                    className={`rounded-lg border p-2.5 text-xs transition-all ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-semibold scale-[1.02]'
                        : isDone
                          ? 'border-border/60 bg-background/50 text-foreground'
                          : 'border-border/30 bg-background/20 text-muted-foreground/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      ) : isActive ? (
                        <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      ) : (
                        <span className="size-2 rounded-full bg-muted-foreground/30" />
                      )}
                      <span>Stage {idx + 1}</span>
                    </div>
                    <p className="line-clamp-2 leading-tight">{stage}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run Summary KPI Tiles */}
      {report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 animate-in fade-in">
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                Invoices Generated
              </p>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-400">
                {report.billed}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
                Skipped (Idempotent)
              </p>
              <p className="mt-1 text-2xl font-bold font-mono text-amber-400">
                {report.skipped}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-medium text-foreground uppercase tracking-wider">
                Total Billed
              </p>
              <p className="mt-1 text-2xl font-bold font-mono text-foreground">
                {formatINR(report.total_amount)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Execution Time
              </p>
              <p className="mt-1 text-2xl font-bold font-mono text-foreground flex items-center gap-1">
                <Clock className="size-4 text-primary" />
                {report.duration_ms} ms
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Run Ledger Panel (Auditable Proof of Idempotency) */}
      {report && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden animate-in fade-in">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Batch Run Audit Ledger ({report.decisions.length} Decisions)
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              Idempotency Proof Active
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent text-xs text-muted-foreground">
                    <TableHead className="w-32">Action</TableHead>
                    <TableHead>Subscription #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Period Key</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason / Audit Log</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.decisions.map((dec, i) => (
                    <TableRow key={`${dec.period_key}-${i}`} className="text-xs">
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            dec.action === 'BILL'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
                              : dec.action === 'SKIP'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold'
                                : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
                          }
                        >
                          {dec.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-foreground py-2.5">
                        {dec.sub_number}
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground">
                        {dec.customer_name}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground py-2.5">
                        {dec.period_key}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground py-2.5">
                        {dec.amount > 0 ? formatINR(dec.amount) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2.5">
                        {dec.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
