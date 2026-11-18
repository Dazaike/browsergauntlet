import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lightbulb, Lock, RotateCcw, Target, X, XCircle } from 'lucide-react'
import { ActivityLog } from '@/components/ActivityLog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LEVELS, type ChallengeMeta } from '@/challenges/meta'
import type { ChallengeApi, ChallengeComponent } from '@/challenges/types'
import { useEffectiveSettings, useRecord, useStrict } from '@/lib/hooks'
import { Rng, hashString } from '@/lib/prng'
import { useStore } from '@/lib/store'
import { cn, fmtMs, sleep } from '@/lib/utils'

const STATUS_STYLE = {
  idle: 'border-border text-muted-foreground',
  active: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  passed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  failed: 'border-red-500/40 bg-red-500/10 text-red-400',
} as const

export function ChallengeShell({ meta, Component, prevHref, nextHref, nextLabel }: { meta: ChallengeMeta; Component: ChallengeComponent; prevHref?: string; nextHref: string; nextLabel: string }) {
  const id = meta.id
  const mode = useStore((s) => s.mode)
  // a running Challenge/Stress run pins the seed it started with
  const seed = useStore((s) => (s.mode !== 'practice' && s.run ? s.run.seed : s.settings.seed))
  const limit = useStore((s) => s.settings.timeLimitSec)
  const maxRetries = useStore((s) => s.settings.maxRetries)
  const eff = useEffectiveSettings()
  const strict = useStrict()
  const record = useRecord(id)
  const level = LEVELS[meta.level - 1]

  const [resetKey, setResetKey] = useState(0)
  const [ready, setReady] = useState(eff.delayMs === 0)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [hintShown, setHintShown] = useState(false)
  const [now, setNow] = useState(() => performance.now())
  const segStart = useRef(performance.now())
  const epoch = useRef(0)
  const statusRef = useRef(record.status)
  statusRef.current = record.status

  // Start / leave
  useEffect(() => {
    useStore.getState().begin(id)
    segStart.current = performance.now()
    const bankNow = () => {
      const st = statusRef.current
      if (st === 'passed' || st === 'failed') return
      useStore.getState().bank(id, performance.now() - segStart.current)
      segStart.current = performance.now()
    }
    window.addEventListener('pagehide', bankNow)
    return () => {
      window.removeEventListener('pagehide', bankNow)
      bankNow()
    }
  }, [id])

  // Ticker + time limit
  useEffect(() => {
    const t = setInterval(() => {
      setNow(performance.now())
      const { records } = useStore.getState()
      const r = records[id]
      if (strict && limit > 0 && r && r.status !== 'passed' && r.status !== 'failed') {
        if (r.elapsedMs + (performance.now() - segStart.current) >= limit * 1000) useStore.getState().timeout(id)
      }
    }, 250)
    return () => clearInterval(t)
  }, [id, strict, limit])

  // Stress mode: delayed mount + dynamic layout-shift notice
  useEffect(() => {
    setNoticeVisible(false)
    if (eff.delayMs === 0) {
      setReady(true)
    } else {
      setReady(false)
    }
    const t1 = eff.delayMs > 0 ? setTimeout(() => setReady(true), eff.delayMs) : undefined
    const t2 = eff.dynamic ? setTimeout(() => setNoticeVisible(true), 700 + eff.delayMs) : undefined
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [resetKey, id, eff.delayMs, eff.dynamic])

  const api = useMemo<ChallengeApi>(() => {
    const myEpoch = epoch.current
    const alive = () => epoch.current === myEpoch
    return {
      id,
      num: meta.num,
      mode,
      seed: hashString(`${seed}:${id}`),
      rng: (key = 'main') => new Rng(`${seed}:${id}:${key}`),
      settings: { delayMs: eff.delayMs, latencyMs: eff.latencyMs, dynamic: eff.dynamic },
      log: (message, kind = 'interaction') => {
        if (alive()) useStore.getState().addLog(kind, message, id)
      },
      succeed: (detail) => {
        if (!alive()) return
        const seg = performance.now() - segStart.current
        segStart.current = performance.now()
        useStore.getState().success(id, seg, detail)
      },
      fail: (reason) => {
        if (alive()) useStore.getState().failure(id, reason)
      },
      request: async (fn, label = 'request') => {
        const ms = 120 + eff.latencyMs
        if (alive()) useStore.getState().addLog('system', `Network: ${label} started (simulated ${ms}ms)`, id)
        await sleep(ms)
        if (alive()) useStore.getState().addLog('system', `Network: ${label} resolved`, id)
        return fn()
      },
      delay: (ms) => ms + eff.delayMs,
    }
    // resetKey creates a fresh api (and a fresh epoch) for every reset
  }, [id, meta.num, mode, seed, eff.delayMs, eff.latencyMs, eff.dynamic, resetKey])

  const doReset = useCallback(() => {
    const st = useStore.getState()
    if (statusRef.current !== 'passed') st.bank(id, performance.now() - segStart.current)
    segStart.current = performance.now()
    epoch.current += 1
    for (const k of Object.keys(localStorage)) if (k.startsWith(`bg:${id}:`)) localStorage.removeItem(k)
    st.reset(id)
    setHintShown(false)
    setReady(eff.delayMs === 0)
    setResetKey((k) => k + 1)
  }, [id, eff.delayMs])

  const status = record.status
  const elapsed = status === 'passed' ? (record.completionMs ?? record.elapsedMs) : record.elapsedMs + (status === 'failed' ? 0 : Math.max(0, now - segStart.current))
  const remaining = strict && limit > 0 && status !== 'passed' && status !== 'failed' ? Math.max(0, limit * 1000 - elapsed) : undefined
  const canReset = !strict || (status !== 'failed' && status !== 'passed')
  const nextEnabled = !strict || status === 'passed' || status === 'failed'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4" data-testid="challenge-page" data-challenge-id={id} data-status={status}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Level {level.level} · {level.name}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="font-mono text-muted-foreground">{String(meta.num).padStart(2, '0')}</span>
            <span data-testid="challenge-title">{meta.title}</span>
            <Badge variant="outline" data-testid="challenge-status" data-status={status} className={cn('capitalize', STATUS_STYLE[status])}>
              {status === 'passed' && <CheckCircle2 aria-hidden />}
              {status === 'failed' && <XCircle aria-hidden />}
              {status}
            </Badge>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono tabular-nums" title="Elapsed time">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            <span data-testid="challenge-timer" data-ms={Math.round(elapsed)}>{fmtMs(elapsed)}</span>
            {remaining !== undefined && <span data-testid="challenge-remaining" className={cn('text-muted-foreground', remaining < 10000 && 'text-red-400')}>/ {Math.ceil(remaining / 1000)}s left</span>}
          </div>
          <div className="rounded-md border border-border px-2.5 py-1.5" title="Attempts">
            Attempts <span data-testid="challenge-attempts" className="font-mono tabular-nums">{record.attempts}</span>
            <span className="text-muted-foreground"> · </span>
            <span data-testid="challenge-failures" className="font-mono tabular-nums text-red-400">{record.failures}</span>
            <span className="text-muted-foreground"> failed</span>
            {strict && <span data-testid="challenge-retries" className="ml-1 text-muted-foreground">({Math.min(record.tryFailures, maxRetries)}/{maxRetries} retries)</span>}
          </div>
          {mode === 'practice' && (
            <Button
              id="hint-button"
              data-testid="hint-button"
              variant="outline"
              size="sm"
              aria-pressed={hintShown}
              onClick={() => {
                if (!hintShown) useStore.getState().hint(id)
                setHintShown((v) => !v)
              }}
            >
              <Lightbulb /> Hint
            </Button>
          )}
          <Button id="reset-button" data-testid="reset-button" variant="outline" size="sm" disabled={!canReset} onClick={doReset}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </header>

      <section aria-label="Objective" data-testid="objective" className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="flex gap-2">
          <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span data-testid="objective-text">{meta.objective}</span>
        </p>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-md bg-emerald-500/5 px-3 py-2">
            <dt className="font-medium text-emerald-400">Success condition</dt>
            <dd data-testid="success-condition" className="mt-0.5 text-muted-foreground">{meta.success}</dd>
          </div>
          <div className="rounded-md bg-red-500/5 px-3 py-2">
            <dt className="font-medium text-red-400">Failure condition</dt>
            <dd data-testid="failure-condition" className="mt-0.5 text-muted-foreground">{meta.failure}</dd>
          </div>
        </dl>
        {hintShown && mode === 'practice' && (
          <p data-testid="hint-text" role="note" className="flex gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-amber-300">
            <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
            {meta.hint}
          </p>
        )}
        {record.lastFailure && status !== 'passed' && (
          <p data-testid="last-failure" className="text-xs text-red-400">Last failure: {record.lastFailure}</p>
        )}
      </section>

      {status === 'passed' && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} data-testid="completion-banner" role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden />
          <span className="font-medium">Challenge completed</span>
          <span className="text-emerald-300/80">
            {fmtMs(record.completionMs)} · score <span data-testid="challenge-score">{record.score}</span>
          </span>
        </motion.div>
      )}
      {status === 'failed' && (
        <div data-testid="failure-banner" role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <Lock className="size-4" aria-hidden />
          <span className="font-medium">Challenge failed</span>
          <span className="text-red-300/80">{record.lastFailure ?? 'retries exhausted'}</span>
        </div>
      )}

      {noticeVisible && (
        <div role="alert" data-testid="dynamic-notice" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          <span>Stress mode: a late-loading banner just shifted the layout. Dismiss it to continue.</span>
          <Button id="dynamic-notice-dismiss" variant="ghost" size="icon-xs" aria-label="Dismiss notice" onClick={() => setNoticeVisible(false)}>
            <X />
          </Button>
        </div>
      )}

      <section
        id={`challenge-${id}`}
        data-testid="challenge-body"
        data-challenge-id={id}
        data-status={status}
        aria-label={`${meta.title} challenge`}
        // inert makes a locked-out challenge un-interactable for every tool and for assistive tech
        inert={status === 'failed'}
        className={cn('relative rounded-lg border border-border bg-card p-4 sm:p-6', status === 'failed' && 'opacity-60')}
      >
        {ready ? (
          <Component key={resetKey} api={api} status={status} />
        ) : (
          <div data-testid="challenge-loading" role="status" aria-live="polite" className="grid gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
            <p className="text-xs text-muted-foreground">Loading challenge… (stress delay {eff.delayMs}ms)</p>
          </div>
        )}
      </section>

      <nav aria-label="Challenge navigation" className="flex items-center justify-between">
        {prevHref ? (
          <Button asChild variant="ghost" size="sm">
            <Link id="prev-challenge" to={prevHref}><ArrowLeft /> Previous</Link>
          </Button>
        ) : <span />}
        <Button asChild={nextEnabled} id="next-challenge" variant={status === 'passed' || status === 'failed' ? 'default' : 'ghost'} size="sm" disabled={!nextEnabled}>
          {nextEnabled ? <Link id="next-challenge-link" to={nextHref}>{nextLabel} <ArrowRight /></Link> : <span>{nextLabel} <ArrowRight /></span>}
        </Button>
      </nav>

      <ActivityLog challenge={id} height={200} title={`Activity log · challenge ${String(meta.num).padStart(2, '0')}`} />
    </div>
  )
}
