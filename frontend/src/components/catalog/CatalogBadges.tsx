import { Check, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FREQUENCY_LABELS } from '@/lib/catalog'
import type { DiscountState, PlanAvailability } from '@/lib/catalog'
import type { BillingFrequency, ProductType } from '@/types/contracts'

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-border/70',
        active ? 'text-emerald-500' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-muted-foreground/50',
        )}
      />
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

export function ProductTypeBadge({ type }: { type: ProductType }) {
  return (
    <Badge
      variant={type === 'SERVICE' ? 'secondary' : 'outline'}
      className="font-mono text-[10px] tracking-wide"
    >
      {type}
    </Badge>
  )
}

export function FrequencyBadge({ frequency }: { frequency: BillingFrequency }) {
  return (
    <Badge variant="outline" className="border-border/70 text-[11px]">
      {FREQUENCY_LABELS[frequency]}
    </Badge>
  )
}

export function PermissionBadge({
  enabled,
  label,
}: {
  enabled: boolean
  label: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px]',
        enabled
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground/60',
      )}
    >
      {enabled ? <Check className="size-2.5" /> : <Minus className="size-2.5" />}
      {label}
    </Badge>
  )
}

const DISCOUNT_STYLES: Record<DiscountState, string> = {
  ACTIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  SCHEDULED: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  EXPIRED: 'border-border/70 text-muted-foreground',
  EXHAUSTED: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
}

const DISCOUNT_LABELS: Record<DiscountState, string> = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
  EXHAUSTED: 'Exhausted',
}

export function DiscountStateBadge({ state }: { state: DiscountState }) {
  return (
    <Badge variant="outline" className={DISCOUNT_STYLES[state]}>
      {DISCOUNT_LABELS[state]}
    </Badge>
  )
}

const PLAN_STYLES: Record<PlanAvailability, string> = {
  AVAILABLE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  SCHEDULED: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  EXPIRED: 'border-border/70 text-muted-foreground',
}

const PLAN_LABELS: Record<PlanAvailability, string> = {
  AVAILABLE: 'Available',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
}

export function PlanAvailabilityBadge({ state }: { state: PlanAvailability }) {
  return (
    <Badge variant="outline" className={PLAN_STYLES[state]}>
      {PLAN_LABELS[state]}
    </Badge>
  )
}
