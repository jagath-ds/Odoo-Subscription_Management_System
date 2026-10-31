import { Check, ChevronsUpDown, ShieldCheck, UserCog, Users } from 'lucide-react'
import { startTransition } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'
import { sessionForRole } from '@/services/api'
import type { Role } from '@/types/contracts'
import { homeForRole, navForRole } from '@/types/nav'

const ROLE_META: Record<Role, { label: string; hint: string; icon: typeof ShieldCheck }> = {
  ADMIN: { label: 'Admin', hint: 'Full control · Finance Lead', icon: ShieldCheck },
  STAFF: { label: 'Staff', hint: 'Day-to-day operations', icon: UserCog },
  CUSTOMER: { label: 'Customer', hint: 'Self-service portal', icon: Users },
}

export function RoleSwitcher() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const currentRole = state.session?.role ?? 'ADMIN'

  async function handleSwitch(role: Role) {
    if (role === currentRole) return
    const session = await sessionForRole(role)

    const permitted = navForRole(role).some((group) =>
      group.items.some(
        (item) =>
          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      ),
    )
    // The session swap and the route change must commit together. React Router
    // navigations run inside a transition, so an urgent dispatch would land
    // first and let the old route's guard redirect to /forbidden.
    if (!permitted) {
      startTransition(() => {
        navigate(homeForRole(role))
        dispatch({ type: 'SET_SESSION', session })
      })
    } else {
      dispatch({ type: 'SET_SESSION', session })
    }

    toast.success(`Viewing as ${ROLE_META[role].label}`, {
      description: `${session.full_name} · ${ROLE_META[role].hint}`,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-border/80 bg-background/60 text-xs"
            aria-label={`Switch role, currently ${ROLE_META[currentRole].label}`}
          />
        }
      >
        <span className="size-1.5 rounded-full bg-primary" />
        <span className="hidden sm:inline">{ROLE_META[currentRole].label}</span>
        <ChevronsUpDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Demo role switcher</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(ROLE_META) as Role[]).map((role) => {
          const meta = ROLE_META[role]
          const Icon = meta.icon
          const active = role === currentRole
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => void handleSwitch(role)}
              className="gap-2 py-2"
            >
              <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm">{meta.label}</span>
                <span className="truncate text-xs text-muted-foreground">{meta.hint}</span>
              </div>
              {active ? <Check className="ml-auto size-4 text-primary" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
