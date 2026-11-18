import { useStore } from '@/lib/store'
import type { Mode } from '@/lib/types'

/**
 * Lets automation configure a session from the URL:
 *   ?seed=abc&mode=stress&delay=300&latency=500&dynamic=1&retries=3&limit=120&autostart=1&fresh=1
 * Applied once at startup (before first render). `fresh=1` wipes saved progress first.
 */
export function applyUrlConfig() {
  const q = new URLSearchParams(window.location.search)
  if (![...q.keys()].length) return
  const st = useStore.getState()
  if (q.get('fresh') === '1') st.resetAll()

  const patch: Partial<ReturnType<typeof useStore.getState>['settings']> = {}
  const seed = q.get('seed')
  if (seed) patch.seed = seed
  const num = (k: string) => {
    const v = Number(q.get(k))
    return q.has(k) && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  const delay = num('delay'), latency = num('latency'), retries = num('retries'), limit = num('limit')
  if (delay != null) patch.delayMs = delay
  if (latency != null) patch.latencyMs = latency
  if (retries != null) patch.maxRetries = retries
  if (limit != null) patch.timeLimitSec = limit
  if (q.has('dynamic')) patch.dynamic = q.get('dynamic') === '1' || q.get('dynamic') === 'true'
  if (Object.keys(patch).length) useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  const mode = q.get('mode') as Mode | null
  if (mode === 'practice' || mode === 'challenge' || mode === 'stress') {
    if (mode === 'practice') st.setMode('practice')
    else if (q.get('autostart') === '1' || useStore.getState().run?.mode !== mode) st.startRun(mode)
    else st.setMode(mode)
  }
}
