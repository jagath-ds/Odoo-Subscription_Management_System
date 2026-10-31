import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, CreditCard, Landmark, QrCode } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatINR } from '@/lib/format'
import { DEMO_TODAY } from '@/mocks/fixtures'
import { recordPayment } from '@/services/api'
import type { InvoiceDetail, PaymentMethod } from '@/types/contracts'

interface RecordPaymentDialogProps {
  invoice: InvoiceDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updatedInvoice: InvoiceDetail) => void
}

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI')
  const [amount, setAmount] = useState<number>(invoice?.amount_due ?? 0)
  const [paymentDate, setPaymentDate] = useState<string>(DEMO_TODAY)
  const [note, setNote] = useState<string>('')

  if (!invoice) return null

  const canSubmit = amount > 0 && amount <= invoice.amount_due

  async function handleSubmit() {
    if (!invoice) return
    const updated = await recordPayment({
      invoice_id: invoice.id,
      payment_method: paymentMethod,
      amount,
      payment_date: paymentDate,
      note: note.trim() || null,
    })
    toast.success(
      `Payment of ${formatINR(amount)} recorded. Invoice is now ${updated.status}.`,
    )
    onOpenChange(false)
    onSuccess(updated)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Record Payment for ${invoice.invoice_number}`}
      description={`Outstanding balance: ${formatINR(invoice.amount_due)} · Customer: ${invoice.customer_name}`}
      submitLabel="Confirm Payment"
      pendingLabel="Recording…"
      onSubmit={handleSubmit}
      submitDisabled={!canSubmit}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Method" htmlFor="payment-method" required>
            <Select
              value={paymentMethod}
              onValueChange={(val) => setPaymentMethod((val ?? 'UPI') as PaymentMethod)}
            >
              <SelectTrigger id="payment-method" className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="size-3.5 text-emerald-400" /> UPI
                  </span>
                </SelectItem>
                <SelectItem value="BANK_TRANSFER" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="size-3.5 text-primary" /> Bank Transfer (NEFT/RTGS)
                  </span>
                </SelectItem>
                <SelectItem value="CARD" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-indigo-400" /> Credit / Debit Card
                  </span>
                </SelectItem>
                <SelectItem value="CASH" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="size-3.5 text-amber-400" /> Cash / Cheque
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Payment Date"
            htmlFor="payment-date"
            required
            hint="Transaction posting date"
          >
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="text-xs h-9"
              required
            />
          </Field>
        </div>

        <Field
          label="Amount to Pay (INR)"
          htmlFor="payment-amount"
          required
          hint={`Max allowed: ${formatINR(invoice.amount_due)} (Overpayments are rejected)`}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
              ₹
            </span>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.amount_due}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="pl-7 font-mono text-xs h-9"
              required
            />
          </div>
          {amount > invoice.amount_due && (
            <p className="text-[11px] text-destructive font-medium mt-1">
              Amount exceeds outstanding balance of {formatINR(invoice.amount_due)}.
            </p>
          )}
        </Field>

        <Field label="Reference / Transaction Note" htmlFor="payment-note" hint="Optional reference number or UTR">
          <Textarea
            id="payment-note"
            placeholder="e.g. UTR / Ref No: HDFC99281203"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs h-20"
          />
        </Field>
      </div>
    </FormDialog>
  )
}
