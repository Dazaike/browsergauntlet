export type Mode = 'practice' | 'challenge' | 'stress'
export type LogKind = 'system' | 'interaction' | 'success' | 'failure'
export type Status = 'idle' | 'active' | 'passed' | 'failed'

export interface LogEntry {
  id: number
  t: number
  kind: LogKind
  challenge?: string
  message: string
}

export interface Settings {
  /** Seed for every random target/ordering. Same seed => same puzzle. */
  seed: string
  /** Stress mode: extra delay (ms) added to delayed elements / initial render. */
  delayMs: number
  /** Stress mode: extra simulated network latency (ms). */
  latencyMs: number
  /** Stress mode: enable dynamic elements (layout shifts, shuffled options). */
  dynamic: boolean
  /** Challenge/stress mode: failed attempts allowed before a challenge is failed. */
  maxRetries: number
  /** Challenge/stress mode: per-challenge time limit in seconds (0 = none). */
  timeLimitSec: number
}

export interface ChallengeRecord {
  status: Status
  attempts: number
  successes: number
  failures: number
  /** failures since last (re)start — used for the retry limit in run modes */
  tryFailures: number
  hintsUsed: number
  resets: number
  /** accumulated active time for the current try (ms) */
  elapsedMs: number
  /** time of the passing attempt (ms) */
  completionMs?: number
  bestMs?: number
  completedAt?: number
  score: number
  lastFailure?: string
}

export interface Run {
  id: string
  mode: Exclude<Mode, 'practice'>
  seed: string
  order: string[]
  startedAt: number
  finishedAt?: number
  settings: Settings
}
