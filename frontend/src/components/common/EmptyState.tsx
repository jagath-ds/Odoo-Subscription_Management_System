import { Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No data captured yet',
  message = 'Adjust parameters to begin.',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-full border border-border/70 bg-background text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {action}
    </div>
  )
}
