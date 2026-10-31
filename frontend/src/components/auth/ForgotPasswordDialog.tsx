import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isEmail } from '@/lib/validation'
import { requestPasswordReset } from '@/services/api'

interface ForgotPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEmail?: string
}

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultEmail = '',
}: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail)
      setStatus('idle')
      setError(null)
    }
  }, [open, defaultEmail])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter the email registered to your account.')
      return
    }
    setError(null)
    setStatus('sending')
    try {
      await requestPasswordReset(email)
      setStatus('sent')
    } catch {
      setStatus('idle')
      setError('Could not send the reset link. Try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {status === 'sent' ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-center">Reset link sent</DialogTitle>
              <DialogDescription className="text-center">
                We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
                The link expires in 30 minutes.
              </DialogDescription>
            </div>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              Back to sign in
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Mock mode — no real email is delivered.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>
                Enter the email on your Brightloop account and we will send a reset link.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@brightloop.in"
                  className="pl-8"
                  aria-invalid={Boolean(error)}
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>

            <Button type="submit" className="w-full" disabled={status === 'sending'}>
              {status === 'sending' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Sending reset link…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
