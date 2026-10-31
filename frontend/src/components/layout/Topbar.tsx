import { Menu, PanelLeft, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { findNavItem } from '@/types/nav'
import { NotificationsPopover } from './NotificationsPopover'
import { RoleSwitcher } from './RoleSwitcher'
import { ThemeToggle } from './ThemeToggle'

interface TopbarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenMobile: () => void
  onOpenCommand: () => void
}

export function Topbar({
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  onOpenCommand,
}: TopbarProps) {
  const location = useLocation()
  const current = findNavItem(location.pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onOpenMobile}
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hidden text-muted-foreground hover:text-foreground lg:inline-flex"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeft className="size-4" />
        </Button>

        <div className="ml-1 flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {current?.group ?? 'Workspace'}
          </span>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
          <span className="truncate font-medium text-foreground">
            {current?.item.label ?? 'Workspace'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onOpenCommand}
            className={cn(
              'hidden h-8 items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground md:flex',
            )}
            aria-label="Open command palette"
          >
            <Search className="size-3.5" />
            <span>Search or jump to…</span>
            <kbd className="ml-2 rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={onOpenCommand}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>

          <NotificationsPopover />
          <div className="mx-1 hidden h-5 w-px bg-border/70 sm:block" />
          <RoleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
