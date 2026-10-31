import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageHeader } from './PageHeader'

interface PhasePlaceholderProps {
  title: string
  description: string
  icon: LucideIcon
  bullets: string[]
  phase: string
  backTo?: { label: string; to: string }
}

export function PhasePlaceholder({
  title,
  description,
  icon: Icon,
  bullets,
  phase,
  backTo,
}: PhasePlaceholderProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title={title}
        description={description}
        badge={
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {phase}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border/80 bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Surface scaffolded</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Routes, layout and role permissions are live. The data surfaces below are wired to
                the shared contracts in the next phase.
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Available now
          </p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>· Role-aware navigation and route guards</p>
            <p>· Mock session, role switcher and notifications</p>
            <p>· Command palette actions</p>
          </div>
          {backTo ? (
            <Link
              to={backTo.to}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-6 gap-1.5')}
            >
              {backTo.label}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
