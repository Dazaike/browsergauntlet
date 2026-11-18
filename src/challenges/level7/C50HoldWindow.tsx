import { useEffect, useRef, useState } from 'react'
import { Feedback, Task, Target, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

const MAX_S = 4
const WIDTH_S = 0.6

export default function C50HoldWindow({ api, status }: ChallengeProps) {
  const [startS] = useState(() => api.rng('window').int(15, 30) / 10)
  const endS = Math.round((startS + WIDTH_S) * 10) / 10
  const [holding, setHolding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [last, setLast] = useState<number | null>(null)
  const { fb, set } = useFeedback()
  const t0 = useRef(0)
  const activeId = useRef<number | null>(null)
  const raf = useRef(0)
  const locked = status === 'passed' || status === 'failed'

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const tick = () => {
    setElapsed((performance.now() - t0.current) / 1000)
    raf.current = requestAnimationFrame(tick)
  }

  const finish = (outcome: 'release' | 'leave' | 'cancel') => {
    const s = (performance.now() - t0.current) / 1000
    cancelAnimationFrame(raf.current)
    activeId.current = null
    setHolding(false)
    setElapsed(s)
    setLast(s)
    const text = `${s.toFixed(2)}s`
    api.log(`Hold ended (${outcome}) at ${text}`)
    if (outcome !== 'release') {
      set('error', `Hold aborted (${outcome}) at ${text}`)
      api.fail(`pointer ${outcome === 'leave' ? 'left the button' : 'cancelled'} at ${text}`)
    } else if (s >= startS && s <= endS) {
      set('success', `Released at ${text}, inside the window`)
      api.succeed(`released at ${text}`)
    } else {
      set('error', `Released at ${text}, ${s < startS ? 'before' : 'after'} the window`)
      api.fail(`released ${s < startS ? 'early' : 'late'} at ${text}`)
    }
  }

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (locked || activeId.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    activeId.current = e.pointerId
    t0.current = performance.now()
    setHolding(true)
    setElapsed(0)
    set('info', 'Holding…')
    api.log('Hold started')
    raf.current = requestAnimationFrame(tick)
  }

  // Leaving is only judged from real pointer coordinates (move/up); a hold with no pointermove at all is fine.
  const outside = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activeId.current !== e.pointerId) return
    if (outside(e)) finish('leave')
  }

  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activeId.current !== e.pointerId) return
    finish(outside(e) ? 'leave' : 'release')
  }

  const onCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activeId.current !== e.pointerId) return
    finish('cancel')
  }

  const pct = (s: number) => `${(Math.min(s, MAX_S) / MAX_S) * 100}%`

  return (
    <div className="grid gap-4">
      <Task>
        Press and hold the button, then release it while the timer is inside the green window, <Target>{startS.toFixed(1)}s</Target> to <Target>{endS.toFixed(1)}s</Target>. Leaving the button while holding fails the attempt.
      </Task>
      <div className="grid gap-2">
        <div
          id="c50-timeline"
          data-testid="c50-timeline"
          role="progressbar"
          aria-label="Hold timeline"
          aria-valuemin={0}
          aria-valuemax={MAX_S}
          aria-valuenow={Number(Math.min(elapsed, MAX_S).toFixed(2))}
          className="relative h-6 w-full overflow-hidden rounded-md border border-border bg-muted/40"
        >
          <div
            data-testid="c50-window-band"
            className="absolute inset-y-0 border-x-2 border-emerald-500 bg-emerald-500/25"
            style={{ left: pct(startS), width: `${(WIDTH_S / MAX_S) * 100}%` }}
          />
          <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: pct(elapsed) }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
          {[0, 1, 2, 3, 4].map((n) => <span key={n}>{n}s</span>)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span id="c50-window" data-testid="c50-window" data-start={startS} data-end={endS}>Window: {startS.toFixed(1)}s – {endS.toFixed(1)}s</span>
          <span>Elapsed: <strong id="c50-elapsed" data-testid="c50-elapsed" className="tabular-nums">{elapsed.toFixed(2)}s</strong></span>
          {last !== null && <span id="c50-last" data-testid="c50-last">Last release: {last.toFixed(2)}s</span>}
        </div>
      </div>
      <div>
        <button
          type="button"
          id="c50-hold"
          data-testid="c50-hold"
          data-holding={holding}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onLostPointerCapture={(e) => { if (activeId.current === e.pointerId) finish('cancel') }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'h-14 w-48 touch-none select-none rounded-md border border-border bg-primary text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            holding && 'bg-primary/80',
            locked && 'opacity-50',
          )}
        >
          {holding ? 'Holding…' : 'Hold me'}
        </button>
      </div>
      <Feedback state={fb} id="c50-feedback" />
    </div>
  )
}
