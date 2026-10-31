import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgePercent, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DiscountStateBadge } from '@/components/catalog/CatalogBadges'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { discountState, formatWindow } from '@/lib/catalog'
import type { DiscountState } from '@/lib/catalog'
import { formatINR, formatPercent } from '@/lib/format'
import { useApp } from '@/mocks/store/AppStore'
import {
  createDiscountRule,
  deleteDiscountRule,
  listDiscountRules,
  updateDiscountRule,
} from '@/services/api'
import type { DiscountRuleInput } from '@/services/api'
import type {
  DiscountRule,
  DiscountScope,
  DiscountType,
} from '@/types/contracts'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}

function discountValue(rule: DiscountRule): string {
  return rule.discount_type === 'PERCENT'
    ? formatPercent(rule.value)
    : formatINR(rule.value)
}

const STATES: DiscountState[] = ['ACTIVE', 'SCHEDULED', 'EXPIRED', 'EXHAUSTED']

const SCOPE_FILTER_ITEMS: Record<string, string> = {
  ALL: 'Any scope',
  PRODUCT: 'Product',
  SUBSCRIPTION: 'Subscription',
}

const STATE_FILTER_ITEMS: Record<string, string> = {
  ALL: 'Any state',
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
  EXHAUSTED: 'Exhausted',
}

const DISCOUNT_TYPE_ITEMS: Record<string, string> = {
  PERCENT: 'Percentage',
  FIXED: 'Fixed amount',
}

const DISCOUNT_SCOPE_ITEMS: Record<string, string> = {
  PRODUCT: 'Product line',
  SUBSCRIPTION: 'Whole subscription',
}

export function DiscountRulesPage() {
  const { state } = useApp()
  const [rows, setRows] = useState<DiscountRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'ALL' | DiscountScope>('ALL')
  const [stateFilter, setStateFilter] = useState<'ALL' | DiscountState>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [deleting, setDeleting] = useState<DiscountRule | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRows(await listDiscountRules())
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
        row.scope.toLowerCase().includes(needle) ||
        row.discount_type.toLowerCase().includes(needle)
      const matchesScope = scopeFilter === 'ALL' || row.scope === scopeFilter
      const matchesState =
        stateFilter === 'ALL' || discountState(row, state.today) === stateFilter
      return matchesSearch && matchesScope && matchesState
    })
  }, [rows, search, scopeFilter, stateFilter, state.today])

  const columns: Array<DataTableColumn<DiscountRule>> = [
    {
      id: 'name',
      header: 'Discount',
      cell: (row) => (
        <div className="min-w-[190px]">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.scope === 'SUBSCRIPTION' ? 'Subscription scope' : 'Product scope'}
          </p>
        </div>
      ),
    },
    {
      id: 'value',
      header: 'Value',
      cell: (row) => (
        <div className="space-y-1">
          <p className="tabular-nums font-medium text-foreground">{discountValue(row)}</p>
          <Badge variant="outline" className="border-border/70 text-[10px]">
            {row.discount_type}
          </Badge>
        </div>
      ),
    },
    {
      id: 'conditions',
      header: 'Conditions',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Min qty <span className="text-foreground">{row.min_qty}</span>
          </p>
          <p>
            Min purchase{' '}
            <span className="text-foreground">
              {row.min_purchase > 0 ? formatINR(row.min_purchase) : 'None'}
            </span>
          </p>
        </div>
      ),
    },
    {
      id: 'validity',
      header: 'Validity',
      cell: (row) => (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {formatWindow(row.valid_from, row.valid_until)}
          </p>
          <DiscountStateBadge state={discountState(row, state.today)} />
        </div>
      ),
    },
    {
      id: 'usage',
      header: 'Usage',
      cell: (row) => {
        const percent =
          row.max_uses === null
            ? 0
            : Math.min(100, Math.round((row.current_uses / row.max_uses) * 100))
        return (
          <div className="min-w-[100px] space-y-1">
            <p className="text-xs tabular-nums text-muted-foreground">
              <span className="text-foreground">{row.current_uses}</span>
              {row.max_uses === null ? ' / unlimited' : ` / ${row.max_uses}`}
            </p>
            {row.max_uses === null ? (
              <p className="text-[10px] text-muted-foreground/70">No usage cap</p>
            ) : (
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        )
      },
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
        title="Discount Rules"
        description="Percentage or fixed discounts with quantity, purchase, validity and usage limits. Usage increments once per billed invoice."
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
            New discount rule
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search discount rules…"
        meta={`${filtered.length} of ${rows.length} rules`}
      >
        <Select
          items={SCOPE_FILTER_ITEMS}
          value={scopeFilter}
          onValueChange={(value) => value && setScopeFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[132px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any scope</SelectItem>
            <SelectItem value="PRODUCT">Product</SelectItem>
            <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
          </SelectContent>
        </Select>

        <Select
          items={STATE_FILTER_ITEMS}
          value={stateFilter}
          onValueChange={(value) => value && setStateFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[132px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any state</SelectItem>
            {STATES.map((discountStateOption) => (
              <SelectItem key={discountStateOption} value={discountStateOption}>
                {discountStateOption.charAt(0) +
                  discountStateOption.slice(1).toLowerCase()}
              </SelectItem>
            ))}
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
                title="Could not load discount rules"
                message={loadError}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={BadgePercent}
                title="No discount rules yet"
                message="Add a rule so quotations can apply a controlled discount."
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
                    New discount rule
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No discount rules match"
                message="Try a different search, scope or state."
              />
            )
          }
        />
      </div>

      <DiscountRuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editing}
        onSaved={() => void load()}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'discount rule'}?`}
        description="Issued invoices keep the discount already applied to their lines."
        onConfirm={async () => {
          if (!deleting) return
          await deleteDiscountRule(deleting.id)
          toast.success('Discount rule deleted', { description: deleting.name })
          setDeleting(null)
          await load()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Discount form                                                       */
/* ------------------------------------------------------------------ */

interface DiscountRuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: DiscountRule | null
  onSaved: () => void
}

function DiscountRuleFormDialog({
  open,
  onOpenChange,
  rule,
  onSaved,
}: DiscountRuleFormDialogProps) {
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENT')
  const [value, setValue] = useState('10')
  const [scope, setScope] = useState<DiscountScope>('SUBSCRIPTION')
  const [minQty, setMinQty] = useState('1')
  const [minPurchase, setMinPurchase] = useState('0')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [maxUses, setMaxUses] = useState('')

  useEffect(() => {
    if (!open) return
    setName(rule?.name ?? '')
    setDiscountType(rule?.discount_type ?? 'PERCENT')
    setValue(String(rule?.value ?? 10))
    setScope(rule?.scope ?? 'SUBSCRIPTION')
    setMinQty(String(rule?.min_qty ?? 1))
    setMinPurchase(String(rule?.min_purchase ?? 0))
    setValidFrom(rule?.valid_from ?? '')
    setValidUntil(rule?.valid_until ?? '')
    setMaxUses(rule?.max_uses === null || rule?.max_uses === undefined ? '' : String(rule.max_uses))
  }, [open, rule])

  async function handleSubmit() {
    const input: DiscountRuleInput = {
      name,
      discount_type: discountType,
      value: Number(value),
      scope,
      min_qty: Number(minQty),
      min_purchase: Number(minPurchase),
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      max_uses: maxUses.trim() ? Number(maxUses) : null,
    }
    if (rule) {
      await updateDiscountRule(rule.id, input)
    } else {
      await createDiscountRule(input)
    }
    toast.success(rule ? 'Discount rule updated' : 'Discount rule created', {
      description: input.name,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={rule ? 'Edit discount rule' : 'New discount rule'}
      description="Conditions are checked by the pricing engine before a discount is applied."
      submitLabel={rule ? 'Save changes' : 'Create rule'}
      onSubmit={handleSubmit}
      size="lg"
      footerNote={
        rule ? `Already used ${rule.current_uses} times.` : undefined
      }
    >
      <Field label="Discount name" htmlFor="discount-name" required>
        <Input
          id="discount-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. 10% Off 10+ Seats"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Type" required>
          <Select
            items={DISCOUNT_TYPE_ITEMS}
            value={discountType}
            onValueChange={(next) => next && setDiscountType(next)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">Percentage</SelectItem>
              <SelectItem value="FIXED">Fixed amount</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={discountType === 'PERCENT' ? 'Percentage off' : 'Amount off (₹)'}
          htmlFor="discount-value"
          required
        >
          <Input
            id="discount-value"
            type="number"
            min="0.01"
            max={discountType === 'PERCENT' ? '100' : undefined}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        <Field label="Scope" required>
          <Select
            items={DISCOUNT_SCOPE_ITEMS}
            value={scope}
            onValueChange={(next) => next && setScope(next)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCT">Product line</SelectItem>
              <SelectItem value="SUBSCRIPTION">Whole subscription</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Minimum quantity" htmlFor="discount-qty" required>
          <Input
            id="discount-qty"
            type="number"
            min="1"
            step="1"
            value={minQty}
            onChange={(event) => setMinQty(event.target.value)}
          />
        </Field>
        <Field label="Minimum purchase (₹)" htmlFor="discount-min" required>
          <Input
            id="discount-min"
            type="number"
            min="0"
            step="0.01"
            value={minPurchase}
            onChange={(event) => setMinPurchase(event.target.value)}
          />
        </Field>
        <Field
          label="Maximum uses"
          htmlFor="discount-uses"
          hint="Blank means unlimited."
        >
          <Input
            id="discount-uses"
            type="number"
            min="1"
            step="1"
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
            placeholder="Unlimited"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Valid from" htmlFor="discount-from" hint="Blank means no start date.">
          <Input
            id="discount-from"
            type="date"
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
          />
        </Field>
        <Field label="Valid until" htmlFor="discount-until" hint="Blank means no end date.">
          <Input
            id="discount-until"
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </Field>
      </div>
    </FormDialog>
  )
}
