import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  Layers,
  Plus,
  Receipt,
  ScrollText,
  Trash2,
  User,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/format'
import { calculateLineItem } from '@/mocks/engine/lineItem'
import { roundHalfUp2, sumLines } from '@/mocks/engine/money'
import { DEMO_TODAY } from '@/mocks/fixtures'
import type { CustomerUser } from '@/mocks/subscriptions.fixtures'
import {
  createSubscriptionFromTemplate,
  listCustomers,
  listDiscountRules,
  listProducts,
  listQuotationTemplates,
  listTaxRules,
} from '@/services/api'
import type {
  DiscountRule,
  ProductWithVariants,
  QuotationTemplateDetail,
  TaxRule,
} from '@/types/contracts'

interface EditableLine {
  id: string
  product_id: number
  variant_id: number | null
  quantity: number
}

export function NewQuotationPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<QuotationTemplateDetail[]>([])
  const [customers, setCustomers] = useState<CustomerUser[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([])

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(DEMO_TODAY)
  const [paymentTermsDays, setPaymentTermsDays] = useState(15)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadInitial() {
    setLoading(true)
    try {
      const [tList, cList, pList, trList, drList] = await Promise.all([
        listQuotationTemplates(),
        listCustomers(),
        listProducts(),
        listTaxRules(),
        listDiscountRules(),
      ])
      setTemplates(tList)
      setCustomers(cList)
      setProducts(pList)
      setTaxRules(trList)
      setDiscountRules(drList)

      if (tList.length > 0 && tList[0]) {
        applyTemplate(tList[0])
      }
      if (cList.length > 0 && cList[0]) {
        setSelectedCustomerId(cList[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitial()
  }, [])

  function applyTemplate(tpl: QuotationTemplateDetail) {
    setSelectedTemplateId(tpl.id)
    const initialLines: EditableLine[] = tpl.lines.map((l, idx) => ({
      id: `line-${idx}-${Date.now()}`,
      product_id: l.product_id,
      variant_id: l.variant_id,
      quantity: l.quantity,
    }))
    setLines(initialLines)
  }

  function handleTemplateChange(tplIdStr: string) {
    const idNum = Number(tplIdStr)
    const tpl = templates.find((t) => t.id === idNum)
    if (tpl) applyTemplate(tpl)
  }

  function handleQuantityChange(id: string, qty: number) {
    const safeQty = Math.max(1, isNaN(qty) ? 1 : qty)
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: safeQty } : l)))
  }

  function handleVariantChange(id: string, variantIdStr: string) {
    const variantId = variantIdStr === 'none' ? null : Number(variantIdStr)
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, variant_id: variantId } : l)))
  }

  function removeLine(id: string) {
    if (lines.length <= 1) {
      toast.error('A quotation must contain at least one product line.')
      return
    }
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function addProductLine() {
    const firstProduct = products.find((p) => p.is_active) ?? products[0]
    if (!firstProduct) return
    setLines((prev) => [
      ...prev,
      {
        id: `line-new-${Date.now()}`,
        product_id: firstProduct.id,
        variant_id: firstProduct.variants[0]?.id ?? null,
        quantity: 1,
      },
    ])
  }

  // Live pricing engine recalculation
  const calculatedLines = useMemo(() => {
    const gstRule = taxRules.find((r) => r.is_active && r.name.includes('18')) ?? taxRules[0]
    const taxRate = gstRule?.rate_percent ?? 18

    // Active discount rule for preview
    const activeDiscount = discountRules.find(
      (d) => d.name.includes('10%') || d.discount_type === 'PERCENT',
    )
    const discountInput = activeDiscount
      ? {
          type: activeDiscount.discount_type,
          value: activeDiscount.value,
          min_qty: activeDiscount.min_qty,
          min_purchase: activeDiscount.min_purchase,
          uses_left:
            activeDiscount.max_uses !== null
              ? Math.max(0, activeDiscount.max_uses - activeDiscount.current_uses)
              : 9999,
          valid_from: activeDiscount.valid_from,
          valid_until: activeDiscount.valid_until,
        }
      : null

    return lines.map((line) => {
      const product = products.find((p) => p.id === line.product_id)
      const variant = line.variant_id
        ? product?.variants.find((v) => v.id === line.variant_id)
        : undefined

      const basePrice = product?.sales_price ?? 0
      const variantExtra = variant?.price_extra ?? 0

      const result = calculateLineItem(
        basePrice,
        variantExtra,
        line.quantity,
        taxRate,
        discountInput,
        startDate,
      )

      return {
        ...line,
        product,
        variant,
        taxRate,
        calc: result,
      }
    })
  }, [lines, products, taxRules, discountRules, startDate])

  const totals = useMemo(() => {
    const subtotal = sumLines(calculatedLines, (l) =>
      roundHalfUp2(l.calc.unit_price * l.quantity),
    )
    const totalDiscount = sumLines(calculatedLines, (l) => l.calc.discount_amount)
    const totalTax = sumLines(calculatedLines, (l) => l.calc.tax_amount)
    const grandTotal = sumLines(calculatedLines, (l) => l.calc.line_total)
    return { subtotal, totalDiscount, totalTax, grandTotal }
  }, [calculatedLines])

  async function handleCreateSubscription() {
    if (!selectedTemplateId || !selectedCustomerId) {
      toast.error('Please select a template and customer')
      return
    }

    setSubmitting(true)
    try {
      const detail = await createSubscriptionFromTemplate({
        template_id: selectedTemplateId,
        customer_id: selectedCustomerId,
        start_date: startDate,
        payment_terms_days: paymentTermsDays,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
        })),
      })

      toast.success(`Quotation ${detail.sub_number} created as Draft`)
      navigate(`/subscriptions/${detail.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create subscription')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 -ml-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/subscriptions')}
        >
          <ArrowLeft className="mr-1 size-3.5" />
          Back to Subscriptions
        </Button>
        <PageHeader
          title="Create from Quotation Template"
          description="Select a preconfigured quotation template, customize line items, and convert it into a confirmed recurring subscription."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Template, Customer, & Lines */}
        <div className="space-y-6 lg:col-span-2">
          {/* Preset Template Selector */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ScrollText className="size-4 text-primary" />
                1. Quotation Template & Contract Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="template-select" className="text-xs">
                    Quotation Template
                  </Label>
                  <Select
                    value={selectedTemplateId ? String(selectedTemplateId) : ''}
                    onValueChange={(val) => handleTemplateChange(val ?? '')}
                  >
                    <SelectTrigger id="template-select" className="text-xs h-9">
                      <SelectValue placeholder="Choose a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)} className="text-xs">
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Attached Plan</Label>
                  <div className="flex h-9 items-center rounded-md border border-border/60 bg-background/50 px-3 text-xs font-medium text-foreground">
                    <Layers className="mr-2 size-3.5 text-primary" />
                    {selectedTemplate?.plan_name ?? 'Select template'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer & Contract Terms */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                2. Customer & Contract Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-select" className="text-xs">
                    Customer Account
                  </Label>
                  <Select
                    value={selectedCustomerId ? String(selectedCustomerId) : ''}
                    onValueChange={(val) => setSelectedCustomerId(val ? Number(val) : null)}
                  >
                    <SelectTrigger id="customer-select" className="text-xs h-9">
                      <SelectValue placeholder="Choose customer…" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                          {c.company ? `${c.company} (${c.full_name})` : c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs">
                    Contract Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-terms" className="text-xs">
                    Payment Terms
                  </Label>
                  <Select
                    value={String(paymentTermsDays)}
                    onValueChange={(v) => setPaymentTermsDays(v ? Number(v) : 15)}
                  >
                    <SelectTrigger id="payment-terms" className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7" className="text-xs">Net 7 Days</SelectItem>
                      <SelectItem value="15" className="text-xs">Net 15 Days</SelectItem>
                      <SelectItem value="30" className="text-xs">Net 30 Days</SelectItem>
                      <SelectItem value="45" className="text-xs">Net 45 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Editor with Live Engine Calculation */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                3. Order Lines & Quantities ({lines.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={addProductLine}
                className="h-7 text-xs gap-1"
              >
                <Plus className="size-3" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent text-xs text-muted-foreground">
                      <TableHead className="w-[40%]">Product & Variant</TableHead>
                      <TableHead className="w-20 text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculatedLines.map((line) => {
                      const product = line.product
                      const availableVariants = product?.variants ?? []

                      return (
                        <TableRow key={line.id} className="text-xs">
                          <TableCell className="py-2.5">
                            <div className="space-y-1">
                              <span className="font-semibold text-foreground">
                                {product?.name ?? 'Unknown'}
                              </span>
                              {availableVariants.length > 0 && (
                                <Select
                                  value={line.variant_id ? String(line.variant_id) : 'none'}
                                  onValueChange={(val) => handleVariantChange(line.id, val ?? 'none')}
                                >
                                  <SelectTrigger className="h-7 text-[11px] w-full max-w-xs">
                                    <SelectValue placeholder="No variant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none" className="text-[11px]">
                                      Standard / Default
                                    </SelectItem>
                                    {availableVariants.map((v) => (
                                      <SelectItem
                                        key={v.id}
                                        value={String(v.id)}
                                        className="text-[11px]"
                                      >
                                        {v.attribute_name}: {v.attribute_value} (+
                                        {formatINR(v.price_extra)})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                handleQuantityChange(line.id, parseInt(e.target.value, 10))
                              }
                              className="h-7 w-16 text-right font-mono text-xs ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground py-2.5">
                            {formatINR(line.calc.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-mono py-2.5">
                            {line.calc.discount_applied ? (
                              <span className="text-emerald-400 font-medium">
                                -{formatINR(line.calc.discount_amount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground py-2.5">
                            {formatINR(line.calc.line_total)}
                          </TableCell>
                          <TableCell className="py-2.5 pr-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLine(line.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 col): Live Order Summary & Convert CTA */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm sticky top-6">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-emerald-400" />
                Live Pricing Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Subtotal</span>
                  <span className="font-mono text-foreground">{formatINR(totals.subtotal)}</span>
                </div>

                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discounts Deducted</span>
                    <span className="font-mono">-{formatINR(totals.totalDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>GST Tax (18% Exclusive)</span>
                  <span className="font-mono text-foreground">{formatINR(totals.totalTax)}</span>
                </div>

                <div className="flex justify-between border-t border-border/60 pt-3 text-sm font-bold text-foreground">
                  <span>Grand Total / Cycle</span>
                  <span className="font-mono text-base text-emerald-400">
                    {formatINR(totals.grandTotal)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Conversion Contract</p>
                <p>
                  Creating this order registers a new subscription with status{' '}
                  <span className="font-semibold text-indigo-400">DRAFT</span>. Move it through
                  Quotation, Confirmed and Active from the subscription page.
                </p>
              </div>

              <Button
                className="w-full gap-2 font-semibold shadow-sm"
                size="lg"
                disabled={submitting || lines.length === 0}
                onClick={handleCreateSubscription}
              >
                <CheckCircle className="size-4" />
                {submitting ? 'Creating Quotation…' : 'Create Quotation'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
