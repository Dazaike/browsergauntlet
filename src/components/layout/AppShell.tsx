import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/Sidebar'
import { useTheme } from '@/lib/theme'
import { computeStats, scopeIds } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { fmtMs } from '@/lib/utils'

function RunClock() {
  const run = useStore((s) => s.run)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!run || run.finishedAt) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [run])
  if (!run) return null
  return <span data-testid="run-clock" className="font-mono tabular-nums text-muted-foreground">{fmtMs((run.finishedAt ?? now) - run.startedAt)}</span>
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <Button id="theme-toggle" data-testid="theme-toggle" variant="ghost" size="icon-sm" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  const stats = computeStats(records, scopeIds(run, mode))

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:block" aria-label="Sidebar">
        <Sidebar />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 max-w-[90vw] gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Challenge navigation</SheetDescription>
          </SheetHeader>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-5">
          <Button id="open-menu" variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <Link to="/" className="flex items-center gap-2 font-medium lg:hidden">
            <Swords className="size-4" aria-hidden /> BrowserGauntlet
          </Link>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <Badge id="mode-badge" data-testid="mode-badge" variant="outline" className="capitalize">{mode} mode</Badge>
            <RunClock />
            <span className="hidden text-muted-foreground sm:inline">
              <span data-testid="header-completed" className="font-mono tabular-nums text-foreground">{stats.completed}</span>/{stats.total} done
            </span>
            <span className="hidden text-muted-foreground sm:inline">
              score <span data-testid="header-score" className="font-mono tabular-nums text-foreground">{stats.score}</span>
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
