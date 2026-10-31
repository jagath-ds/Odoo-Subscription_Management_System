import { Boxes, CalendarClock, LineChart, ReceiptText } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    icon: CalendarClock,
    title: 'Billing day runs itself',
    body: 'Due subscriptions become invoices with taxes and discounts already applied.',
  },
  {
    icon: ReceiptText,
    title: 'Invoices never drift',
    body: 'Every line is a snapshot — editing a product price never rewrites history.',
  },
  {
    icon: LineChart,
    title: 'Revenue you can trust',
    body: 'MRR, outstanding and overdue in one view, measured in milliseconds.',
  },
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border/70 bg-card lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div aria-hidden="true" className="absolute inset-0 grid-lines opacity-40" />
        <div aria-hidden="true" className="absolute inset-0 glow-emerald" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_22px_-6px_var(--primary)]">
            <Boxes className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Brightloop</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Billing OS
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-7">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Subscription management
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Every subscription. Every invoice. Every rupee.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Plans, quotations, recurring billing, discounts and payments — one system for the
              company that earns money every month.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {feature.title}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {feature.body}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Mock mode · deterministic demo data · switch to the live API with one env flag
        </div>
      </aside>

      <main className="flex min-h-svh flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/70 px-5 lg:hidden">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Brightloop</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Billing OS</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className={cn('w-full max-w-[420px] space-y-7')}>
            <header className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </header>
            {children}
            {footer}
          </div>
        </div>

        <div className="border-t border-border/60 px-5 py-4 text-center text-[11px] text-muted-foreground lg:hidden">
          <Link to="/login" className="hover:text-foreground">
            Brightloop · Subscription Management System
          </Link>
        </div>
      </main>
    </div>
  )
}
