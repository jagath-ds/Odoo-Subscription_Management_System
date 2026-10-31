import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
