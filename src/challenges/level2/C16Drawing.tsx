import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import { Rng } from '@/lib/prng'
import type { ChallengeProps } from '@/challenges/types'

const RADIUS = 22
const REF_W = 320
const REF_H = 240

interface Pt {
  x: number
  y: number
}

/** Checkpoints as fractions of the canvas, spaced apart even at the smallest layout. */
function makeCheckpoints(r: Rng, count: number): Pt[] {
  const pts: Pt[] = []
  let sep = 96
  let tries = 0
  while (pts.length < count) {
    const p = { x: 0.1 + r.next() * 0.8, y: 0.18 + r.next() * 0.64 }
    const ok = pts.every((q) => Math.hypot((p.x - q.x) * REF_W, (p.y - q.y) * REF_H) >= sep)
    if (ok) pts.push(p)
    if (++tries % 80 === 0) sep = Math.max(44, sep - 8)
  }
  return pts
}

/** Distance from p to segment a→b and the segment parameter t (0..1) of the closest point. */
function closestOnSegment(p: Pt, a: Pt, b: Pt): { dist: number; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return { dist: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t }
}

export default function C16Drawing({ api }: ChallengeProps) {
  const [checkpoints] = useState(() => {
    const r = api.rng('checkpoints')
    return makeCheckpoints(r, r.int(4, 5))
  })
  const total = checkpoints.length
  const [size, setSize] = useState({ w: 600, h: 330 })
  const [hit, setHit] = useState(0)
  const [drawing, setDrawing] = useState(false)
  const { fb, set } = useFeedback()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef(size)
  const stroke = useRef<Pt[]>([]) // fractions of the canvas
  const hitRef = useRef(0)
  const active = useRef<number | null>(null)
  const done = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { w, h } = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pts = stroke.current
    if (pts.length === 0) return
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = hitRef.current === total ? '#10b981' : '#0ea5e9'
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * h)
    if (pts.length === 1) ctx.lineTo(pts[0].x * w + 0.01, pts[0].y * h)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
    ctx.stroke()
  }, [total])

  // Responsive sizing: track the wrapper width.
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const w = Math.max(200, Math.floor(wrap.clientWidth))
      setSize((s) => (s.w === w ? s : { w, h: Math.min(340, Math.max(240, Math.round(w * 0.55))) }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // DPR-aware backing store; resetting the dimensions clears it, so redraw afterwards.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    sizeRef.current = size
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    draw()
  }, [size, draw])

  const toFraction = (e: { clientX: number; clientY: number }): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  /** Registers every consecutive checkpoint that the segment a→b passes through, in travel order. */
  const advance = (a: Pt, b: Pt) => {
    const { w, h } = sizeRef.current
    const pa = { x: a.x * w, y: a.y * h }
    const pb = { x: b.x * w, y: b.y * h }
    let changed = false
    let minT = 0
    while (hitRef.current < total) {
      const c = checkpoints[hitRef.current]
      const { dist, t } = closestOnSegment({ x: c.x * w, y: c.y * h }, pa, pb)
      if (dist > RADIUS || t < minT) break
      minT = t
      hitRef.current++
      changed = true
      api.log(`Checkpoint ${hitRef.current} registered`)
    }
    if (changed) setHit(hitRef.current)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || active.current !== null || done.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    active.current = e.pointerId
    const p = toFraction(e)
    stroke.current = [p]
    hitRef.current = 0
    setHit(0)
    setDrawing(true)
    set('info', 'Drawing…')
    api.log('Stroke started')
    advance(p, p)
    draw()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const prev = stroke.current[stroke.current.length - 1]
      const p = toFraction(ev)
      stroke.current.push(p)
      advance(prev, p)
    }
    draw()
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return
    active.current = null
    setDrawing(false)
    const cancelled = e.type === 'pointercancel'
    if (!cancelled) {
      const prev = stroke.current[stroke.current.length - 1]
      const p = toFraction(e)
      stroke.current.push(p)
      advance(prev, p)
    }
    draw()
    const n = hitRef.current
    api.log(`Stroke ${cancelled ? 'cancelled' : 'released'} with ${n}/${total} checkpoints`)
    if (cancelled) {
      set('info', 'Stroke interrupted by the browser. Start a new stroke.')
    } else if (n === total) {
      done.current = true
      set('success', `All ${total} checkpoints reached in order`)
      api.succeed(`${total}/${total} checkpoints`)
    } else {
      set('error', `Stroke ended after ${n}/${total} checkpoints`)
      api.fail(`stroke ended after ${n}/${total} checkpoints`)
    }
  }

  const clear = () => {
    if (active.current !== null) return
    stroke.current = []
    hitRef.current = 0
    setHit(0)
    draw()
    set('idle', '')
    api.log('Canvas cleared')
  }

  return (
    <div className="grid gap-5">
      <Task>
        Draw one continuous stroke through checkpoints <Target>1</Target> to <Target>{total}</Target> in order, without lifting the pointer.
      </Task>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/30"
        style={{ height: size.h + 2 }}
      >
        {checkpoints.map((c, i) => {
          const reached = i < hit
          const next = i === hit
          return (
            <div
              key={i}
              id={`${api.id}-checkpoint-${i + 1}`}
              data-testid={`${api.id}-checkpoint-${i + 1}`}
              data-hit={reached}
              data-next={next}
              data-x={c.x.toFixed(4)}
              data-y={c.y.toFixed(4)}
              aria-label={`Checkpoint ${i + 1}${reached ? ' reached' : ''}`}
              className={cn(
                'pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums',
                reached ? 'border-emerald-500 bg-emerald-500/25 text-emerald-600 dark:text-emerald-300' : next ? 'border-primary bg-background text-foreground' : 'border-border bg-background text-muted-foreground',
              )}
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: RADIUS * 2, height: RADIUS * 2 }}
            >
              {i + 1}
            </div>
          )
        })}
        <canvas
          ref={canvasRef}
          id={`${api.id}-canvas`}
          data-testid={`${api.id}-canvas`}
          data-drawing={drawing}
          role="img"
          aria-label="Drawing canvas with numbered checkpoints"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 size-full cursor-crosshair touch-none select-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <output id={`${api.id}-progress`} data-testid={`${api.id}-progress`} data-hit={hit} data-total={total} className="font-mono text-sm tabular-nums">
          Checkpoints: {hit}/{total}
        </output>
        <Button id={`${api.id}-clear`} data-testid={`${api.id}-clear`} variant="outline" size="sm" onClick={clear}>
          <Eraser /> Clear
        </Button>
        <Feedback state={fb} id={`${api.id}-feedback`} />
      </div>
    </div>
  )
}
