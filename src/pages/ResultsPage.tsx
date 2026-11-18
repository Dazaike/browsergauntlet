import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Download, FileJson, RotateCcw, XCircle } from 'lucide-react'
import { ActivityLog } from '@/components/ActivityLog'
import { Bar, StatCard, TimeChart } from '@/components/Charts'
import { Button } from '@/components/ui/button'
import { CHALLENGES } from '@/challenges/meta'
import { buildReport, download, historyToCSV, reportToCSV, stamp } from '@/lib/report'
import { computeStats, isFailed, scopeIds } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { cn, fmtMs } from '@/lib/utils'

export function ResultsPage() {
  const navigate = useNavigate()
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  const ids = scopeIds(run, mode)
  const s = computeStats(records, ids)
  const failedIds = ids.filter((id) => records[id] && isFailed(records[id]!))
  const elapsed = run && mode !== 'practice' ? (run.finishedAt ?? Date.now()) - run.startedAt : s.totalMs
  const finished = !!run?.finishedAt

  const retry = () => {
    const st = useStore.getState()
    if (run && mode !== 'practice') st.retryFailed()
    else for (const id of failedIds) st.reset(id)
    const first = run && mode !== 'practice'
      ? useStore.getState().run!.order[0]
      : failedIds[0]
    const meta = CHALLENGES.find((c) => c.id === first)
    if (meta) navigate(`/challenge/${meta.slug}`)
  }

  const exportJson = () => download(`browsergauntlet-${stamp()}.json`, JSON.stringify(buildReport(), null, 2), 'application/json')
  const exportCsv = () => download(`browsergauntlet-${stamp()}.csv`, reportToCSV(buildReport()), 'text/csv')
  const exportHistory = () => download(`browsergauntlet-history-${stamp()}.csv`, historyToCSV(buildReport()), 'text/csv')

  const unfinished = ids.filter((id) => !records[id] || records[id]!.status === 'idle' || records[id]!.status === 'active').length

  return (
    <div className="mx-auto grid max-w-6xl gap-5" data-testid="results" data-finished={finished}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run && mode !== 'practice'
              ? `${run.mode} run · seed ${run.seed} · ${finished ? 'finished' : `${unfinished} challenge(s) remaining`}`
              : 'Practice mode · all challenges'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button id="export-json" variant="outline" size="sm" onClick={exportJson}><FileJson /> Export JSON</Button>
          <Button id="export-csv" variant="outline" size="sm" onClick={exportCsv}><Download /> Export CSV</Button>
          <Button id="export-history-csv" variant="outline" size="sm" onClick={exportHistory}><Download /> History CSV</Button>
          <Button id="retry-failed" size="sm" disabled={failedIds.length === 0} onClick={retry}><RotateCcw /> Retry failed ({failedIds.length})</Button>
        </div>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard testId="res-completion" label="Overall completion" value={`${s.completionPct.toFixed(1)}%`} sub={<Bar pct={s.completionPct} label="Completion" />} />
        <StatCard testId="res-elapsed" label="Total elapsed time" value={fmtMs(elapsed)} sub={run && mode !== 'practice' ? 'wall clock of the run' : 'sum of passed challenges'} />
        <StatCard testId="res-completed" label="Completed" value={s.completed} sub={`of ${s.total}`} />
        <StatCard testId="res-failed" label="Failed" value={s.failed} sub={`${s.failures} failed attempts`} />
        <StatCard testId="res-attempts" label="Attempts" value={s.attempts} sub={`${s.successRate.toFixed(0)}% success rate`} />
        <StatCard testId="res-avg" label="Avg per challenge" value={fmtMs(s.avgMs)} sub={s.fastest ? `fastest ${fmtMs(s.fastest.ms)}` : undefined} />
        <StatCard testId="res-score" label="Score" value={s.score} sub={`of ${s.maxScore}`} />
        <StatCard testId="res-index" label="Score index" value={s.index} sub="out of 1000" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Performance by category" className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Performance by category</h2>
          <ul className="grid gap-3">
            {s.byLevel.map((l) => (
              <li key={l.level} data-testid={`res-level-${l.level}`}>
                <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs">
                  <span>L{l.level} · {l.name}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {l.completed}/{l.total} · {l.failures} failed attempts · avg {fmtMs(l.avgMs)} · {l.score}/{l.maxScore} pts
                  </span>
                </div>
                <Bar pct={l.pct} label={l.name} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Time per challenge" className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Completion time per challenge</h2>
          <TimeChart records={records} ids={ids} />
        </section>
      </div>

      <section aria-label="Challenge outcomes" className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm" data-testid="results-table">
          <caption className="sr-only">Outcome per challenge</caption>
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Challenge</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Attempts</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const c = CHALLENGES.find((x) => x.id === id)!
              const r = records[id]
              const st = r?.status ?? 'idle'
              return (
                <tr key={id} data-testid={`row-${id}`} data-status={st} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{String(c.num).padStart(2, '0')}</td>
                  <td className="px-3 py-1.5"><Link className="hover:underline" to={`/challenge/${c.slug}`}>{c.title}</Link></td>
                  <td className={cn('px-3 py-1.5 capitalize', st === 'passed' && 'text-emerald-400', st === 'failed' && 'text-red-400', st === 'active' && 'text-sky-400', st === 'idle' && 'text-muted-foreground')}>
                    <span className="inline-flex items-center gap-1">
                      {st === 'passed' && <CheckCircle2 className="size-3.5" aria-hidden />}
                      {st === 'failed' && <XCircle className="size-3.5" aria-hidden />}
                      {st}
                    </span>
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono text-xs tabular-nums sm:table-cell">{r?.attempts ?? 0}{r && r.failures > 0 ? ` (${r.failures} failed)` : ''}</td>
                  <td className="px-3 py-1.5 font-mono text-xs tabular-nums">{fmtMs(r?.completionMs)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">{r?.status === 'passed' ? r.score : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <ActivityLog height={360} title="Chronological interaction history" />
    </div>
  )
}
