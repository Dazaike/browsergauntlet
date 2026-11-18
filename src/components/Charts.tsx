import { CHALLENGES } from '@/challenges/meta'
import { cn, fmtMs } from '@/lib/utils'
import type { ChallengeRecord } from '@/lib/types'

export function StatCard({ label, value, sub, testId, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; testId: string; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p data-testid={testId} className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function Bar({ pct, className, label }: { pct: number; className?: string; label?: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full bg-emerald-500 transition-[width] duration-300', className)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

/** Completion time per challenge: one bar per passed challenge, failed ones in red. Pure SVG. */
export function TimeChart({ records, ids }: { records: Record<string, ChallengeRecord>; ids: string[] }) {
  const rows = ids
    .map((id) => ({ meta: CHALLENGES.find((c) => c.id === id)!, r: records[id] }))
    .filter((x) => x.r && (x.r.status === 'passed' || x.r.status === 'failed'))
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No finished challenges yet.</p>
  const max = Math.max(1000, ...rows.map((x) => x.r!.completionMs ?? x.r!.elapsedMs))
  const W = Math.max(rows.length * 18, 320)
  const H = 140
  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-label="Completion time per challenge" width={W} height={H + 22} viewBox={`0 0 ${W} ${H + 22}`} className="block">
        {rows.map((x, i) => {
          const ms = x.r!.completionMs ?? x.r!.elapsedMs
          const h = Math.max(3, (ms / max) * H)
          const passed = x.r!.status === 'passed'
          return (
            <g key={x.meta.id}>
              <title>{`${x.meta.num}. ${x.meta.title}: ${passed ? fmtMs(ms) : 'failed'}`}</title>
              <rect x={i * 18 + 2} y={H - h} width={14} height={h} rx={2} className={passed ? 'fill-emerald-500' : 'fill-red-500'} />
              <text x={i * 18 + 9} y={H + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{x.meta.num}</text>
            </g>
          )
        })}
        <line x1={0} y1={H} x2={W} y2={H} className="stroke-border" />
      </svg>
    </div>
  )
}
