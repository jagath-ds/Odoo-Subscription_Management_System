import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  placeholder?: string
  children?: ReactNode
  meta?: ReactNode
  className?: string
}

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  children,
  meta,
  className,
}: ListToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-2.5 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="relative w-full sm:max-w-xs">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
          aria-label={placeholder}
        />
      </div>

      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}

      {meta ? (
        <div className="text-xs text-muted-foreground sm:ml-auto sm:pr-1">{meta}</div>
      ) : null}
    </div>
  )
}
