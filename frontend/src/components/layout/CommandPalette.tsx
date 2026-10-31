import {
  BadgePercent,
  CalendarClock,
  Moon,
  RotateCcw,
  ScrollText,
  Sun,
  Users,
  Wallet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { startTransition } from 'react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useApp } from '@/mocks/store/AppStore'
import { resetDemoData, sessionForRole } from '@/services/api'
import type { Role } from '@/types/contracts'
import { homeForRole, navForRole } from '@/types/nav'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { state, dispatch, refreshNotifications } = useApp()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const role = state.session?.role ?? 'ADMIN'

  function run(path: string, label: string) {
    onOpenChange(false)
    navigate(path)
    toast.info(label, { description: 'Opening the workspace surface.' })
  }

  async function switchRole(target: Role) {
    if (target === role) {
      onOpenChange(false)
      return
    }
    const session = await sessionForRole(target)
    // Close the palette and swap the role in the same transition as the route
    // change so the current route's guard never sees a mismatched role.
    startTransition(() => {
      onOpenChange(false)
      navigate(homeForRole(target))
      dispatch({ type: 'SET_SESSION', session })
    })
    toast.success(`Viewing as ${target}`, { description: session.full_name })
  }

  async function handleReset() {
    await resetDemoData()
    await refreshNotifications()
    onOpenChange(false)
    toast.success('Demo data reset')
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, actions, roles…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run('/billing', 'Billing Day')}>
            <CalendarClock />
            Run Billing Day Batch
            <CommandShortcut>B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run('/invoices', 'Invoices')}>
            <Wallet />
            Record Payment
          </CommandItem>
          <CommandItem onSelect={() => run('/quotations/new', 'Quotations')}>
            <ScrollText />
            Create Quotation
          </CommandItem>
          {role === 'ADMIN' ? (
            <CommandItem onSelect={() => run('/catalog/discount-rules', 'Discount Rules')}>
              <BadgePercent />
              Create Discount Rule
            </CommandItem>
          ) : null}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {navForRole(role).flatMap((group) =>
            group.items.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.to}
                  value={`${group.label} ${item.label}`}
                  onSelect={() => run(item.to, item.label)}
                >
                  <Icon />
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </span>
                </CommandItem>
              )
            }),
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View as">
          {(['ADMIN', 'STAFF', 'CUSTOMER'] as Role[]).map((target) => (
            <CommandItem
              key={target}
              value={`view as ${target}`}
              onSelect={() => void switchRole(target)}
            >
              <Users />
              {target === 'ADMIN' ? 'Finance Lead' : target === 'STAFF' ? 'Staff' : 'Customer'}
              <CommandShortcut>{target === role ? 'Current' : ''}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Preferences">
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
              onOpenChange(false)
            }}
          >
            {resolvedTheme === 'light' ? <Moon /> : <Sun />}
            Toggle {resolvedTheme === 'light' ? 'dark' : 'light'} theme
          </CommandItem>
          <CommandItem onSelect={() => void handleReset()}>
            <RotateCcw />
            Reset demo data
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
