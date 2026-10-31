import { useState } from 'react'
import {
  CheckCircle,
  FileCheck,
  Pause,
  Play,
  RotateCcw,
  StopCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SubscriptionDetail, SubscriptionStatus } from '@/types/contracts'

interface PlanActionBarProps {
  subscription: SubscriptionDetail
  onTransition: (targetStatus: SubscriptionStatus) => Promise<void>
  loading?: boolean
  /** Customers may only pause, resume, close (if allowed) and renew their own subscription. */
  customerMode?: boolean
}

interface ActionBtnProps {
  label: string
  icon: typeof Play
  targetStatus: SubscriptionStatus
  disabled?: boolean
  tooltipReason?: string | null
  variant?: 'default' | 'outline' | 'destructive' | 'secondary'
  onClick: () => void
  loading?: boolean
}

function ActionBtn({
  label,
  icon: Icon,
  disabled,
  tooltipReason,
  variant = 'outline',
  onClick,
  loading,
}: ActionBtnProps) {
  const button = (
    <Button
      variant={variant}
      size="sm"
      disabled={disabled || loading}
      onClick={onClick}
      className="gap-1.5"
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </Button>
  )

  if (disabled && tooltipReason) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-block cursor-not-allowed" />}>
          {button}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipReason}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

export function PlanActionBar({
  subscription,
  onTransition,
  loading = false,
  customerMode = false,
}: PlanActionBarProps) {
  const [activeAction, setActiveAction] = useState<SubscriptionStatus | null>(null)
  const { status, plan_permissions } = subscription

  async function handleAction(target: SubscriptionStatus) {
    try {
      setActiveAction(target)
      await onTransition(target)
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <TooltipProvider delay={100}>
      <div className="flex flex-wrap items-center gap-2">
        {!customerMode && status === 'DRAFT' && (
          <>
            <ActionBtn
              label="Submit Quotation"
              icon={FileCheck}
              targetStatus="QUOTATION"
              variant="default"
              loading={loading || activeAction === 'QUOTATION'}
              onClick={() => handleAction('QUOTATION')}
            />
            <ActionBtn
              label="Cancel"
              icon={XCircle}
              targetStatus="CLOSED"
              variant="destructive"
              loading={loading || activeAction === 'CLOSED'}
              onClick={() => handleAction('CLOSED')}
            />
          </>
        )}

        {!customerMode && status === 'QUOTATION' && (
          <>
            <ActionBtn
              label="Confirm Order"
              icon={CheckCircle}
              targetStatus="CONFIRMED"
              variant="default"
              loading={loading || activeAction === 'CONFIRMED'}
              onClick={() => handleAction('CONFIRMED')}
            />
            <ActionBtn
              label="Reject / Close"
              icon={XCircle}
              targetStatus="CLOSED"
              variant="destructive"
              loading={loading || activeAction === 'CLOSED'}
              onClick={() => handleAction('CLOSED')}
            />
          </>
        )}

        {!customerMode && status === 'CONFIRMED' && (
          <>
            <ActionBtn
              label="Activate Subscription"
              icon={Play}
              targetStatus="ACTIVE"
              variant="default"
              loading={loading || activeAction === 'ACTIVE'}
              onClick={() => handleAction('ACTIVE')}
            />
            <ActionBtn
              label="Cancel"
              icon={XCircle}
              targetStatus="CLOSED"
              variant="destructive"
              loading={loading || activeAction === 'CLOSED'}
              onClick={() => handleAction('CLOSED')}
            />
          </>
        )}

        {status === 'ACTIVE' && (
          <>
            <ActionBtn
              label="Pause Subscription"
              icon={Pause}
              targetStatus="PAUSED"
              disabled={!plan_permissions.can_pause}
              tooltipReason={
                !plan_permissions.can_pause ? 'This plan does not allow pausing' : null
              }
              loading={loading || activeAction === 'PAUSED'}
              onClick={() => handleAction('PAUSED')}
            />
            <ActionBtn
              label="Close Early"
              icon={StopCircle}
              targetStatus="CLOSED"
              variant="destructive"
              disabled={!plan_permissions.can_close_early}
              tooltipReason={
                !plan_permissions.can_close_early
                  ? 'This plan does not allow early closure'
                  : null
              }
              loading={loading || activeAction === 'CLOSED'}
              onClick={() => handleAction('CLOSED')}
            />
          </>
        )}

        {status === 'PAUSED' && (
          <>
            <ActionBtn
              label="Resume Subscription"
              icon={Play}
              targetStatus="ACTIVE"
              variant="default"
              loading={loading || activeAction === 'ACTIVE'}
              onClick={() => handleAction('ACTIVE')}
            />
            {!customerMode && (
              <ActionBtn
                label="Close Subscription"
                icon={StopCircle}
                targetStatus="CLOSED"
                variant="destructive"
                loading={loading || activeAction === 'CLOSED'}
                onClick={() => handleAction('CLOSED')}
              />
            )}
          </>
        )}

        {status === 'CLOSED' && (
          <ActionBtn
            label="Renew Subscription"
            icon={RotateCcw}
            targetStatus="ACTIVE"
            variant="default"
            disabled={!plan_permissions.can_renew}
            tooltipReason={
              !plan_permissions.can_renew ? 'This plan does not allow renewal' : null
            }
            loading={loading || activeAction === 'ACTIVE'}
            onClick={() => handleAction('ACTIVE')}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
