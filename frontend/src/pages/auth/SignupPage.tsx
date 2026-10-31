import { ArrowRight, Eye, EyeOff, Loader2, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordChecklist } from '@/components/auth/PasswordChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isEmail, validatePassword } from '@/lib/validation'
import { useApp } from '@/mocks/store/AppStore'
import { ApiError, signup } from '@/services/api'

export function SignupPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (state.session) {
    return <Navigate to={state.session.role === 'CUSTOMER' ? '/portal' : '/dashboard'} replace />
  }

  const passwordCheck = validatePassword(password)
  const emailValid = isEmail(email)
  const passwordsMatch = password.length > 0 && password === confirm
  const canSubmit = fullName.trim().length > 1 && emailValid && passwordCheck.valid && passwordsMatch

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const session = await signup({ full_name: fullName, email, password })
      dispatch({ type: 'SET_SESSION', session })
      toast.success('Account created', {
        description: 'You are signed in to the self-service portal.',
      })
      navigate('/portal', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account per email. Customers get the self-service portal by default."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Full name</Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="full-name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Priya Nair"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Work email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.in"
              className="pl-8"
              aria-invalid={email.length > 0 && !emailValid}
            />
          </div>
          {email.length > 0 && !emailValid ? (
            <p className="text-[11px] text-destructive">Enter a valid email address.</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="More than 8 characters"
              className="pr-9"
              aria-describedby="password-rules"
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
          <div id="password-rules" className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
            <PasswordChecklist value={password} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat your password"
            aria-invalid={confirm.length > 0 && !passwordsMatch}
          />
          {confirm.length > 0 && !passwordsMatch ? (
            <p className="text-[11px] text-destructive">Passwords do not match.</p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full gap-2" disabled={!canSubmit || submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          New accounts are created with the CUSTOMER role. Only an Admin can add Staff members.
        </p>
      </form>
    </AuthLayout>
  )
}
