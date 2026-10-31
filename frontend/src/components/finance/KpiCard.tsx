import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  target?: string
  delta?: number
  footnote?: string
  tone?: 'default' | 'warning' | 'danger'
  className?: string
}

const TONE_ICON: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-primary',
  warning: 'text-amber-500',
  danger: 'text-destructive',
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  target,
  delta,
  footnote,
  tone = 'default',
  className,
}: KpiCardProps) {
  const positive = typeof delta === 'number' && delta > 0
  const negative = typeof delta === 'number' && delta < 0
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus

  return (
    <div
      className={cn(
        'group rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-[0_0_0_1px_var(--border)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            'grid size-7 place-items-center rounded-md border border-border/60 bg-background',
            TONE_ICON[tone],
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          {target ? (
            <>
              Target <span className="text-foreground/80">{target}</span>
            </>
          ) : (
            footnote
          )}
        </span>
        {typeof delta === 'number' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              positive ? 'text-primary' : negative ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            <DeltaIcon className="size-3" />
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}
