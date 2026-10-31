import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, ReceiptText, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ActiveBadge } from '@/components/catalog/CatalogBadges'
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
import { formatPercent } from '@/lib/format'
import { createTaxRule, deleteTaxRule, listTaxRules, updateTaxRule } from '@/services/api'
import type { TaxRuleInput } from '@/services/api'
import type { TaxRule } from '@/types/contracts'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}

const STATUS_ITEMS: Record<string, string> = {
  ALL: 'All statuses',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
}

function toTaxRuleInput(rule: TaxRule): TaxRuleInput {
  return { name: rule.name, rate_percent: rule.rate_percent, is_active: rule.is_active }
}

export function TaxRulesPage() {
  const [rows, setRows] = useState<TaxRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaxRule | null>(null)
  const [deleting, setDeleting] = useState<TaxRule | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRows(await listTaxRules())
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
        String(row.rate_percent).includes(needle)
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? row.is_active : !row.is_active)
      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  async function handleToggle(rule: TaxRule, active: boolean) {
    try {
      await updateTaxRule(rule.id, { ...toTaxRuleInput(rule), is_active: active })
      toast.success(active ? 'Tax rule activated' : 'Tax rule deactivated', {
        description: rule.name,
      })
      await load()
    } catch (cause) {
      toast.error('Could not update tax rule', { description: errorMessage(cause) })
    }
  }

  const columns: Array<DataTableColumn<TaxRule>> = [
    {
      id: 'name',
      header: 'Tax rule',
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">Applied per invoice line</p>
        </div>
      ),
    },
    {
      id: 'rate',
      header: 'Rate',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums text-lg font-semibold text-foreground">
          {formatPercent(row.rate_percent, 2)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={row.is_active}
            onCheckedChange={(checked) => void handleToggle(row, checked)}
            aria-label={`Toggle ${row.name}`}
          />
          <ActiveBadge active={row.is_active} />
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
        title="Tax Rules"
        description="Admin-defined rates such as GST 18%. The rate is frozen into the invoice snapshot, so editing a rule never rewrites an issued invoice."
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
            New tax rule
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search tax rules…"
        meta={`${filtered.length} of ${rows.length} rules`}
      >
        <Select
          items={STATUS_ITEMS}
          value={statusFilter}
          onValueChange={(value) => value && setStatusFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[126px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
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
                title="Could not load tax rules"
                message={loadError}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No tax rules yet"
                message="Add GST or an exempt rule so invoice lines can be taxed."
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
                    New tax rule
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No tax rules match"
                message="Try a different search term or status."
              />
            )
          }
        />
      </div>

      <TaxRuleFormDialog
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
        title={`Delete ${deleting?.name ?? 'tax rule'}?`}
        description="Issued invoices keep their tax percent snapshot. New subscription lines will need another rule."
        onConfirm={async () => {
          if (!deleting) return
          await deleteTaxRule(deleting.id)
          toast.success('Tax rule deleted', { description: deleting.name })
          setDeleting(null)
          await load()
        }}
      />
    </div>
  )
}

interface TaxRuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: TaxRule | null
  onSaved: () => void
}

function TaxRuleFormDialog({ open, onOpenChange, rule, onSaved }: TaxRuleFormDialogProps) {
  const [name, setName] = useState('')
  const [rate, setRate] = useState('18')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(rule?.name ?? '')
    setRate(String(rule?.rate_percent ?? 18))
    setIsActive(rule?.is_active ?? true)
  }, [open, rule])

  async function handleSubmit() {
    const input: TaxRuleInput = {
      name,
      rate_percent: Number(rate),
      is_active: isActive,
    }
    if (rule) {
      await updateTaxRule(rule.id, input)
    } else {
      await createTaxRule(input)
    }
    toast.success(rule ? 'Tax rule updated' : 'Tax rule created', {
      description: input.name,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={rule ? 'Edit tax rule' : 'New tax rule'}
      description="The rate is copied onto each invoice line as a snapshot at billing time."
      submitLabel={rule ? 'Save changes' : 'Create tax rule'}
      onSubmit={handleSubmit}
      size="sm"
    >
      <Field label="Tax name" htmlFor="tax-name" required>
        <Input
          id="tax-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. GST 18%"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Rate (%)" htmlFor="tax-rate" required>
          <Input
            id="tax-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>
        <Field label="Availability">
          <div className="flex h-8 items-center gap-2">
            <Switch id="tax-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="tax-active" className="text-xs text-muted-foreground">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
          </div>
        </Field>
      </div>
    </FormDialog>
  )
}
