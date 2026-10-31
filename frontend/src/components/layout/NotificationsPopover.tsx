import { BadgePercent, Bell, CheckCheck, Clock3, RefreshCw, TriangleAlert, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'
import { markNotificationsRead } from '@/services/api'
import type { AppNotification, NotificationKind } from '@/types/contracts'

const KIND_META: Record<NotificationKind, { icon: typeof Bell; className: string; label: string }> = {
  OVERDUE: { icon: TriangleAlert, className: 'text-destructive', label: 'Overdue' },
  RENEWAL: { icon: RefreshCw, className: 'text-amber-500', label: 'Renewal' },
  PAYMENT: { icon: Wallet, className: 'text-primary', label: 'Payment' },
  DISCOUNT: { icon: BadgePercent, className: 'text-sky-400', label: 'Discount' },
}

export function NotificationsPopover() {
  const { state, dispatch, unread } = useApp()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && unread > 0) {
      window.setTimeout(() => {
        dispatch({ type: 'MARK_NOTIFICATIONS_READ' })
        void markNotificationsRead()
      }, 900)
    }
  }

  function handleSelect(notification: AppNotification) {
    setOpen(false)
    navigate(notification.href)
  }

  function handleMarkAll() {
    dispatch({ type: 'MARK_NOTIFICATIONS_READ' })
    void markNotificationsRead()
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/70" />
            <span className="relative inline-flex size-2 rounded-full bg-destructive" />
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[360px] gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Notifications</p>
            {unread > 0 ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {unread} new
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1 text-xs text-muted-foreground"
            onClick={handleMarkAll}
            disabled={unread === 0}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {state.notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing needs your attention.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {state.notifications.map((notification) => {
                const meta = KIND_META[notification.kind]
                const Icon = meta.icon
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(notification)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                        !notification.read && 'bg-primary/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border/70 bg-background',
                          meta.className,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="block text-sm leading-snug">{notification.title}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {notification.body}
                        </span>
                        <span className="flex items-center gap-1 pt-0.5 text-[11px] text-muted-foreground/80">
                          <Clock3 className="size-3" />
                          {relativeTime(notification.created_at)}
                          <span className="mx-1">·</span>
                          {meta.label}
                        </span>
                      </span>
                      {!notification.read ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border/70 p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false)
              navigate('/invoices')
            }}
          >
            Open overdue chase
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
