import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/mocks/store/AppStore'
import { DEMO_ACCOUNTS } from '@/mocks/fixtures'
import { ApiError, getDemoAccounts, login } from '@/services/api'
import type { DemoAccount } from '@/types/contracts'
import { homeForRole } from '@/types/nav'

const ROLE_LABEL: Record<DemoAccount['role'], string> = {
  ADMIN: 'Finance Lead',
  STAFF: 'Staff',
  CUSTOMER: 'Customer',
}

export function LoginPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0]?.email ?? '')
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0]?.password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDemo, setPendingDemo] = useState<string | null>(null)
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([])
  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => {
    void getDemoAccounts().then(setDemoAccounts)
  }, [])

  if (state.session) {
    return <Navigate to={homeForRole(state.session.role)} replace />
  }

  const from = (location.state as { from?: string } | null)?.from

  async function signIn(credentials: { email: string; password: string }) {
    setError(null)
    setSubmitting(true)
    try {
      const session = await login(credentials)
      dispatch({ type: 'SET_SESSION', session })
      toast.success(`Welcome back, ${session.full_name.split(' ')[0]}`, {
        description: `Signed in as ${ROLE_LABEL[session.role]}`,
      })
      navigate(from ?? homeForRole(session.role), { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
      setPendingDemo(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await signIn({ email, password })
  }

  async function handleDemo(account: DemoAccount) {
    setPendingDemo(account.role)
    setEmail(account.email)
    setPassword(account.password)
    await signIn({ email: account.email, password: account.password })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to run plans, subscriptions and recurring billing."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New to Brightloop?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@brightloop.in"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              className="pr-9 pl-8"
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full gap-2" disabled={submitting}>
          {submitting && pendingDemo === null ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Demo accounts
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-2">
          {demoAccounts.map((account) => (
            <button
              key={account.role}
              type="button"
              disabled={submitting}
              onClick={() => void handleDemo(account)}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
            >
              <span>
                <span className="block font-medium text-foreground">
                  {ROLE_LABEL[account.role]}
                </span>
                <span className="block text-[11px] text-muted-foreground">{account.email}</span>
              </span>
              {pendingDemo === account.role ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <ArrowRight className="size-3.5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={email} />
    </AuthLayout>
  )
}
