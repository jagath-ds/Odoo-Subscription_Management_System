import { useState } from 'react'
import { toast } from 'sonner'
import { PasswordChecklist } from '@/components/auth/PasswordChecklist'
import { Field } from '@/components/common/Field'
import { FormDialog } from '@/components/common/FormDialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { validatePassword } from '@/lib/validation'
import { addStaff } from '@/services/api'
import type { Role } from '@/types/contracts'

interface AddStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddStaffDialog({ open, onOpenChange, onSuccess }: AddStaffDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('STAFF')
  const [password, setPassword] = useState('')

  const passwordValidation = validatePassword(password)
  const canSubmit = fullName.trim().length > 0 && email.trim().length > 0 && passwordValidation.valid

  async function handleSubmit() {
    await addStaff({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      password,
    })
    toast.success(`Staff member ${fullName} added with role ${role}`)
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('STAFF')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Staff Member"
      description="Create internal team credentials. Only administrators can add staff."
      submitLabel="Create Staff Member"
      pendingLabel="Creating…"
      onSubmit={handleSubmit}
      submitDisabled={!canSubmit}
      size="md"
    >
      <div className="space-y-4">
        <Field label="Full Name" htmlFor="staff-name" required>
          <Input
            id="staff-name"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </Field>

        <Field label="Work Email" htmlFor="staff-email" required hint="Must be a unique email address">
          <Input
            id="staff-email"
            type="email"
            placeholder="e.g. rahul@brightloop.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="Access Role" htmlFor="staff-role" required hint="Admins manage catalog and staff; Staff handle operations">
          <Select value={role} onValueChange={(val) => setRole(val as Role)}>
            <SelectTrigger id="staff-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STAFF">Staff (Operations & Quotations)</SelectItem>
              <SelectItem value="ADMIN">Admin (Full Access & Studio)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="space-y-2 pt-1 border-t border-border/40">
          <Field
            label="Temporary Password"
            htmlFor="staff-password"
            required
            hint="Enforce strict enterprise password policy"
          >
            <Input
              id="staff-password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <PasswordChecklist value={password} className="mt-2" />
        </div>
      </div>
    </FormDialog>
  )
}
