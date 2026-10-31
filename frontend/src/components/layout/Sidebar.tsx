import { Boxes, ChevronLeft } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApp } from '@/mocks/store/AppStore'
import { homeForRole, navForRole } from '@/types/nav'
import { UserMenu } from './UserMenu'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}

export function SidebarContent({ collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { state } = useApp()
  const location = useLocation()
  const role = state.session?.role ?? 'ADMIN'
  const groups = navForRole(role)

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <Link
          to={homeForRole(role)}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
          aria-label="Brightloop home"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_22px_-6px_var(--primary)]">
            <Boxes className="size-4" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                Brightloop
              </span>
              <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Billing OS
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav
        className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4"
        aria-label="Primary navigation"
      >
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </p>
            ) : (
              <div className="mx-auto mb-1 h-px w-6 bg-sidebar-border" />
            )}
            {group.items.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {active ? (
                    <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  ) : null}
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        <UserMenu collapsed={collapsed} />
        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className={cn(
              'mt-1 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground',
              collapsed && 'justify-center',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {!collapsed ? 'Collapse' : null}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-300 lg:block',
        props.collapsed ? 'w-[76px]' : 'w-[272px]',
      )}
    >
      <SidebarContent {...props} />
    </aside>
  )
}
