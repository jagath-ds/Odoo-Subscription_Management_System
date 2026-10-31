import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  ApiError,
  createQuotationTemplate,
  deleteQuotationTemplate,
  listPlans,
  listProducts,
  listQuotationTemplates,
  updateQuotationTemplate,
} from '@/services/api'
import type { QuotationTemplateInput } from '@/services/api'
import type {
  Plan,
  ProductWithVariants,
  QuotationTemplateDetail,
} from '@/types/contracts'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}

export function QuotationTemplatesPage() {
  const [rows, setRows] = useState<QuotationTemplateDetail[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<QuotationTemplateDetail | null>(null)
  const [deleting, setDeleting] = useState<QuotationTemplateDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextTemplates, nextPlans, nextProducts] = await Promise.all([
        listQuotationTemplates(),
        listPlans(),
        listProducts(),
      ])
      setRows(nextTemplates)
      setPlans(nextPlans)
      setProducts(nextProducts)
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
        row.plan_name.toLowerCase().includes(needle) ||
        row.lines.some((line) => line.product_name.toLowerCase().includes(needle))
      const matchesPlan =
        planFilter === 'ALL' || row.plan_id === Number(planFilter)
      return matchesSearch && matchesPlan
    })
  }, [rows, search, planFilter])

  const canCreate = plans.length > 0 && products.length > 0

  const planFilterItems = [
    { label: 'All plans', value: 'ALL' },
    ...plans.map((plan) => ({ label: plan.name, value: String(plan.id) })),
  ]

  const columns: Array<DataTableColumn<QuotationTemplateDetail>> = [
    {
      id: 'name',
      header: 'Template',
      cell: (row) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.plan_name}</p>
        </div>
      ),
    },
    {
      id: 'lines',
      header: 'Lines',
      cell: (row) => (
        <div className="flex max-w-[280px] flex-wrap items-center gap-1">
          <Badge variant="outline" className="border-border/70 text-[10px]">
            {row.lines.length} line{row.lines.length === 1 ? '' : 's'}
          </Badge>
          {row.lines.slice(0, 2).map((line) => (
            <Badge
              key={line.id}
              variant="secondary"
              className="max-w-[130px] truncate text-[10px]"
            >
              {line.product_name}
            </Badge>
          ))}
          {row.lines.length > 2 ? (
            <Badge variant="outline" className="border-border/70 text-[10px]">
              +{row.lines.length - 2}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'validity',
      header: 'Quote validity',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums text-foreground">{row.validity_days} days</span>
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

  function renderExpanded(template: QuotationTemplateDetail) {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-foreground">Template lines</p>
            <p className="text-[11px] text-muted-foreground">
              Quotations created from this template copy these products, variants and
              quantities.
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Valid for {template.validity_days} days from issue
          </p>
        </div>

        <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-background">
          {template.lines.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs"
            >
              <span className="font-medium text-foreground">{line.product_name}</span>
              {line.variant_name ? (
                <Badge variant="outline" className="border-border/70 text-[10px]">
                  {line.variant_name}
                </Badge>
              ) : null}
              <span className="ml-auto tabular-nums text-muted-foreground">
                Qty {line.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Quotation Templates"
        description="Preset plan and product lines that staff turn into a subscription in one step. Templates are admin-owned; staff can only use them."
        badge={
          <Badge variant="outline" className="border-border/70 text-muted-foreground">
            Mock data
          </Badge>
        }
        actions={
          <Button
            type="button"
            size="sm"
            disabled={!canCreate}
            title={
              canCreate
                ? undefined
                : 'Add at least one plan and one product before creating a template.'
            }
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus />
            New template
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search templates, plans or products…"
        meta={`${filtered.length} of ${rows.length} templates`}
      >
        <Select
          items={planFilterItems}
          value={planFilter}
          onValueChange={(value) => value && setPlanFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[168px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All plans</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={String(plan.id)}>
                {plan.name}
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
          renderExpanded={renderExpanded}
          expandedLabel={(row) =>
            `Show ${row.lines.length} line${row.lines.length === 1 ? '' : 's'} for ${row.name}`
          }
          empty={
            loadError ? (
              <EmptyState
                icon={RefreshCw}
                title="Could not load templates"
                message={loadError}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No quotation templates yet"
                message="Create a template so staff can start subscriptions in one step."
                action={
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canCreate}
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus />
                    New template
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No templates match"
                message="Try a different search term or plan."
              />
            )
          }
        />
      </div>

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
        plans={plans}
        products={products}
        onSaved={() => void load()}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'template'}?`}
        description="Subscriptions already created from this template are not affected."
        onConfirm={async () => {
          if (!deleting) return
          await deleteQuotationTemplate(deleting.id)
          toast.success('Template deleted', { description: deleting.name })
          setDeleting(null)
          await load()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Template form                                                       */
/* ------------------------------------------------------------------ */

interface DraftLine {
  key: string
  product_id: number | null
  variant_id: number | null
  quantity: string
}

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: QuotationTemplateDetail | null
  plans: Plan[]
  products: ProductWithVariants[]
  onSaved: () => void
}

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  plans,
  products,
  onSaved,
}: TemplateFormDialogProps) {
  const [name, setName] = useState('')
  const [planId, setPlanId] = useState<number | null>(null)
  const [validityDays, setValidityDays] = useState('15')
  const [lines, setLines] = useState<DraftLine[]>([])
  const lineCounter = useRef(1)

  function newLine(): DraftLine {
    const key = `draft-${lineCounter.current}`
    lineCounter.current += 1
    return { key, product_id: null, variant_id: null, quantity: '1' }
  }

  useEffect(() => {
    if (!open) return
    setName(template?.name ?? '')
    setPlanId(template?.plan_id ?? null)
    setValidityDays(String(template?.validity_days ?? 15))
    setLines(
      template && template.lines.length > 0
        ? template.lines.map((line) => ({
            key: `edit-${line.id}`,
            product_id: line.product_id,
            variant_id: line.variant_id,
            quantity: String(line.quantity),
          }))
        : [newLine()],
    )
    // newLine only touches a ref; template/open are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template])

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  function removeLine(key: string) {
    setLines((previous) => previous.filter((line) => line.key !== key))
  }

  async function handleSubmit() {
    if (planId === null) {
      throw new ApiError('INVALID_INPUT', 'Choose a plan for this template.')
    }
    const input: QuotationTemplateInput = {
      name,
      plan_id: planId,
      validity_days: Number(validityDays),
      lines: lines.map((line, index) => {
        if (line.product_id === null) {
          throw new ApiError('INVALID_INPUT', `Line ${index + 1}: choose a product.`)
        }
        return {
          product_id: line.product_id,
          variant_id: line.variant_id,
          quantity: Number(line.quantity),
        }
      }),
    }
    if (template) {
      await updateQuotationTemplate(template.id, input)
    } else {
      await createQuotationTemplate(input)
    }
    toast.success(template ? 'Template updated' : 'Template created', {
      description: input.name,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={template ? 'Edit quotation template' : 'New quotation template'}
      description="A template fixes the plan and the product lines. Staff pick the customer and issue the quote."
      submitLabel={template ? 'Save changes' : 'Create template'}
      onSubmit={handleSubmit}
      size="xl"
      footerNote={`${lines.length} line${lines.length === 1 ? '' : 's'} · quote valid for ${validityDays || 0} days`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Template name" htmlFor="template-name" required>
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Growth Starter — Monthly"
            autoFocus
          />
        </Field>
        <Field label="Validity (days)" htmlFor="template-validity" required>
          <Input
            id="template-validity"
            type="number"
            min="1"
            step="1"
            value={validityDays}
            onChange={(event) => setValidityDays(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Plan" required>
        <Select
          items={plans.map((plan) => ({ label: plan.name, value: plan.id }))}
          value={planId}
          onValueChange={(value) => setPlanId(value ?? null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">Product lines</p>
            <p className="text-xs text-muted-foreground">
              Add at least one line. Variant price extras are applied at quote time.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setLines((previous) => [...previous, newLine()])}
          >
            <Plus />
            Add line
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-background px-3 py-3 text-xs text-muted-foreground">
            No lines yet. Add a product line to continue.
          </p>
        ) : null}

        <div className="space-y-2">
          {lines.map((line, index) => {
            const product = products.find((candidate) => candidate.id === line.product_id)
            const variants = product?.variants ?? []
            const variantItems = [
              { label: 'No variant', value: 'none' },
              ...variants.map((variant) => ({
                label:
                  variant.price_extra > 0
                    ? `${variant.attribute_value} (+₹${variant.price_extra.toFixed(2)})`
                    : variant.attribute_value,
                value: String(variant.id),
              })),
            ]
            return (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-border/70 bg-background p-2.5 sm:grid-cols-[1fr_180px_90px_auto] sm:items-end"
              >
                <Field label={`Product ${index + 1}`} required>
                  <Select
                    items={products.map((option) => ({
                      label: option.is_active ? option.name : `${option.name} (inactive)`,
                      value: option.id,
                    }))}
                    value={line.product_id}
                    onValueChange={(value) =>
                      updateLine(line.key, {
                        product_id: value ?? null,
                        variant_id: null,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                          {option.is_active ? '' : ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Variant">
                  <Select
                    items={variantItems}
                    value={line.variant_id === null ? 'none' : String(line.variant_id)}
                    disabled={variants.length === 0}
                    onValueChange={(value) =>
                      updateLine(line.key, {
                        variant_id:
                          value === 'none' || value === null ? null : Number(value),
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No variant</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={String(variant.id)}>
                          {variant.attribute_value}
                          {variant.price_extra > 0
                            ? ` (+₹${variant.price_extra.toFixed(2)})`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Qty" required>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                    aria-label={`Quantity for line ${index + 1}`}
                  />
                </Field>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  disabled={lines.length === 1}
                  onClick={() => removeLine(line.key)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </FormDialog>
  )
}
