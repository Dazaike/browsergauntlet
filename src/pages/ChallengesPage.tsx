import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Lock, Search, XCircle } from 'lucide-react'
import { CHALLENGES, LEVELS } from '@/challenges/meta'
import { Input } from '@/components/ui/input'
import { gateFor } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { cn, fmtMs } from '@/lib/utils'

export function ChallengesPage() {
  const records = useStore((s) => s.records)
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const [q, setQ] = useState('')
  const [level, setLevel] = useState(0)

  const items = useMemo(() => {
    const t = q.trim().toLowerCase()
    return CHALLENGES.filter((c) => (level === 0 || c.level === level) && (!t || `${c.num} ${c.title} ${c.slug}`.toLowerCase().includes(t)))
  }, [q, level])

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="mt-1 text-sm text-muted-foreground">{CHALLENGES.length} challenges across {LEVELS.length} levels. Each has a stable route: <code className="font-mono text-xs">/challenge/&lt;slug&gt;</code>.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="challenge-search" aria-label="Search challenges" placeholder="Search challenges" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div role="group" aria-label="Level filter" className="flex flex-wrap gap-1">
          {[{ level: 0, name: 'All' }, ...LEVELS].map((l) => (
            <button
              key={l.level}
              type="button"
              id={`level-filter-${l.level}`}
              aria-pressed={level === l.level}
              onClick={() => setLevel(l.level)}
              className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors', level === l.level ? 'border-foreground/30 bg-accent' : 'border-border text-muted-foreground hover:bg-accent/50')}
            >
              {l.level === 0 ? 'All' : `L${l.level}`}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="challenge-grid">
        {items.map((c) => {
          const r = records[c.id]
          const st = r?.status ?? 'idle'
          const locked = gateFor(mode, run, records, c.id).kind !== 'open'
          return (
            <li key={c.id}>
              <Link
                to={`/challenge/${c.slug}`}
                data-testid={`card-${c.id}`}
                data-status={st}
                className={cn('flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40', locked && 'opacity-60')}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{String(c.num).padStart(2, '0')} · L{c.level}</span>
                  {st === 'passed' && <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="size-3.5" aria-hidden /> passed</span>}
                  {st === 'failed' && <span className="flex items-center gap-1 text-red-400"><XCircle className="size-3.5" aria-hidden /> failed</span>}
                  {st === 'active' && <span className="text-sky-400">in progress</span>}
                  {locked && <Lock className="size-3.5" aria-label="locked" />}
                </div>
                <h2 className="font-medium">{c.title}</h2>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.objective}</p>
                <div className="mt-auto flex gap-3 pt-1 text-xs text-muted-foreground">
                  <span>{r?.attempts ?? 0} attempts</span>
                  {r?.completionMs != null && <span>{fmtMs(r.completionMs)}</span>}
                  {st === 'passed' && <span>score {r!.score}</span>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No challenges match.</p>}
    </div>
  )
}
