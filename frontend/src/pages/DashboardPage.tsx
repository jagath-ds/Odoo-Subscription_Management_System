import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  IndianRupee,
  Layers,
  ScrollText,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { KpiCard } from '@/components/finance/KpiCard'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDate, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'

export function DashboardPage() {
  const { state } = useApp()
  const firstName = state.session?.full_name.split(' ')[0] ?? 'there'
  const attention = state.notifications.slice(0, 4)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Revenue Command"
        description={`Good morning, ${firstName}. Active subscriptions, money collected, outstanding balance and overdue invoices — as of ${formatDate(state.today)}.`}
        badge={
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Preview data
          </Badge>
        }
        actions={
          <>
            <Link
              to="/billing"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <CalendarClock className="size-3.5" />
              Run Billing Day
            </Link>
            <Link
              to="/invoices"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <Wallet className="size-3.5" />
              Record Payment
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Subscriptions"
          value="1,850"
          icon={Layers}
          target="1,850"
          delta={2.4}
          tone="default"
        />
        <KpiCard
          label="MRR Collected"
          value="₹48.20L"
          icon={IndianRupee}
          target="₹48.00L"
          delta={5.1}
          tone="default"
        />
        <KpiCard
          label="Total Outstanding"
          value="₹6.40L"
          icon={Wallet}
          target="≤ ₹5.00L"
          delta={-3.2}
          tone="warning"
        />
        <KpiCard
          label="Overdue Invoices"
          value="412"
          icon={TriangleAlert}
          target="0"
          delta={-8.4}
          tone="danger"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-border/80 bg-card">
          <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
              <p className="text-xs text-muted-foreground">
                Overdue invoices, renewals and discount rules from the mock store.
              </p>
            </div>
            <Link
              to="/invoices"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </header>

          <ul className="divide-y divide-border/60">
            {attention.map((notification) => (
              <li key={notification.id}>
                <Link
                  to={notification.href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border/60 bg-background',
                      notification.kind === 'OVERDUE'
                        ? 'text-destructive'
                        : notification.kind === 'RENEWAL'
                          ? 'text-amber-500'
                          : notification.kind === 'DISCOUNT'
                            ? 'text-sky-400'
                            : 'text-primary',
                    )}
                  >
                    {notification.kind === 'OVERDUE' ? (
                      <TriangleAlert className="size-3.5" />
                    ) : notification.kind === 'RENEWAL' ? (
                      <CalendarClock className="size-3.5" />
                    ) : notification.kind === 'DISCOUNT' ? (
                      <BadgePercent className="size-3.5" />
                    ) : (
                      <Wallet className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-foreground">
                      {notification.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {notification.body}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/80">
                    {relativeTime(notification.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
            <div aria-hidden="true" className="absolute -top-10 -right-8 size-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Billing day is due</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                37 subscriptions have a next billing date on or before{' '}
                <span className="text-foreground">{formatDate(state.today)}</span>. Invoices are
                generated with taxes and discounts already applied.
              </p>
              <Link
                to="/billing"
                className={cn(buttonVariants({ size: 'sm' }), 'w-full gap-1.5')}
              >
                Open Billing Day
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-border/80 bg-card">
            <header className="border-b border-border/70 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
            </header>
            <div className="grid gap-1 p-2">
              <Link
                to="/quotations/new"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ScrollText className="size-4" />
                Create subscription from template
              </Link>
              <Link
                to="/invoices"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Wallet className="size-4" />
                Record a payment
              </Link>
              <Link
                to="/catalog/discount-rules"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <BadgePercent className="size-4" />
                Review discount rules
              </Link>
            </div>
          </section>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            disabled
            title="Revenue Insights arrives with the analytics contract"
          >
            Run Revenue Insights · Phase 3
          </Button>
        </div>
      </div>
    </div>
  )
}
