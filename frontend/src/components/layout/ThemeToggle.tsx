import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="relative text-muted-foreground hover:text-foreground"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun
        className={cn(
          'absolute size-4 transition-all duration-300',
          isDark ? 'rotate-0 scale-100' : '-rotate-90 scale-0',
        )}
      />
      <Moon
        className={cn(
          'absolute size-4 transition-all duration-300',
          isDark ? 'rotate-90 scale-0' : 'rotate-0 scale-100',
        )}
      />
    </Button>
  )
}
