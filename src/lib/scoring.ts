import type { ChallengeMeta } from '@/challenges/meta'
import type { ChallengeRecord } from '@/lib/types'

export const MAX_SCORE_PER_CHALLENGE = 100
const BASE = 70
const TIME_BONUS = 30
const FAILURE_PENALTY = 10
const HINT_PENALTY = 5
const MIN_PASS_SCORE = 10

/**
 * Score for a passed challenge (0 if not passed):
 *   70 base + up to 30 time bonus (full at/below par, linear to 0 at 4x par)
 *   - 10 per failed attempt - 5 per hint, floored at 10.
 */
export function scoreFor(meta: ChallengeMeta, rec: ChallengeRecord, completionMs: number): number {
  const parMs = meta.par * 1000
  const over = Math.max(0, completionMs - parMs)
  const bonus = TIME_BONUS * Math.max(0, 1 - over / (parMs * 3))
  const raw = BASE + bonus - FAILURE_PENALTY * rec.failures - HINT_PENALTY * rec.hintsUsed
  return Math.max(MIN_PASS_SCORE, Math.round(raw))
}
