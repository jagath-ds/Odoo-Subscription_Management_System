import { ArrowRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordChecklist } from '@/components/auth/PasswordChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validatePassword } from '@/lib/validation'
import { ApiError, resetPassword } from '@/services/api'

/** Landing page for the emailed reset link: /reset-password?token=... */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordsMatch = password.length > 0 && password === confirm
  const canSubmit = token.length > 0 && validatePassword(password).valid && passwordsMatch

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword({ token, new_password: password })
      toast.success('Password updated', { description: 'Sign in with your new password.' })
      navigate('/login', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Reset links are single-use and expire after a short time."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!token ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            This reset link is missing its token. Request a new link from the sign-in page.
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="More than 8 characters"
          />
          <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
            <PasswordChecklist value={password} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
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
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
