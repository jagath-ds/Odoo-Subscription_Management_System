import { BadgePercent, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/format'
import type { SubscriptionDetail } from '@/types/contracts'

interface OrderLinesTableProps {
  subscription: SubscriptionDetail
  onToggleAddon?: (productId: number, variantId: number | null, enabled: boolean) => Promise<void>
}

export function OrderLinesTable({ subscription }: OrderLinesTableProps) {
  const { lines, summary } = subscription

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            Order Lines & Contract Items ({lines.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent text-xs text-muted-foreground">
                <TableHead className="w-[35%]">Product & Specification</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right pr-6">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={`${line.product_id}-${line.variant_name ?? 'none'}-${idx}`} className="text-xs">
                  <TableCell className="font-medium text-foreground py-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">{line.product_name}</div>
                      {line.variant_name && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                          {line.variant_name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {line.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatINR(line.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {line.discount_applied && line.discount_amount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <BadgePercent className="size-3" />
                        -{formatINR(line.discount_amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    <div>{formatINR(line.tax_amount)}</div>
                    <div className="text-[10px] text-muted-foreground/70">{line.tax_percent}% GST</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground pr-6">
                    {formatINR(line.line_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals Summary Footer */}
        <div className="flex flex-col sm:flex-row items-end justify-end border-t border-border/40 p-5 bg-background/30">
          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Gross Subtotal</span>
              <span className="font-mono text-foreground">{formatINR(summary.subtotal)}</span>
            </div>

            {summary.total_discount > 0 && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>Discounts Deducted</span>
                <span className="font-mono">-{formatINR(summary.total_discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-muted-foreground">
              <span>GST Tax (Exclusive)</span>
              <span className="font-mono text-foreground">{formatINR(summary.total_tax)}</span>
            </div>

            <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-bold text-foreground">
              <span>Grand Total / Cycle</span>
              <span className="font-mono text-base text-emerald-400">
                {formatINR(summary.grand_total)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
