import { useMemo } from 'react'
import { emptyRecord, useStore } from '@/lib/store'
import type { ChallengeRecord } from '@/lib/types'

const EMPTY = emptyRecord()

export function useRecord(id: string): ChallengeRecord {
  return useStore((s) => s.records[id]) ?? EMPTY
}

/** True in Challenge/Stress mode with a run (timed, limited retries, no resets after resolution). */
export function useStrict(): boolean {
  return useStore((s) => s.mode !== 'practice' && s.run != null)
}

/** Stress knobs apply only in Stress mode. */
export function useEffectiveSettings() {
  const mode = useStore((s) => s.mode)
  const delayMs = useStore((s) => s.settings.delayMs)
  const latencyMs = useStore((s) => s.settings.latencyMs)
  const dynamic = useStore((s) => s.settings.dynamic)
  return useMemo(
    () => (mode === 'stress' ? { delayMs, latencyMs, dynamic } : { delayMs: 0, latencyMs: 0, dynamic: false }),
    [mode, delayMs, latencyMs, dynamic],
  )
}

export type Gate =
  | { kind: 'open' }
  | { kind: 'needs-run' }
  | { kind: 'not-in-run' }
  | { kind: 'locked'; currentId: string }

/** Whether a challenge may be opened right now (sequential order applies in Challenge/Stress runs). */
export function gateFor(
  mode: string,
  run: { mode: string; order: string[]; finishedAt?: number } | null,
  records: Record<string, ChallengeRecord>,
  id: string,
): Gate {
  if (mode === 'practice') return { kind: 'open' }
  if (!run || run.mode !== mode) return { kind: 'needs-run' }
  const idx = run.order.indexOf(id)
  if (idx < 0) return { kind: 'not-in-run' }
  // a finished run stays browsable (read-only: resolved challenges cannot be reset)
  if (run.finishedAt) return { kind: 'open' }
  const currentId = run.order.find((i) => {
    const st = records[i]?.status
    return st !== 'passed' && st !== 'failed'
  })
  if (currentId && run.order.indexOf(currentId) < idx) return { kind: 'locked', currentId }
  return { kind: 'open' }
}

export function useGate(id: string): Gate {
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  return useMemo(() => gateFor(mode, run, records, id), [mode, run, records, id])
}
