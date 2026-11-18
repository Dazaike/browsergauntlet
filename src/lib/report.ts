import { CHALLENGES, LEVELS } from '@/challenges/meta'
import { computeStats, scopeIds } from '@/lib/stats'
import { emptyRecord, useStore } from '@/lib/store'
import { fmtClock } from '@/lib/utils'

export const REPORT_VERSION = 1

/** Snapshot of the current state as a plain JSON-serialisable object (read-only). */
export function buildReport() {
  const { mode, settings, records, run, log } = useStore.getState()
  const ids = scopeIds(run, mode)
  const stats = computeStats(records, ids)
  const inScope = new Set(ids)
  return {
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    mode,
    settings,
    run: run
      ? { id: run.id, mode: run.mode, seed: run.seed, startedAt: new Date(run.startedAt).toISOString(), finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null, elapsedMs: (run.finishedAt ?? Date.now()) - run.startedAt, order: run.order }
      : null,
    summary: {
      totalChallenges: stats.total,
      completed: stats.completed,
      failed: stats.failed,
      completionPct: round(stats.completionPct),
      successRatePct: round(stats.successRate),
      attempts: stats.attempts,
      failedAttempts: stats.failures,
      totalTimeMs: Math.round(stats.totalMs),
      avgTimeMs: stats.avgMs == null ? null : Math.round(stats.avgMs),
      fastest: stats.fastest ?? null,
      score: stats.score,
      maxScore: stats.maxScore,
      scoreIndex: stats.index,
    },
    byLevel: stats.byLevel.map((l) => ({ level: l.level, name: l.name, total: l.total, completed: l.completed, failed: l.failed, attempts: l.attempts, failedAttempts: l.failures, avgTimeMs: l.avgMs == null ? null : Math.round(l.avgMs), score: l.score, maxScore: l.maxScore })),
    challenges: CHALLENGES.filter((c) => inScope.has(c.id)).map((c) => {
      const r = records[c.id] ?? emptyRecord()
      return {
        id: c.id, num: c.num, slug: c.slug, title: c.title, level: c.level, category: LEVELS[c.level - 1].key,
        status: r.status, attempts: r.attempts, successes: r.successes, failures: r.failures, hintsUsed: r.hintsUsed, resets: r.resets,
        completionMs: r.completionMs == null ? null : Math.round(r.completionMs), bestMs: r.bestMs == null ? null : Math.round(r.bestMs),
        score: r.score, lastFailure: r.lastFailure ?? null,
      }
    }),
    log: log.map((e) => ({ id: e.id, time: new Date(e.t).toISOString(), kind: e.kind, challenge: e.challenge ?? null, message: e.message })),
  }
}

export type Report = ReturnType<typeof buildReport>

function round(n: number) {
  return Math.round(n * 100) / 100
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportToCSV(report: Report): string {
  const head = ['id', 'num', 'slug', 'title', 'level', 'category', 'status', 'attempts', 'successes', 'failures', 'hintsUsed', 'resets', 'completionMs', 'score', 'lastFailure']
  const rows = report.challenges.map((c) => head.map((k) => csvCell((c as Record<string, unknown>)[k])).join(','))
  return [head.join(','), ...rows].join('\n')
}

export function historyToCSV(report: Report): string {
  return ['id,time,kind,challenge,message', ...report.log.map((e) => [e.id, e.time, e.kind, e.challenge, e.message].map(csvCell).join(','))].join('\n')
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp(): string {
  return fmtClock(Date.now()).replace(/:/g, '')
}

declare global {
  interface Window {
    browserGauntlet?: {
      /** read-only JSON report */
      getReport: () => Report
      /** JSON string of the report */
      getReportJSON: () => string
    }
  }
}

/** Expose a read-only results API for automation tools: window.browserGauntlet.getReport() */
export function installWindowApi() {
  window.browserGauntlet = Object.freeze({
    getReport: () => buildReport(),
    getReportJSON: () => JSON.stringify(buildReport(), null, 2),
  })
}
