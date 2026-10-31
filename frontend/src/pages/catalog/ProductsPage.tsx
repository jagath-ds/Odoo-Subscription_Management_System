import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ActiveBadge, ProductTypeBadge } from '@/components/catalog/CatalogBadges'
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
import { Textarea } from '@/components/ui/textarea'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  listProducts,
  updateProduct,
  updateProductVariant,
} from '@/services/api'
import type { ProductInput, ProductVariantInput } from '@/services/api'
import type {
  Product,
  ProductType,
  ProductVariant,
  ProductWithVariants,
} from '@/types/contracts'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}

const TYPE_ITEMS: Record<string, string> = {
  ALL: 'All types',
  SERVICE: 'Service',
  ADDON: 'Add-on',
}

const STATUS_ITEMS: Record<string, string> = {
  ALL: 'All statuses',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
}

const PRODUCT_TYPE_ITEMS: Record<string, string> = {
  SERVICE: 'Service',
  ADDON: 'Add-on',
}

function toProductInput(product: Product): ProductInput {
  return {
    name: product.name,
    product_type: product.product_type,
    sales_price: product.sales_price,
    cost_price: product.cost_price,
    notes: product.notes,
    is_active: product.is_active,
  }
}

export function ProductsPage() {
  const [rows, setRows] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | ProductType>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductWithVariants | null>(null)
  const [variantProduct, setVariantProduct] = useState<ProductWithVariants | null>(null)
  const [variantEditing, setVariantEditing] = useState<ProductVariant | null>(null)
  const [deleting, setDeleting] = useState<ProductWithVariants | null>(null)
  const [deletingVariant, setDeletingVariant] = useState<ProductVariant | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRows(await listProducts())
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
        (row.notes ?? '').toLowerCase().includes(needle) ||
        row.variants.some((variant) =>
          `${variant.attribute_name} ${variant.attribute_value}`
            .toLowerCase()
            .includes(needle),
        )
      const matchesType = typeFilter === 'ALL' || row.product_type === typeFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? row.is_active : !row.is_active)
      return matchesSearch && matchesType && matchesStatus
    })
  }, [rows, search, typeFilter, statusFilter])

  const variantCount = rows.reduce((total, row) => total + row.variants.length, 0)

  async function handleToggle(product: ProductWithVariants, active: boolean) {
    try {
      await updateProduct(product.id, { ...toProductInput(product), is_active: active })
      toast.success(active ? 'Product activated' : 'Product deactivated', {
        description: product.name,
      })
      await load()
    } catch (cause) {
      toast.error('Could not update product', { description: errorMessage(cause) })
    }
  }

  const columns: Array<DataTableColumn<ProductWithVariants>> = [
    {
      id: 'name',
      header: 'Product',
      cell: (row) => (
        <div className="min-w-[220px]">
          <p className="font-medium text-foreground">{row.name}</p>
          {row.notes ? (
            <p className="line-clamp-1 max-w-[360px] text-xs text-muted-foreground">
              {row.notes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <ProductTypeBadge type={row.product_type} />,
    },
    {
      id: 'price',
      header: 'Price',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <div>
          <p className="tabular-nums whitespace-nowrap text-foreground">
            {formatINR(row.sales_price)}
          </p>
          <p className="whitespace-nowrap text-[11px] text-muted-foreground">
            Cost {formatINR(row.cost_price)}
          </p>
        </div>
      ),
    },
    {
      id: 'variants',
      header: 'Variants',
      cell: (row) =>
        row.variants.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.variants.slice(0, 2).map((variant) => (
              <Badge
                key={variant.id}
                variant="outline"
                className="border-border/70 text-[10px]"
              >
                {variant.attribute_value}
                {variant.price_extra > 0 ? ` +${formatINR(variant.price_extra)}` : ''}
              </Badge>
            ))}
            {row.variants.length > 2 ? (
              <Badge variant="outline" className="border-border/70 text-[10px]">
                +{row.variants.length - 2}
              </Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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

  function renderExpanded(product: ProductWithVariants) {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-foreground">Variants</p>
            <p className="text-[11px] text-muted-foreground">
              Price extra is added to {formatINR(product.sales_price)} when the line is
              quoted.
            </p>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setVariantProduct(product)
              setVariantEditing(null)
            }}
          >
            <Plus />
            Add variant
          </Button>
        </div>

        {product.variants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-background px-3 py-3 text-xs text-muted-foreground">
            No variants — the base price applies to every line.
          </p>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-background">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{variant.attribute_name}</span>
                <span className="font-medium text-foreground">
                  {variant.attribute_value}
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    variant.price_extra > 0
                      ? 'text-emerald-500'
                      : 'text-muted-foreground',
                  )}
                >
                  {variant.price_extra > 0
                    ? `+${formatINR(variant.price_extra)}`
                    : 'Included'}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${variant.attribute_value}`}
                    onClick={() => {
                      setVariantProduct(product)
                      setVariantEditing(variant)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    aria-label={`Delete ${variant.attribute_value}`}
                    onClick={() => setDeletingVariant(variant)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Products & Variants"
        description="Catalog records that feed every subscription line. Editing a price here never changes an invoice that has already been issued."
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
            New product
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search products, notes or variants…"
        meta={`${filtered.length} of ${rows.length} products · ${variantCount} variants`}
      >
        <Select
          items={TYPE_ITEMS}
          value={typeFilter}
          onValueChange={(value) => value && setTypeFilter(value)}
        >
          <SelectTrigger size="sm" className="w-[132px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="SERVICE">Service</SelectItem>
            <SelectItem value="ADDON">Add-on</SelectItem>
          </SelectContent>
        </Select>

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
          renderExpanded={renderExpanded}
          expandedLabel={(row) =>
            `${row.variants.length} variant${row.variants.length === 1 ? '' : 's'} for ${row.name}`
          }
          empty={
            loadError ? (
              <EmptyState
                icon={RefreshCw}
                title="Could not load products"
                message={loadError}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="No products yet"
                message="Add a service or add-on so staff can quote it."
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
                    New product
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No products match"
                message="Try a different search term, type or status."
              />
            )
          }
        />
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSaved={() => void load()}
      />

      {variantProduct ? (
        <VariantFormDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setVariantProduct(null)
              setVariantEditing(null)
            }
          }}
          product={variantProduct}
          variant={variantEditing}
          onSaved={() => void load()}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'product'}?`}
        description="The product and all of its variants will be removed. Products used by a quotation template are protected."
        onConfirm={async () => {
          if (!deleting) return
          await deleteProduct(deleting.id)
          toast.success('Product deleted', { description: deleting.name })
          setDeleting(null)
          await load()
        }}
      />

      <ConfirmDeleteDialog
        open={deletingVariant !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingVariant(null)
        }}
        title={`Delete ${deletingVariant?.attribute_value ?? 'variant'}?`}
        description="Existing subscription and invoice snapshots keep their stored prices."
        onConfirm={async () => {
          if (!deletingVariant) return
          await deleteProductVariant(deletingVariant.id)
          toast.success('Variant deleted', { description: deletingVariant.attribute_value })
          setDeletingVariant(null)
          await load()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Product form                                                        */
/* ------------------------------------------------------------------ */

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithVariants | null
  onSaved: () => void
}

function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const [name, setName] = useState('')
  const [productType, setProductType] = useState<ProductType>('SERVICE')
  const [salesPrice, setSalesPrice] = useState('0')
  const [costPrice, setCostPrice] = useState('0')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setProductType(product?.product_type ?? 'SERVICE')
    setSalesPrice(String(product?.sales_price ?? 0))
    setCostPrice(String(product?.cost_price ?? 0))
    setNotes(product?.notes ?? '')
    setIsActive(product?.is_active ?? true)
  }, [open, product])

  async function handleSubmit() {
    const input: ProductInput = {
      name,
      product_type: productType,
      sales_price: Number(salesPrice),
      cost_price: Number(costPrice),
      notes: notes.trim() ? notes.trim() : null,
      is_active: isActive,
    }
    if (product) {
      await updateProduct(product.id, input)
    } else {
      await createProduct(input)
    }
    toast.success(product ? 'Product updated' : 'Product created', {
      description: input.name,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product ? 'Edit product' : 'New product'}
      description="Products are catalog records. Prices are copied onto a subscription line when it is created."
      submitLabel={product ? 'Save changes' : 'Create product'}
      onSubmit={handleSubmit}
    >
      <Field label="Product name" htmlFor="product-name" required>
        <Input
          id="product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Brightloop Core Platform"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select
            items={PRODUCT_TYPE_ITEMS}
            value={productType}
            onValueChange={(value) => value && setProductType(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SERVICE">Service</SelectItem>
              <SelectItem value="ADDON">Add-on</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Availability">
          <div className="flex h-8 items-center gap-2">
            <Switch
              id="product-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="product-active" className="text-xs text-muted-foreground">
              {isActive ? 'Active for new quotes' : 'Hidden from new quotes'}
            </Label>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Sales price (₹)" htmlFor="product-sales" required>
          <Input
            id="product-sales"
            type="number"
            min="0"
            step="0.01"
            value={salesPrice}
            onChange={(event) => setSalesPrice(event.target.value)}
          />
        </Field>
        <Field
          label="Cost price (₹)"
          htmlFor="product-cost"
          hint="Used for margin reporting, never shown to customers."
          required
        >
          <Input
            id="product-cost"
            type="number"
            min="0"
            step="0.01"
            value={costPrice}
            onChange={(event) => setCostPrice(event.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Notes"
        htmlFor="product-notes"
        hint="Shown to staff when they pick this product."
      >
        <Textarea
          id="product-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What this product includes…"
        />
      </Field>
    </FormDialog>
  )
}

/* ------------------------------------------------------------------ */
/* Variant form                                                        */
/* ------------------------------------------------------------------ */

interface VariantFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithVariants
  variant: ProductVariant | null
  onSaved: () => void
}

function VariantFormDialog({
  open,
  onOpenChange,
  product,
  variant,
  onSaved,
}: VariantFormDialogProps) {
  const [attributeName, setAttributeName] = useState('')
  const [attributeValue, setAttributeValue] = useState('')
  const [priceExtra, setPriceExtra] = useState('0')

  useEffect(() => {
    if (!open) return
    setAttributeName(variant?.attribute_name ?? '')
    setAttributeValue(variant?.attribute_value ?? '')
    setPriceExtra(String(variant?.price_extra ?? 0))
  }, [open, variant])

  async function handleSubmit() {
    const input: ProductVariantInput = {
      attribute_name: attributeName,
      attribute_value: attributeValue,
      price_extra: Number(priceExtra),
    }
    if (variant) {
      await updateProductVariant(variant.id, input)
    } else {
      await createProductVariant(product.id, input)
    }
    toast.success(variant ? 'Variant updated' : 'Variant added', {
      description: `${attributeName}: ${attributeValue}`,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={variant ? 'Edit variant' : 'Add variant'}
      description={`${product.name} · base price ${formatINR(product.sales_price)}`}
      submitLabel={variant ? 'Save changes' : 'Add variant'}
      onSubmit={handleSubmit}
      size="sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Attribute" htmlFor="variant-attribute" required>
          <Input
            id="variant-attribute"
            value={attributeName}
            onChange={(event) => setAttributeName(event.target.value)}
            placeholder="Brand"
            autoFocus
          />
        </Field>
        <Field label="Value" htmlFor="variant-value" required>
          <Input
            id="variant-value"
            value={attributeValue}
            onChange={(event) => setAttributeValue(event.target.value)}
            placeholder="Enterprise"
          />
        </Field>
      </div>

      <Field
        label="Price extra (₹)"
        htmlFor="variant-extra"
        hint={`Unit price becomes ${formatINR(product.sales_price + (Number(priceExtra) || 0))}.`}
        required
      >
        <Input
          id="variant-extra"
          type="number"
          min="0"
          step="0.01"
          value={priceExtra}
          onChange={(event) => setPriceExtra(event.target.value)}
        />
      </Field>
    </FormDialog>
  )
}
