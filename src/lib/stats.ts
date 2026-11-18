import { CHALLENGES, LEVELS } from '@/challenges/meta'
import { MAX_SCORE_PER_CHALLENGE } from '@/lib/scoring'
import { emptyRecord } from '@/lib/store'
import type { ChallengeRecord, Run } from '@/lib/types'

export interface LevelStats {
  level: number
  name: string
  total: number
  completed: number
  failed: number
  attempts: number
  failures: number
  totalMs: number
  avgMs?: number
  score: number
  maxScore: number
  pct: number
}

export interface Stats {
  total: number
  completed: number
  /** failed in a run, or attempted with failed attempts and never passed */
  failed: number
  attempted: number
  attempts: number
  successes: number
  failures: number
  /** successful attempts / all attempts (0–100) */
  successRate: number
  completionPct: number
  totalMs: number
  avgMs?: number
  fastest?: { id: string; ms: number }
  slowest?: { id: string; ms: number }
  score: number
  maxScore: number
  /** score normalised to 0–1000 */
  index: number
  byLevel: LevelStats[]
}

export function scopeIds(run: Run | null, mode: string): string[] {
  return run && mode !== 'practice' ? run.order : CHALLENGES.map((c) => c.id)
}

export function isFailed(r: ChallengeRecord): boolean {
  return r.status === 'failed' || (r.status !== 'passed' && r.failures > 0)
}

export function computeStats(records: Record<string, ChallengeRecord>, ids: string[]): Stats {
  const set = new Set(ids)
  const byId = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]))
  const s: Stats = {
    total: ids.length, completed: 0, failed: 0, attempted: 0, attempts: 0, successes: 0, failures: 0,
    successRate: 0, completionPct: 0, totalMs: 0, score: 0, maxScore: ids.length * MAX_SCORE_PER_CHALLENGE, index: 0, byLevel: [],
  }
  const levels = LEVELS.map<LevelStats>((l) => ({ level: l.level, name: l.name, total: 0, completed: 0, failed: 0, attempts: 0, failures: 0, totalMs: 0, score: 0, maxScore: 0, pct: 0 }))

  for (const id of set) {
    const meta = byId[id]
    if (!meta) continue
    const r = records[id] ?? emptyRecord()
    const L = levels[meta.level - 1]
    L.total++
    L.maxScore += MAX_SCORE_PER_CHALLENGE
    s.attempts += r.attempts
    s.successes += r.successes
    s.failures += r.failures
    L.attempts += r.attempts
    L.failures += r.failures
    if (r.attempts > 0 || r.status !== 'idle') s.attempted++
    if (r.status === 'passed') {
      const ms = r.completionMs ?? r.elapsedMs
      s.completed++
      L.completed++
      s.totalMs += ms
      L.totalMs += ms
      s.score += r.score
      L.score += r.score
      if (!s.fastest || ms < s.fastest.ms) s.fastest = { id, ms }
      if (!s.slowest || ms > s.slowest.ms) s.slowest = { id, ms }
    } else if (isFailed(r)) {
      s.failed++
      L.failed++
    }
  }
  s.successRate = s.attempts ? (s.successes / s.attempts) * 100 : 0
  s.completionPct = s.total ? (s.completed / s.total) * 100 : 0
  s.avgMs = s.completed ? s.totalMs / s.completed : undefined
  s.index = s.maxScore ? Math.round((s.score / s.maxScore) * 1000) : 0
  for (const L of levels) {
    L.avgMs = L.completed ? L.totalMs / L.completed : undefined
    L.pct = L.total ? (L.completed / L.total) * 100 : 0
  }
  s.byLevel = levels.filter((l) => l.total > 0)
  return s
}
