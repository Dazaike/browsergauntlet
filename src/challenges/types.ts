import type { ComponentType } from 'react'
import type { LogKind, Mode, Status } from '@/lib/types'
import type { Rng } from '@/lib/prng'

/**
 * Everything a challenge component may do. The shell owns scoring, timing,
 * attempts and logging — components only report real, validated outcomes.
 */
export interface ChallengeApi {
  /** "c01" … "c61". Use as the DOM id prefix: `${api.id}-submit`. */
  id: string
  num: number
  mode: Mode
  /** Numeric seed for this challenge (hash of run seed + id). */
  seed: number
  /**
   * Deterministic PRNG. Pure: every call returns a NEW Rng seeded by (seed, id, key),
   * so it is safe in useState initialisers, StrictMode and after reset.
   * Use different keys for independent streams: api.rng('target'), api.rng('layout').
   */
  rng: (key?: string) => Rng
  /** Effective stress settings (all zero/false outside Stress mode). */
  settings: { delayMs: number; latencyMs: number; dynamic: boolean }
  /** Append an application event to the activity log. Throttle high-frequency events. */
  log: (message: string, kind?: LogKind) => void
  /** Report that the success condition was genuinely met. Idempotent. */
  succeed: (detail?: string) => void
  /** Report a failed attempt (wrong submission / wrong click). Counts toward retries. */
  fail: (reason: string) => void
  /**
   * Simulated network call: waits 120ms + settings.latencyMs, logs it, then returns fn().
   * Use for every "fetch"/"submit"/"search" style operation.
   */
  request: <T>(fn: () => T, label?: string) => Promise<T>
  /** ms + settings.delayMs — use for every artificial delay (delayed elements, timers). */
  delay: (ms: number) => number
}

export interface ChallengeProps {
  api: ChallengeApi
  /** passed = already completed; failed = locked out (body is inert); idle/active = in progress. */
  status: Status
}

export type ChallengeComponent = ComponentType<ChallengeProps>
