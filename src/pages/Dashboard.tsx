import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { ActivityLog } from '@/components/ActivityLog'
import { Bar, StatCard, TimeChart } from '@/components/Charts'
import { Button } from '@/components/ui/button'
import { CHALLENGES } from '@/challenges/meta'
import { computeStats, scopeIds } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { fmtMs } from '@/lib/utils'

export function Dashboard() {
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  const ids = scopeIds(run, mode)
  const s = computeStats(records, ids)
  const next = CHALLENGES.find((c) => records[c.id]?.status !== 'passed') ?? CHALLENGES[0]
  const fastest = s.fastest ? CHALLENGES.find((c) => c.id === s.fastest!.id) : undefined

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A benchmark for browser automation tools and AI agents: {CHALLENGES.length} real interaction challenges, strict validation, deterministic seeds and an objective score.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link id="dash-modes" to="/modes">Modes &amp; settings</Link></Button>
          <Button asChild size="sm"><Link id="dash-continue" to={`/challenge/${next.slug}`}><Play /> {s.completed ? 'Continue' : 'Start'} practice</Link></Button>
        </div>
      </div>

      <section aria-label="Statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard testId="stat-completed" label="Challenges completed" value={`${s.completed}/${s.total}`} sub={<Bar pct={s.completionPct} label="Completion" />} />
        <StatCard testId="stat-success-rate" label="Success rate" value={`${s.successRate.toFixed(0)}%`} sub={`${s.successes} passed of ${s.attempts} attempts`} />
        <StatCard testId="stat-total-time" label="Total completion time" value={fmtMs(s.totalMs)} sub="sum of passed challenges" />
        <StatCard testId="stat-avg-time" label="Avg per challenge" value={fmtMs(s.avgMs)} />
        <StatCard testId="stat-failed-attempts" label="Failed attempts" value={s.failures} sub={`${s.failed} challenge(s) failed`} />
        <StatCard testId="stat-fastest" label="Fastest completion" value={fmtMs(s.fastest?.ms)} sub={fastest ? `${fastest.num}. ${fastest.title}` : undefined} />
        <StatCard testId="stat-score" label="Overall score" value={s.score} sub={`of ${s.maxScore} · index ${s.index}/1000`} />
        <StatCard testId="stat-mode" label="Mode" value={<span className="capitalize">{mode}</span>} sub={run ? `${run.order.length} challenges in run` : 'unlimited attempts'} />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section aria-label="Progress by level" className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Progress by level</h2>
          <ul className="grid gap-3">
            {s.byLevel.map((l) => (
              <li key={l.level} data-testid={`level-progress-${l.level}`}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>L{l.level} · {l.name}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{l.completed}/{l.total}</span>
                </div>
                <Bar pct={l.pct} label={l.name} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Completion times" className="rounded-lg border border-border bg-card p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Completion time per challenge</h2>
            <Button asChild variant="ghost" size="xs"><Link to="/results">Results <ArrowRight /></Link></Button>
          </div>
          <TimeChart records={records} ids={ids} />
        </section>
      </div>

      <ActivityLog height={240} title="Recent activity" />
    </div>
  )
}
