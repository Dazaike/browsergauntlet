import { useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const MIN_WIDTH = 80
const START_WIDTH = 120
const TOLERANCE = 6

interface DragState {
  pointerId: number
  startX: number
  startWidth: number
}

export default function C15Resize({ api, status }: ChallengeProps) {
  const [target] = useState(() => api.rng('target').int(160, 260))
  const [width, setWidth] = useState(START_WIDTH)
  const [dragging, setDragging] = useState(false)
  const { fb, set } = useFeedback()
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const widthRef = useRef(START_WIDTH)

  const maxWidth = () => Math.floor(containerRef.current?.clientWidth ?? 600)

  const apply = (w: number) => {
    const next = Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, w)))
    widthRef.current = next
    setWidth(next)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: widthRef.current }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    api.log('Resize started')
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    apply(d.startWidth + (e.clientX - d.startX))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    if (e.type === 'pointerup') apply(d.startWidth + (e.clientX - d.startX))
    drag.current = null
    setDragging(false)
    api.log(`Panel resized to ${widthRef.current}px`)
  }

  const submit = () => {
    if (status === 'passed') return
    const w = widthRef.current
    api.log(`Submit width pressed: ${w}px`)
    if (Math.abs(w - target) <= TOLERANCE) {
      set('success', `Width ${w}px accepted`)
      api.succeed(`width ${w}px`)
    } else {
      set('error', `Width ${w}px is outside ${target}px ±${TOLERANCE}`)
      api.fail(`submitted ${w}px, expected ${target}px ±${TOLERANCE}`)
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Drag the handle on the panel's right edge until the panel is <Target>{target}px</Target> wide (±{TOLERANCE}px), then press Submit width.
      </Task>

      <div ref={containerRef} id={`${api.id}-container`} data-testid={`${api.id}-container`} className="overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 p-0">
        <div
          id={`${api.id}-panel`}
          data-testid={`${api.id}-panel`}
          data-width={width}
          aria-label="Resizable panel"
          role="group"
          className="relative flex h-40 flex-col justify-between border-r border-border bg-background p-3"
          style={{ width }}
        >
          <span className="truncate text-sm font-medium">Panel</span>
          <span className="truncate text-xs text-muted-foreground">Drag the right edge</span>
          <div
            id={`${api.id}-handle`}
            data-testid={`${api.id}-handle`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize handle"
            aria-valuenow={width}
            aria-valuemin={MIN_WIDTH}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
              'absolute inset-y-0 right-0 flex w-3 cursor-col-resize touch-none select-none items-center justify-center bg-muted transition-colors hover:bg-primary/20',
              dragging && 'bg-primary/30',
            )}
          >
            <GripVertical className="size-3 text-muted-foreground" aria-hidden />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <output id={`${api.id}-width`} data-testid={`${api.id}-width`} data-width={width} className="font-mono text-sm tabular-nums">
          Width: {width}px
        </output>
        <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} onClick={submit}>Submit width</Button>
        <Feedback state={fb} id={`${api.id}-feedback`} />
      </div>
    </div>
  )
}
