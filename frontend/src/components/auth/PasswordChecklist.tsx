import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PASSWORD_RULES } from '@/lib/validation'

export function PasswordChecklist({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn('grid gap-1.5 sm:grid-cols-2', className)} aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value)
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1.5 text-[11px] transition-colors',
              passed ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors',
                passed
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-border bg-muted/40 text-muted-foreground',
              )}
            >
              {passed ? <Check className="size-2.5" /> : <X className="size-2.5" />}
            </span>
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
