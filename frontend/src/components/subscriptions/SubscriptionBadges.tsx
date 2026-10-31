import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SubscriptionStatus } from '@/types/contracts'

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  DRAFT: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
  QUOTATION: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  CONFIRMED: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400',
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold',
  PAUSED: 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold',
  CLOSED: 'border-zinc-600/50 bg-zinc-800/40 text-zinc-400',
}

const STATUS_DOT: Record<SubscriptionStatus, string> = {
  DRAFT: 'bg-slate-400',
  QUOTATION: 'bg-sky-400',
  CONFIRMED: 'bg-indigo-400',
  ACTIVE: 'bg-emerald-400 animate-pulse',
  PAUSED: 'bg-amber-400',
  CLOSED: 'bg-zinc-500',
}

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs', STATUS_STYLES[status], className)}
    >
      <span className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
      {status}
    </Badge>
  )
}
