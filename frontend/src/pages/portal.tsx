import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Clock,
  Download,
  Layers,
  Sparkles,
  Store,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SubscriptionStatusBadge } from '@/components/subscriptions/SubscriptionBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatINR } from '@/lib/format'
import { useSession } from '@/mocks/store/AppStore'
import {
  listInvoices,
  listProducts,
  listSubscriptions,
  toggleAddon,
} from '@/services/api'
import type {
  InvoiceListItem,
  ProductWithVariants,
  SubscriptionListItem,
} from '@/types/contracts'

export function PortalHomePage() {
  const session = useSession()
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([])
  const [addons, setAddons] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [subs, allProducts] = await Promise.all([
        listSubscriptions({ customer_id: session?.id }),
        listProducts(),
      ])
      setSubscriptions(subs)
      setAddons(allProducts.filter((p) => p.product_type === 'ADDON' && p.is_active))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [session?.id])

  async function handleToggle(subId: number, product: ProductWithVariants, enable: boolean) {
    try {
      await toggleAddon({
        subscription_id: subId,
        product_id: product.id,
        variant_id: product.variants[0]?.id ?? null,
        enabled: enable,
      })
      await loadData()
    } catch {
      // Ignored
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subscriptions"
        description="View your active recurring software subscriptions, manage optional add-ons, and review renewal schedules."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : subscriptions.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-12 text-center text-xs text-muted-foreground">
          <Store className="mx-auto size-8 text-muted-foreground/40 mb-2" />
          <p>No active subscriptions found for your account.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
              <CardHeader className="pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{sub.sub_number}</span>
                  <CardTitle className="text-base font-bold text-foreground mt-0.5">
                    {sub.plan_name}
                  </CardTitle>
                </div>
                <SubscriptionStatusBadge status={sub.status} />
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-emerald-400" /> Next Billing
                    </p>
                    <p className="mt-1 font-mono font-semibold text-foreground">
                      {formatDate(sub.next_billing_date)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3 text-primary" /> Cycle Amount
                    </p>
                    <p className="mt-1 font-mono font-semibold text-emerald-400">
                      {formatINR(sub.grand_total)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/30">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Sparkles className="size-3 text-emerald-400" />
                    Available Add-ons
                  </p>
                  <div className="space-y-2">
                    {addons.slice(0, 2).map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center justify-between rounded border border-border/30 bg-background/30 p-2 text-xs"
                      >
                        <div>
                          <p className="font-medium text-foreground">{addon.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            +{formatINR(addon.sales_price)} / cycle
                          </p>
                        </div>
                        <Switch
                          defaultChecked={addon.id === 3}
                          onCheckedChange={(checked) => handleToggle(sub.id, addon, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => navigate(`/subscriptions/${sub.id}`)}
                >
                  View Contract Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const items = await listInvoices()
      setInvoices(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Invoices"
        description="Review billing statements, receipts, and payment status for your subscription account."
      />

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs text-muted-foreground">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date Issued</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead className="text-right pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="text-xs">
                    <TableCell className="font-mono font-bold text-primary">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatDate(inv.issue_date)}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatDate(inv.due_date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === 'PAID'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]'
                            : 'border-sky-500/40 bg-sky-500/10 text-sky-400 text-[11px]'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground">
                      {formatINR(inv.grand_total)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <span className={inv.amount_due > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {formatINR(inv.amount_due)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Link to={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          <Download className="size-3" />
                          View / Print
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
