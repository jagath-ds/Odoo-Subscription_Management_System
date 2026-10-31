import { ChevronsUpDown, LogOut, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'
import { logout, resetDemoData } from '@/services/api'

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { state, dispatch, refreshNotifications } = useApp()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const session = state.session

  if (!session) return null

  function handleSignOut() {
    void logout()
    dispatch({ type: 'CLEAR_SESSION' })
    setConfirmOpen(false)
    navigate('/login')
    toast.success('Signed out', { description: 'Your session was closed on this device.' })
  }

  async function handleReset() {
    await resetDemoData()
    await refreshNotifications()
    toast.success('Demo data reset', {
      description: 'Users, subscriptions and invoices are back to the seeded story.',
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border/70 hover:bg-sidebar-accent',
                collapsed && 'justify-center',
              )}
              aria-label="Account menu"
            />
          }
        >
          <Avatar className="size-8 shrink-0 border border-border/70">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(session.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {session.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {session.role === 'ADMIN'
                    ? 'Finance Lead'
                    : session.role === 'STAFF'
                      ? 'Staff Operations'
                      : 'Customer Portal'}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : null}
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="text-sm font-medium text-foreground">{session.full_name}</span>
            <span className="text-xs font-normal text-muted-foreground">{session.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs text-muted-foreground"
            onClick={() => void handleReset()}
          >
            <RotateCcw className="size-3.5" />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="gap-2"
            onClick={() => setConfirmOpen(true)}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <ShieldCheck className="text-primary" />
            </AlertDialogMedia>
            <AlertDialogTitle>Sign out of Brightloop?</AlertDialogTitle>
            <AlertDialogDescription>
              You are signed in as {session.full_name} ({session.role}). The demo state stays in
              memory and is restored on your next sign-in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
