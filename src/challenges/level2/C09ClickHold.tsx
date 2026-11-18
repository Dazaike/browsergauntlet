import { useCallback, useEffect, useRef, useState } from 'react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const REQUIRED_MS = 3000
const RADIUS = 70
const CIRC = 2 * Math.PI * RADIUS

interface Hold {
  pointerId: number
  startedAt: number
}

export default function C09ClickHold({ api, status }: ChallengeProps) {
  const [elapsed, setElapsed] = useState(0)
  const [holding, setHolding] = useState(false)
  const { fb, set } = useFeedback()
  const btnRef = useRef<HTMLButtonElement>(null)
  const hold = useRef<Hold | null>(null)
  const raf = useRef(0)

  const stopTicker = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const tick = useCallback(() => {
    const h = hold.current
    if (!h) return
    setElapsed(performance.now() - h.startedAt)
    raf.current = requestAnimationFrame(tick)
  }, [])

  const finish = useCallback(
    (reason: 'release' | 'cancel' | 'leave', over: boolean) => {
      const h = hold.current
      if (!h) return
      hold.current = null
      stopTicker()
      setHolding(false)
      const ms = performance.now() - h.startedAt
      setElapsed(ms)
      const secs = (ms / 1000).toFixed(2)
      api.log(`Hold duration: ${secs}s`)
      if (reason === 'cancel') {
        set('error', `Pointer cancelled after ${secs}s`)
        api.fail(`pointer cancelled after ${secs}s`)
      } else if (reason === 'leave' || (!over && ms < REQUIRED_MS)) {
        set('error', `Pointer left the button after ${secs}s`)
        api.fail(`left the button after ${secs}s`)
      } else if (!over) {
        set('error', `Released outside the button after ${secs}s`)
        api.fail(`released outside the button after ${secs}s`)
      } else if (ms >= REQUIRED_MS) {
        set('success', `Held for ${secs}s`)
        api.succeed(`held ${secs}s`)
      } else {
        set('error', `Released too early (${secs}s)`)
        api.fail(`released after ${secs}s`)
      }
    },
    [api, set, stopTicker],
  )

  useEffect(() => {
    // Hit-test the real (round) button, not its bounding box.
    const isOver = (x: number, y: number) => {
      const btn = btnRef.current
      const el = document.elementFromPoint(x, y)
      return !!btn && !!el && btn.contains(el)
    }
    // Leaving the button only fails the hold before the 3s mark; after that the release position decides.
    const onMove = (e: PointerEvent) => {
      const h = hold.current
      if (h && e.pointerId === h.pointerId && performance.now() - h.startedAt < REQUIRED_MS && !isOver(e.clientX, e.clientY)) finish('leave', false)
    }
    const onUp = (e: PointerEvent) => {
      const h = hold.current
      if (h && e.pointerId === h.pointerId) finish('release', isOver(e.clientX, e.clientY))
    }
    const onCancel = (e: PointerEvent) => {
      const h = hold.current
      if (h && e.pointerId === h.pointerId) finish('cancel', false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      hold.current = null
      cancelAnimationFrame(raf.current)
    }
  }, [finish])

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || hold.current || status === 'passed') return
    hold.current = { pointerId: e.pointerId, startedAt: performance.now() }
    setHolding(true)
    setElapsed(0)
    set('info', 'Holding…')
    api.log('Hold started')
    raf.current = requestAnimationFrame(tick)
  }

  const progress = Math.min(1, elapsed / REQUIRED_MS)
  const ready = elapsed >= REQUIRED_MS

  return (
    <div className="grid gap-5">
      <Task>
        Press and hold the button for at least <Target>3</Target> seconds without moving off it, then release.
      </Task>

      <div className="flex flex-col items-center gap-4">
        <div className="relative size-40">
          <svg viewBox="0 0 160 160" className="pointer-events-none absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="80" cy="80" r={RADIUS} fill="none" strokeWidth="8" className="stroke-muted" />
            <circle
              id={`${api.id}-ring`}
              data-testid={`${api.id}-ring`}
              data-progress={progress.toFixed(3)}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={ready ? 'stroke-emerald-500' : 'stroke-primary'}
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
            />
          </svg>
          <button
            ref={btnRef}
            id={`${api.id}-hold`}
            data-testid={`${api.id}-hold`}
            data-holding={holding}
            type="button"
            aria-label="Hold button"
            onPointerDown={onPointerDown}
            onContextMenu={(e) => e.preventDefault()}
            onPointerLeave={(e) => {
              const h = hold.current
              if (h && e.pointerId === h.pointerId && performance.now() - h.startedAt < REQUIRED_MS) finish('leave', false)
            }}
            onDragStart={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') e.preventDefault()
            }}
            className="absolute inset-5 touch-none select-none rounded-full border border-border bg-muted text-sm font-medium outline-none transition-colors [-webkit-touch-callout:none] hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 data-[holding=true]:bg-primary/15"
          >
            <span className="pointer-events-none">{holding ? (ready ? 'Release' : 'Holding') : 'Hold'}</span>
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Elapsed:{' '}
          <span id={`${api.id}-elapsed`} data-testid={`${api.id}-elapsed`} data-ms={Math.round(elapsed)} className="font-mono tabular-nums text-foreground">
            {(elapsed / 1000).toFixed(2)}s
          </span>
          <span className="tabular-nums"> / {(REQUIRED_MS / 1000).toFixed(2)}s</span>
        </p>
        <Feedback state={fb} id={`${api.id}-feedback`} />
      </div>
    </div>
  )
}
