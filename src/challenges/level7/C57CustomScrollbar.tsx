import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'

const ROWS = 60
const ROW_H = 40
const MIN_THUMB = 32

type Kind = 'row' | 'marker' | 'decoy'

interface Metrics {
  top: number
  client: number
  total: number
}

export default function C57CustomScrollbar({ api, status }: ChallengeProps) {
  const [kinds] = useState<Kind[]>(() => {
    const rng = api.rng('layout')
    const marker = rng.int(30, 54)
    const taken = [marker]
    const decoys: number[] = []
    while (decoys.length < 3) {
      const i = rng.int(4, ROWS - 3)
      if (taken.every((t) => Math.abs(t - i) >= 5)) {
        taken.push(i)
        decoys.push(i)
      }
    }
    return Array.from({ length: ROWS }, (_, i): Kind => (i === marker ? 'marker' : decoys.includes(i) ? 'decoy' : 'row'))
  })

  const paneRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startTop: number } | null>(null)
  const [m, setM] = useState<Metrics>({ top: 0, client: 360, total: ROWS * ROW_H })
  const { fb, set } = useFeedback()

  const measure = useCallback(() => {
    const el = paneRef.current
    if (el) setM({ top: el.scrollTop, client: el.clientHeight, total: el.scrollHeight })
  }, [])

  useLayoutEffect(() => {
    const el = paneRef.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const max = Math.max(1, m.total - m.client)
  const percent = Math.round((m.top / max) * 100)
  const thumbH = Math.min(m.client, Math.max(MIN_THUMB, (m.client * m.client) / m.total))
  const travel = Math.max(1, m.client - thumbH)
  const thumbTop = (m.top / max) * travel

  const scrollTo = (v: number) => {
    const el = paneRef.current
    if (el) el.scrollTop = Math.max(0, Math.min(max, v))
  }

  const onThumbDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    drag.current = { startY: e.clientY, startTop: paneRef.current?.scrollTop ?? 0 }
  }
  const onThumbMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    scrollTo(drag.current.startTop + ((e.clientY - drag.current.startY) * max) / travel)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    api.log(`Scrollbar thumb released at ${Math.round(((paneRef.current?.scrollTop ?? 0) / max) * 100)}%`)
  }

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dir = e.clientY - rect.top < thumbTop ? -1 : 1
    scrollTo((paneRef.current?.scrollTop ?? 0) + dir * m.client * 0.9)
    api.log(`Scrollbar track clicked (${dir < 0 ? 'page up' : 'page down'})`)
  }

  const onThumbKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = paneRef.current?.scrollTop ?? 0
    const next: Record<string, number> = {
      ArrowDown: cur + ROW_H,
      ArrowUp: cur - ROW_H,
      PageDown: cur + m.client * 0.9,
      PageUp: cur - m.client * 0.9,
      Home: 0,
      End: max,
    }
    if (!(e.key in next)) return
    e.preventDefault()
    scrollTo(next[e.key])
  }

  const click = (i: number, kind: Kind) => {
    if (status === 'passed' || status === 'failed') return
    api.log(`Clicked ${kind === 'marker' ? 'MARKER' : 'MARKER?'} at row ${i + 1}`)
    if (kind === 'marker') {
      set('success', `Marker found at row ${i + 1}`)
      api.succeed(`Marker clicked at row ${i + 1}`)
    } else {
      set('error', `Decoy clicked: row ${i + 1} is MARKER?, not MARKER`)
      api.fail(`Decoy clicked at row ${i + 1}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Scroll the list with the custom scrollbar (drag its thumb, use the wheel or the arrow keys) and click the highlighted row labelled <Target>MARKER</Target>. Rows labelled <code>MARKER?</code> are decoys.
      </Task>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Scrolled</span>
        <span id={`${api.id}-percent`} data-testid={`${api.id}-percent`} data-value={percent} aria-live="off" className="font-mono text-foreground">
          {percent}%
        </span>
      </div>

      <div className="flex gap-2">
        <div
          ref={paneRef}
          id={`${api.id}-pane`}
          data-testid={`${api.id}-pane`}
          role="region"
          aria-label="Scrollable rows"
          tabIndex={0}
          onScroll={measure}
          style={{ scrollbarWidth: 'none' }}
          className="h-[360px] min-w-0 flex-1 overflow-y-scroll rounded-lg border border-border bg-background [&::-webkit-scrollbar]:hidden"
        >
          {kinds.map((kind, i) => (
            <div key={i} data-row={i + 1} className="flex items-center border-b border-border/60 px-3" style={{ height: ROW_H }}>
              {kind === 'row' ? (
                <span className="text-sm text-muted-foreground">Row {i + 1}</span>
              ) : (
                <button
                  type="button"
                  id={`${api.id}-${kind}-${i + 1}`}
                  data-testid={`${api.id}-${kind === 'marker' ? 'marker' : 'decoy'}`}
                  data-marker={kind === 'marker' ? 'true' : 'decoy'}
                  onClick={() => click(i, kind)}
                  className={cn(
                    'h-8 w-full rounded-md border px-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    kind === 'marker'
                      ? 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'border-dashed border-amber-500/60 bg-amber-500/10 text-amber-600/90 dark:text-amber-400/90',
                  )}
                >
                  {kind === 'marker' ? 'MARKER' : 'MARKER?'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          id={`${api.id}-track`}
          data-testid={`${api.id}-track`}
          onPointerDown={onTrackDown}
          className="relative h-[360px] w-4 shrink-0 touch-none select-none rounded-full bg-muted"
        >
          <div
            id={`${api.id}-thumb`}
            data-testid={`${api.id}-thumb`}
            role="scrollbar"
            tabIndex={0}
            aria-label="Custom vertical scrollbar"
            aria-controls={`${api.id}-pane`}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            onPointerDown={onThumbDown}
            onPointerMove={onThumbMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onThumbKey}
            style={{ height: thumbH, transform: `translateY(${thumbTop}px)`, touchAction: 'none' }}
            className="absolute inset-x-0 top-0 cursor-grab touch-none select-none rounded-full bg-muted-foreground/60 outline-none hover:bg-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          />
        </div>
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
