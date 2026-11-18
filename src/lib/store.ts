import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { CHALLENGES, CHALLENGE_BY_ID } from '@/challenges/meta'
import { Rng, randomSeed } from '@/lib/prng'
import { scoreFor } from '@/lib/scoring'
import { fmtMs } from '@/lib/utils'
import type { ChallengeRecord, LogEntry, LogKind, Mode, Run, Settings } from '@/lib/types'

export const DEFAULT_SETTINGS: Settings = {
  seed: randomSeed(),
  delayMs: 300,
  latencyMs: 400,
  dynamic: true,
  maxRetries: 3,
  timeLimitSec: 120,
}

export function emptyRecord(): ChallengeRecord {
  return { status: 'idle', attempts: 0, successes: 0, failures: 0, tryFailures: 0, hintsUsed: 0, resets: 0, elapsedMs: 0, score: 0 }
}

const LOG_CAP = 1500

interface State {
  mode: Mode
  settings: Settings
  records: Record<string, ChallengeRecord>
  run: Run | null
  log: LogEntry[]
  logSeq: number

  setMode: (m: Mode) => void
  updateSettings: (p: Partial<Settings>) => void
  addLog: (kind: LogKind, message: string, challenge?: string) => void
  clearLog: () => void

  begin: (id: string) => void
  bank: (id: string, ms: number) => void
  success: (id: string, segmentMs: number, detail?: string) => void
  failure: (id: string, reason: string) => void
  timeout: (id: string) => void
  hint: (id: string) => void
  reset: (id: string) => void

  startRun: (mode: Exclude<Mode, 'practice'>) => void
  finishRun: () => void
  retryFailed: () => void
  resetAll: () => void
}

/** Debounced localStorage so high-frequency log writes do not thrash the main thread. */
function debouncedStorage(): StateStorage {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: [string, string] | undefined
  const flush = () => {
    if (pending) localStorage.setItem(pending[0], pending[1])
    pending = undefined
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      pending = [name, value]
      clearTimeout(timer)
      timer = setTimeout(flush, 200)
    },
    removeItem: (name) => localStorage.removeItem(name),
  }
}

export function orderFor(mode: Exclude<Mode, 'practice'>, seed: string): string[] {
  const ids = CHALLENGES.map((c) => c.id)
  return mode === 'stress' ? new Rng(`${seed}:order`).shuffle(ids) : ids
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patch = (id: string, p: Partial<ChallengeRecord>) =>
        set((s) => ({ records: { ...s.records, [id]: { ...(s.records[id] ?? emptyRecord()), ...p } } }))
      const rec = (id: string) => get().records[id] ?? emptyRecord()
      const label = (id: string) => `Challenge ${id.slice(1)}`
      const strict = () => get().mode !== 'practice' && get().run != null

      /** Finish the run once every challenge in the run order is passed or failed. */
      const checkRunDone = () => {
        const { run, records } = get()
        if (!run || run.finishedAt) return
        const done = run.order.every((id) => {
          const st = records[id]?.status
          return st === 'passed' || st === 'failed'
        })
        if (done) get().finishRun()
      }

      return {
        mode: 'practice',
        settings: DEFAULT_SETTINGS,
        records: {},
        run: null,
        log: [],
        logSeq: 0,

        setMode: (mode) => {
          if (get().mode === mode) return
          set({ mode })
          get().addLog('system', `Mode changed to ${mode}`)
        },
        updateSettings: (p) => {
          set((s) => ({ settings: { ...s.settings, ...p } }))
          get().addLog('system', `Settings updated: ${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ')}`)
        },
        addLog: (kind, message, challenge) =>
          set((s) => {
            const entry: LogEntry = { id: s.logSeq + 1, t: Date.now(), kind, message, challenge }
            const log = s.log.length >= LOG_CAP ? [...s.log.slice(-(LOG_CAP - 100)), entry] : [...s.log, entry]
            return { log, logSeq: entry.id }
          }),
        clearLog: () => set({ log: [] }),

        begin: (id) => {
          const r = rec(id)
          if (r.status === 'idle') {
            patch(id, { status: 'active' })
            get().addLog('system', `${label(id)} started`, id)
          } else if (r.status === 'active') {
            get().addLog('system', `${label(id)} resumed`, id)
          }
        },

        bank: (id, ms) => {
          if (ms <= 0) return
          const r = rec(id)
          if (r.status === 'passed' || r.status === 'failed') return
          patch(id, { elapsedMs: r.elapsedMs + ms })
        },

        success: (id, segmentMs, detail) => {
          const r = rec(id)
          if (r.status === 'passed' || r.status === 'failed') return
          const meta = CHALLENGE_BY_ID[id]
          const total = r.elapsedMs + segmentMs
          const next: ChallengeRecord = {
            ...r,
            attempts: r.attempts + 1,
            successes: r.successes + 1,
            status: 'passed',
            elapsedMs: total,
            completionMs: total,
            bestMs: Math.min(r.bestMs ?? Infinity, total),
            completedAt: Date.now(),
            lastFailure: undefined,
          }
          next.score = scoreFor(meta, next, total)
          patch(id, next)
          get().addLog('success', detail ? `Validation passed: ${detail}` : 'Validation passed', id)
          get().addLog('success', `${label(id)} completed in ${fmtMs(total)}`, id)
          const sum = Object.values(get().records).reduce((a, x) => a + (x.status === 'passed' ? x.score : 0), 0)
          get().addLog('system', `Score updated: +${next.score} (total ${sum})`, id)
          checkRunDone()
        },

        failure: (id, reason) => {
          const r = rec(id)
          if (r.status === 'passed' || r.status === 'failed') return
          const { settings } = get()
          const tryFailures = r.tryFailures + 1
          const exhausted = strict() && tryFailures >= settings.maxRetries
          patch(id, {
            attempts: r.attempts + 1,
            failures: r.failures + 1,
            tryFailures,
            lastFailure: reason,
            status: exhausted ? 'failed' : 'active',
            score: 0,
          })
          get().addLog('failure', `Validation failed: ${reason}`, id)
          if (exhausted) {
            get().addLog('failure', `${label(id)} failed: retries exhausted (${tryFailures}/${settings.maxRetries})`, id)
            checkRunDone()
          } else if (strict()) {
            get().addLog('system', `Retries used ${tryFailures}/${settings.maxRetries}`, id)
          }
        },

        timeout: (id) => {
          const r = rec(id)
          if (r.status === 'passed' || r.status === 'failed') return
          patch(id, {
            attempts: r.attempts + 1,
            failures: r.failures + 1,
            tryFailures: r.tryFailures + 1,
            status: 'failed',
            lastFailure: 'time limit exceeded',
            score: 0,
          })
          get().addLog('failure', `${label(id)} failed: time limit of ${get().settings.timeLimitSec}s exceeded`, id)
          checkRunDone()
        },

        hint: (id) => {
          patch(id, { hintsUsed: rec(id).hintsUsed + 1 })
          get().addLog('interaction', 'Hint revealed', id)
        },

        reset: (id) => {
          const r = rec(id)
          const keepClock = strict()
          patch(id, {
            status: 'idle',
            resets: r.resets + 1,
            elapsedMs: keepClock ? r.elapsedMs : 0,
            tryFailures: keepClock ? r.tryFailures : 0,
            completionMs: undefined,
            completedAt: undefined,
            lastFailure: undefined,
            score: 0,
          })
          get().addLog('system', `${label(id)} reset`, id)
        },

        startRun: (mode) => {
          const { settings } = get()
          const run: Run = {
            id: `run-${Date.now().toString(36)}`,
            mode,
            seed: settings.seed,
            order: orderFor(mode, settings.seed),
            startedAt: Date.now(),
            settings: { ...settings },
          }
          set({ mode, run, records: {} })
          get().addLog('system', `Run started: ${mode} mode, seed "${settings.seed}", ${run.order.length} challenges`)
        },

        finishRun: () => {
          const { run } = get()
          if (!run || run.finishedAt) return
          set({ run: { ...run, finishedAt: Date.now() } })
          get().addLog('system', 'Run finished')
        },

        retryFailed: () => {
          const { run, records } = get()
          if (!run) return
          const failed = run.order.filter((id) => records[id]?.status !== 'passed')
          if (!failed.length) return
          const next = { ...records }
          for (const id of failed) {
            const r = next[id] ?? emptyRecord()
            next[id] = { ...r, status: 'idle', tryFailures: 0, elapsedMs: 0, score: 0, lastFailure: undefined }
          }
          set({ records: next, run: { ...run, order: failed, finishedAt: undefined } })
          get().addLog('system', `Retrying ${failed.length} unfinished/failed challenge(s): ${failed.join(', ')}`)
        },

        resetAll: () => {
          set({ records: {}, run: null, mode: 'practice' })
          get().addLog('system', 'All progress reset')
        },
      }
    },
    {
      name: 'browsergauntlet:v1',
      version: 1,
      storage: createJSONStorage(debouncedStorage),
      partialize: (s) => ({ mode: s.mode, settings: s.settings, records: s.records, run: s.run, log: s.log.slice(-400), logSeq: s.logSeq }),
    },
  ),
)
