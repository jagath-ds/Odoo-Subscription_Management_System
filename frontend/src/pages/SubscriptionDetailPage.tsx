import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { OrderLinesTable } from '@/components/subscriptions/OrderLinesTable'
import { PlanActionBar } from '@/components/subscriptions/PlanActionBar'
import { StatusChevronRibbon } from '@/components/subscriptions/StatusChevronRibbon'
import { SubscriptionHeaderCard } from '@/components/subscriptions/SubscriptionHeaderCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatINR } from '@/lib/format'
import {
  getSubscription,
  listProducts,
  toggleAddon,
  transitionSubscription,
} from '@/services/api'
import type {
  ProductWithVariants,
  SubscriptionDetail,
  SubscriptionStatus,
} from '@/types/contracts'

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null)
  const [addons, setAddons] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subId = Number(id)

  async function loadData() {
    if (isNaN(subId)) {
      setError('Invalid subscription ID')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [detail, allProducts] = await Promise.all([
        getSubscription(subId),
        listProducts(),
      ])
      setSubscription(detail)
      setAddons(allProducts.filter((p) => p.product_type === 'ADDON' && p.is_active))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load subscription')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [subId])

  async function handleTransition(targetStatus: SubscriptionStatus) {
    if (!subscription) return
    setActionPending(true)
    try {
      const updated = await transitionSubscription({
        id: subscription.id,
        target_status: targetStatus,
      })
      setSubscription(updated)
      toast.success(`Subscription moved to ${targetStatus}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to transition subscription')
    } finally {
      setActionPending(false)
    }
  }

  async function handleToggleAddon(product: ProductWithVariants, enabled: boolean) {
    if (!subscription) return
    try {
      const defaultVariantId = product.variants[0]?.id ?? null
      const updated = await toggleAddon({
        subscription_id: subscription.id,
        product_id: product.id,
        variant_id: defaultVariantId,
        enabled,
      })
      setSubscription(updated)
      toast.success(
        enabled
          ? `Added ${product.name} to subscription`
          : `Removed ${product.name} from subscription`,
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update add-on')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !subscription) {
    return (
      <div className="space-y-4 p-8 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive" />
        <h2 className="text-lg font-bold text-foreground">Subscription Not Found</h2>
        <p className="text-sm text-muted-foreground">{error ?? 'This subscription does not exist.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/subscriptions')}>
          Back to all subscriptions
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="size-3.5" />
            Back to Subscriptions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {subscription.sub_number}
            </h1>
            <span className="text-sm text-muted-foreground">· {subscription.customer_name}</span>
          </div>
        </div>

        <PlanActionBar
          subscription={subscription}
          onTransition={handleTransition}
          loading={actionPending}
        />
      </div>

      {/* Odoo Status Chevron Pipeline Ribbon */}
      <StatusChevronRibbon currentStatus={subscription.status} />

      {/* Subscription Contract Metadata */}
      <SubscriptionHeaderCard subscription={subscription} />

      {/* Order Lines Table */}
      <OrderLinesTable subscription={subscription} />

      {/* Add-on Modules (Self-Service & Admin Add-on Manager) */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-400" />
            Available Add-on Modules
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Optional add-ons that can be toggled on or off for subsequent billing cycles.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {addons.map((addon) => {
              const isAttached = subscription.lines.some((l) => l.product_id === addon.id)
              return (
                <div
                  key={addon.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/40 p-3.5"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">{addon.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      +{formatINR(addon.sales_price)} / cycle
                    </p>
                    {addon.notes && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{addon.notes}</p>
                    )}
                  </div>
                  <Switch
                    checked={isAttached}
                    onCheckedChange={(checked) => handleToggleAddon(addon, checked)}
                    aria-label={`Toggle ${addon.name}`}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
