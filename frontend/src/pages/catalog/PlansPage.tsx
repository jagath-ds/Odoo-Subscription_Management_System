import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  FrequencyBadge,
  PermissionBadge,
  PlanAvailabilityBadge,
} from '@/components/catalog/CatalogBadges'
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Field } from '@/components/common/Field'
import { FormDialog } from '@/components/common/FormDialog'
import { ListToolbar } from '@/components/common/ListToolbar'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  FREQUENCY_LABELS,
  formatWindow,
  planAvailability,
} from '@/lib/catalog'
import { formatINR } from '@/lib/format'
import { useApp } from '@/mocks/store/AppStore'
import { createPlan, deletePlan, listPlans, updatePlan } from '@/services/api'
import type { PlanInput } from '@/services/api'
import type { BillingFrequency, Plan } from '@/types/contracts'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}

const FREQUENCIES: BillingFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

const FREQUENCY_ITEMS: Record<string, string> = {
  ALL: 'All frequencies',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
}

const AVAILABILITY_ITEMS: Record<string, string> = {
  ALL: 'Any availability',
  AVAILABLE: 'Available',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
}

export function PlansPage() {
  const { state } = useApp()
  const [rows, setRows] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState<'ALL' | BillingFrequency>('ALL')
  const [availabilityFilter, setAvailabilityFilter] = useState<
    'ALL' | 'AVAILABLE' | 'SCHEDULED' | 'EXPIRED'
  >('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRows(await listPlans())
    } catch (cause) {
      setLoadError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        FREQUENCY_LABELS[row.billing_frequency].toLowerCase().includes(needle)
      const matchesFrequency =
        frequencyFilter === 'ALL' || row.billing_frequency === frequencyFilter
      const matchesAvailability =
        availabilityFilter === 'ALL' ||
        planAvailability(row, state.today) === availabilityFilter
      return matchesSearch && matchesFrequency && matchesAvailability
    })
  }, [rows, search, frequencyFilter, availabilityFilter, state.today])

  const columns: Array<DataTableColumn<Plan>> = [
    {
      id: 'name',
      header: 'Plan',
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {FREQUENCY_LABELS[row.billing_frequency]} billing
          </p>
        </div>
      ),
    },
    {
      id: 'frequency',
      header: 'Frequency',
      cell: (row) => <FrequencyBadge frequency={row.billing_frequency} />,
    },
    {
      id: 'price',
      header: 'Plan price',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums text-foreground">{formatINR(row.plan_price)}</span>
      ),
    },
    {
      id: 'min_qty',
      header: 'Min qty',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.min_qty}</span>,
    },
    {
      id: 'availability',
      header: 'Availability',
      cell: (row) => (
        <div className="space-y-1">
          <PlanAvailabilityBadge state={planAvailability(row, state.today)} />
          <p className="text-[11px] text-muted-foreground">
            {formatWindow(row.available_from, row.available_until)}
          </p>
        </div>
      ),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: (row) => (
        <div className="flex max-w-[230px] flex-wrap gap-1">
          <PermissionBadge enabled={row.auto_close} label="Auto close" />
          <PermissionBadge enabled={row.can_close_early} label="Early close" />
          <PermissionBadge enabled={row.can_pause} label="Pause" />
          <PermissionBadge enabled={row.can_renew} label="Renew" />
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.name}`}
            onClick={() => {
              setEditing(row)
              setFormOpen(true)
            }}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            aria-label={`Delete ${row.name}`}
            onClick={() => setDeleting(row)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Plans"
        description="Billing frequency, minimum quantity and the four permissions that gate every subscription action. The engine mirrors these flags exactly."
        badge={
          <Badge variant="outline" className="border-border/70 text-muted-foreground">
            Mock data
          </Badge>
        }
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus />
            New plan
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search plans…"
        meta={`${filtered.length} of ${rows.length} plans`}
      >
        <Select
          items={FREQUENCY_ITEMS}
          value={frequencyFilter}
          onValueChange={(value) => value && setFrequencyFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All frequencies</SelectItem>
            {FREQUENCIES.map((frequency) => (
              <SelectItem key={frequency} value={frequency}>
                {FREQUENCY_LABELS[frequency]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={AVAILABILITY_ITEMS}
          value={availabilityFilter}
          onValueChange={(value) => value && setAvailabilityFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any availability</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>

      <div className="mt-3 overflow-hidden rounded-xl border border-border/80 bg-card">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            loadError ? (
              <EmptyState
                icon={RefreshCw}
                title="Could not load plans"
                message={loadError}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No plans yet"
                message="Add a plan before creating a subscription."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus />
                    New plan
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No plans match"
                message="Try a different search, frequency or availability filter."
              />
            )
          }
        />
      </div>

      <PlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        plan={editing}
        onSaved={() => void load()}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'plan'}?`}
        description="Existing subscriptions keep their plan snapshot. Plans used by a quotation template are protected."
        onConfirm={async () => {
          if (!deleting) return
          await deletePlan(deleting.id)
          toast.success('Plan deleted', { description: deleting.name })
          setDeleting(null)
          await load()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Plan form                                                           */
/* ------------------------------------------------------------------ */

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan | null
  onSaved: () => void
}

function PlanFormDialog({ open, onOpenChange, plan, onSaved }: PlanFormDialogProps) {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<BillingFrequency>('MONTHLY')
  const [planPrice, setPlanPrice] = useState('0')
  const [minQty, setMinQty] = useState('1')
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableUntil, setAvailableUntil] = useState('')
  const [autoClose, setAutoClose] = useState(true)
  const [canCloseEarly, setCanCloseEarly] = useState(true)
  const [canPause, setCanPause] = useState(true)
  const [canRenew, setCanRenew] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(plan?.name ?? '')
    setFrequency(plan?.billing_frequency ?? 'MONTHLY')
    setPlanPrice(String(plan?.plan_price ?? 0))
    setMinQty(String(plan?.min_qty ?? 1))
    setAvailableFrom(plan?.available_from ?? '')
    setAvailableUntil(plan?.available_until ?? '')
    setAutoClose(plan?.auto_close ?? true)
    setCanCloseEarly(plan?.can_close_early ?? true)
    setCanPause(plan?.can_pause ?? true)
    setCanRenew(plan?.can_renew ?? true)
  }, [open, plan])

  async function handleSubmit() {
    const input: PlanInput = {
      name,
      billing_frequency: frequency,
      plan_price: Number(planPrice),
      min_qty: Number(minQty),
      available_from: availableFrom || null,
      available_until: availableUntil || null,
      auto_close: autoClose,
      can_close_early: canCloseEarly,
      can_pause: canPause,
      can_renew: canRenew,
    }
    if (plan) {
      await updatePlan(plan.id, input)
    } else {
      await createPlan(input)
    }
    toast.success(plan ? 'Plan updated' : 'Plan created', { description: input.name })
    onOpenChange(false)
    onSaved()
  }

  const permissions: Array<{
    id: string
    label: string
    hint: string
    checked: boolean
    onChange: (checked: boolean) => void
  }> = [
    {
      id: 'auto-close',
      label: 'Auto close at end date',
      hint: 'The billing run closes the subscription when it expires.',
      checked: autoClose,
      onChange: setAutoClose,
    },
    {
      id: 'close-early',
      label: 'Allow early close',
      hint: 'Staff can close the subscription before its expiry date.',
      checked: canCloseEarly,
      onChange: setCanCloseEarly,
    },
    {
      id: 'pause',
      label: 'Allow pause',
      hint: 'Pausing shifts the next billing date by the paused period.',
      checked: canPause,
      onChange: setCanPause,
    },
    {
      id: 'renew',
      label: 'Allow renew',
      hint: 'Staff can renew the subscription for another term.',
      checked: canRenew,
      onChange: setCanRenew,
    },
  ]

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? 'Edit plan' : 'New plan'}
      description="Permissions are enforced by the transition engine, not just hidden in the UI."
      submitLabel={plan ? 'Save changes' : 'Create plan'}
      onSubmit={handleSubmit}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Plan name" htmlFor="plan-name" required>
          <Input
            id="plan-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Growth Monthly"
            autoFocus
          />
        </Field>

        <Field label="Billing frequency" required>
          <Select
            items={FREQUENCY_ITEMS}
            value={frequency}
            onValueChange={(value) => value && setFrequency(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {FREQUENCY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Plan price (₹)" htmlFor="plan-price" required>
          <Input
            id="plan-price"
            type="number"
            min="0"
            step="0.01"
            value={planPrice}
            onChange={(event) => setPlanPrice(event.target.value)}
          />
        </Field>
        <Field
          label="Minimum quantity"
          htmlFor="plan-qty"
          hint="Quotes below this quantity are rejected."
          required
        >
          <Input
            id="plan-qty"
            type="number"
            min="1"
            step="1"
            value={minQty}
            onChange={(event) => setMinQty(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Available from" htmlFor="plan-from" hint="Leave blank for no start limit.">
          <Input
            id="plan-from"
            type="date"
            value={availableFrom}
            onChange={(event) => setAvailableFrom(event.target.value)}
          />
        </Field>
        <Field label="Available until" htmlFor="plan-until" hint="Leave blank to keep selling.">
          <Input
            id="plan-until"
            type="date"
            value={availableUntil}
            onChange={(event) => setAvailableUntil(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">Plan permissions</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5"
            >
              <div className="space-y-0.5">
                <Label htmlFor={`plan-${permission.id}`} className="text-xs">
                  {permission.label}
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {permission.hint}
                </p>
              </div>
              <Switch
                id={`plan-${permission.id}`}
                checked={permission.checked}
                onCheckedChange={permission.onChange}
              />
            </div>
          ))}
        </div>
      </div>
    </FormDialog>
  )
}
