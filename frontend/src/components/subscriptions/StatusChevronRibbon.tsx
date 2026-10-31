import { Check, PauseCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubscriptionStatus } from '@/types/contracts'

interface StatusChevronRibbonProps {
  currentStatus: SubscriptionStatus
  onSelectStatus?: (status: SubscriptionStatus) => void
}

const ORDERED_STEPS: SubscriptionStatus[] = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE']

export function StatusChevronRibbon({ currentStatus }: StatusChevronRibbonProps) {
  const isBranchStatus = currentStatus === 'PAUSED' || currentStatus === 'CLOSED'
  const activeIndex = ORDERED_STEPS.indexOf(currentStatus)

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 p-1.5 backdrop-blur-sm sm:gap-2">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {ORDERED_STEPS.map((step, idx) => {
          const isCurrent = step === currentStatus
          const isPassed = !isBranchStatus && activeIndex > idx
          const isFuture = !isCurrent && !isPassed

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all select-none',
                isCurrent &&
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold',
                isPassed && 'text-muted-foreground bg-muted/30 border border-transparent',
                isFuture && 'text-muted-foreground/50 bg-background/30 border border-dashed border-border/40',
              )}
            >
              {isPassed ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    isCurrent ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40',
                  )}
                />
              )}
              <span>{step}</span>
            </div>
          )
        })}
      </div>

      {/* Branch or terminal statuses (PAUSED / CLOSED) */}
      <div className="ml-auto flex items-center gap-1.5 border-l border-border/40 pl-2">
        {currentStatus === 'PAUSED' && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <PauseCircle className="size-3.5 text-amber-400 animate-pulse" />
            <span>PAUSED</span>
          </div>
        )}

        {currentStatus === 'CLOSED' && (
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-400">
            <XCircle className="size-3.5 text-zinc-400" />
            <span>CLOSED</span>
          </div>
        )}
      </div>
    </div>
  )
}
