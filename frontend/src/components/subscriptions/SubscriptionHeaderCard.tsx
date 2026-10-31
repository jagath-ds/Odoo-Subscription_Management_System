import {
  Calendar,
  Clock,
  CreditCard,
  Layers,
  PauseCircle,
  User,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionBadge } from '@/components/catalog/CatalogBadges'
import { formatDate } from '@/lib/format'
import type { SubscriptionDetail } from '@/types/contracts'
import { SubscriptionStatusBadge } from './SubscriptionBadges'

export function SubscriptionHeaderCard({
  subscription,
}: {
  subscription: SubscriptionDetail
}) {
  const { plan_permissions } = subscription

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-5 space-y-4">
        {/* Top title bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold tracking-tight text-foreground">
                {subscription.sub_number}
              </span>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="size-3.5" />
              <span className="font-medium text-foreground">{subscription.customer_name}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <PermissionBadge enabled={plan_permissions.can_pause} label="Pausable" />
            <PermissionBadge enabled={plan_permissions.can_close_early} label="Early Close" />
            <PermissionBadge enabled={plan_permissions.can_renew} label="Renewable" />
            <PermissionBadge enabled={plan_permissions.auto_close} label="Auto-Close" />
          </div>
        </div>

        {/* Date & Terms Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Layers className="size-3 text-primary" />
              Plan & Cycle
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {subscription.plan_name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {subscription.billing_frequency.toLowerCase()} billing
            </p>
          </div>

          <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Calendar className="size-3 text-primary" />
              Start Date
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(subscription.start_date)}
            </p>
            <p className="text-xs text-muted-foreground">Contract effective</p>
          </div>

          <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Clock className="size-3 text-emerald-400" />
              Next Billing Day
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              {formatDate(subscription.next_billing_date)}
            </p>
            <p className="text-xs text-muted-foreground">Automated invoice run</p>
          </div>

          <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <CreditCard className="size-3 text-primary" />
              Expiry / Terms
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {subscription.expiry_date ? formatDate(subscription.expiry_date) : 'Continuous'}
            </p>
            <p className="text-xs text-muted-foreground">
              Net payment terms
            </p>
          </div>
        </div>

        {/* Paused Alert Banner */}
        {subscription.status === 'PAUSED' && subscription.paused_at && (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <PauseCircle className="size-4 shrink-0 text-amber-400" />
            <div>
              <span className="font-semibold">Subscription is paused since {formatDate(subscription.paused_at)}.</span>{' '}
              When resumed, both the next billing date and contract expiry date will automatically shift forward by the exact duration paused.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
