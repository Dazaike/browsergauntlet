import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { cn, fmtClock } from '@/lib/utils'
import type { LogKind } from '@/lib/types'

type Filter = 'all' | LogKind

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'success', label: 'Success' },
  { key: 'failure', label: 'Failure' },
  { key: 'interaction', label: 'Interactions' },
  { key: 'system', label: 'System' },
]

const KIND_STYLE: Record<LogKind, string> = {
  success: 'text-emerald-400',
  failure: 'text-red-400',
  interaction: 'text-sky-300',
  system: 'text-zinc-400',
}

export function ActivityLog({ challenge, height = 220, className, title = 'Activity log' }: { challenge?: string; height?: number; className?: string; title?: string }) {
  const log = useStore((s) => s.log)
  const clearLog = useStore((s) => s.clearLog)
  const [filter, setFilter] = useState<Filter>('all')
  const boxRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const entries = useMemo(
    () => log.filter((e) => (!challenge || e.challenge === challenge || !e.challenge) && (filter === 'all' || e.kind === filter)).slice(-300),
    [log, challenge, filter],
  )

  useEffect(() => {
    const el = boxRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <section aria-label={title} data-testid="activity-log" className={cn('overflow-hidden rounded-lg border border-border bg-zinc-950 text-zinc-200', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <Terminal className="size-4 text-zinc-500" aria-hidden />
        <h3 className="mr-auto text-xs font-medium text-zinc-300">{title}</h3>
        <div role="group" aria-label="Log filter" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              data-testid={`log-filter-${f.key}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn('rounded px-2 py-0.5 text-xs transition-colors', filter === f.key ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/10')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear log" data-testid="log-clear" className="text-zinc-400 hover:text-white" onClick={clearLog}>
          <Trash2 />
        </Button>
      </div>
      <div
        ref={boxRef}
        tabIndex={0}
        role="log"
        aria-label="Log entries"
        data-testid="log-entries"
        style={{ height }}
        className="overflow-auto px-3 py-2 font-mono text-xs leading-5"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {entries.length === 0 && <p className="text-zinc-500">No events yet.</p>}
        {entries.map((e) => (
          <div key={e.id} data-kind={e.kind} data-challenge={e.challenge} className={cn('whitespace-pre-wrap break-words', KIND_STYLE[e.kind])}>
            <span className="text-zinc-500">[{fmtClock(e.t)}]</span> {e.message}
          </div>
        ))}
      </div>
    </section>
  )
}
