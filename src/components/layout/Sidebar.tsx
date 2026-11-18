import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Activity, BarChart3, ChevronRight, FileJson, Gauge, Layers, ListChecks, Lock, Settings2, Swords } from 'lucide-react'
import { CHALLENGES, LEVELS } from '@/challenges/meta'
import { gateFor } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Status } from '@/lib/types'

const NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/challenges', label: 'All challenges', icon: ListChecks },
  { to: '/modes', label: 'Modes & settings', icon: Settings2 },
  { to: '/results', label: 'Results', icon: BarChart3 },
  { to: '/activity', label: 'Activity log', icon: Activity },
  { to: '/report', label: 'JSON report', icon: FileJson },
]

const DOT: Record<Status, string> = {
  idle: 'bg-muted-foreground/30',
  active: 'bg-sky-400',
  passed: 'bg-emerald-400',
  failed: 'bg-red-400',
}

export function Sidebar() {
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  const seed = useStore((s) => s.settings.seed)
  const { pathname } = useLocation()
  const currentSlug = pathname.startsWith('/challenge/') ? pathname.split('/')[2] : undefined
  const currentLevel = CHALLENGES.find((c) => c.slug === currentSlug)?.level
  const [open, setOpen] = useState<Record<number, boolean>>(() => (currentLevel ? { [currentLevel]: true } : { 1: true }))

  return (
    <div className="flex h-full flex-col" data-testid="sidebar">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <Swords className="size-5" aria-hidden />
        <span className="font-semibold tracking-tight">BrowserGauntlet</span>
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">v1</span>
      </div>

      <nav aria-label="Main" className="grid gap-0.5 p-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
            className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent', isActive ? 'bg-sidebar-accent font-medium' : 'text-muted-foreground')}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
        <div className="flex justify-between"><span>Mode</span><span data-testid="sidebar-mode" className="font-medium capitalize text-foreground">{mode}</span></div>
        <div className="flex justify-between"><span>Seed</span><span data-testid="sidebar-seed" className="font-mono text-foreground">{seed}</span></div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-1 pt-2 text-xs font-medium text-muted-foreground">
        <Layers className="size-3.5" aria-hidden /> Challenges
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4" data-testid="sidebar-challenges">
        {LEVELS.map((lv) => {
          const items = CHALLENGES.filter((c) => c.level === lv.level)
          const done = items.filter((c) => records[c.id]?.status === 'passed').length
          const expanded = !!open[lv.level]
          return (
            <div key={lv.level} className="mb-1">
              <button
                type="button"
                aria-expanded={expanded}
                data-testid={`sidebar-level-${lv.level}`}
                onClick={() => setOpen((o) => ({ ...o, [lv.level]: !o[lv.level] }))}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-sidebar-accent"
              >
                <ChevronRight className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} aria-hidden />
                <span className="truncate">L{lv.level} · {lv.name}</span>
                <span className="ml-auto font-mono tabular-nums text-muted-foreground">{done}/{items.length}</span>
              </button>
              {expanded && (
                <ul className="ml-3 border-l border-sidebar-border pl-1.5">
                  {items.map((c) => {
                    const st = records[c.id]?.status ?? 'idle'
                    const gate = gateFor(mode, run, records, c.id)
                    const locked = gate.kind !== 'open'
                    return (
                      <li key={c.id}>
                        <NavLink
                          to={`/challenge/${c.slug}`}
                          data-testid={`nav-${c.id}`}
                          data-status={st}
                          aria-label={`${c.num}. ${c.title}${locked ? ' (locked)' : ''}, ${st}`}
                          className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-sidebar-accent', isActive ? 'bg-sidebar-accent font-medium' : 'text-muted-foreground', locked && 'opacity-50')}
                        >
                          <span className={cn('size-1.5 shrink-0 rounded-full', DOT[st])} aria-hidden />
                          <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums">{String(c.num).padStart(2, '0')}</span>
                          <span className="truncate">{c.title}</span>
                          {locked && <Lock className="ml-auto size-3 shrink-0" aria-hidden />}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
