import { ArrowLeft, Compass, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'
import { homeForRole } from '@/types/nav'

export function ForbiddenPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const role = state.session?.role ?? 'CUSTOMER'

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border/80 bg-card p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-500">
          <ShieldAlert className="size-6" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            403 · Restricted
          </p>
          <h1 className="text-xl font-semibold text-foreground">This area is not available to you</h1>
          <p className="text-sm text-muted-foreground">
            You are signed in as <span className="font-medium text-foreground">{role}</span>. Catalog,
            tax and discount configuration is Admin-only, and the portal is Customer-only.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 pt-1 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="size-3.5" />
            Go back
          </Button>
          <Link to={homeForRole(role)} className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
            Back to my workspace
          </Link>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  const { state } = useApp()
  const home = state.session ? homeForRole(state.session.role) : '/login'

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border/80 bg-card p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Compass className="size-6" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            404 · Not found
          </p>
          <h1 className="text-xl font-semibold text-foreground">That page does not exist</h1>
          <p className="text-sm text-muted-foreground">
            The route may have moved with the latest phase. Head back to your workspace.
          </p>
        </div>
        <Link to={home} className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
          Back to workspace
        </Link>
      </div>
    </div>
  )
}
