import { useEffect, useRef, useState } from 'react'
import { Package } from 'lucide-react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const ZONE_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']

interface DragState {
  pointerId: number
  dx: number
  dy: number
  w: number
  h: number
}

export default function C10DragDrop({ api }: ChallengeProps) {
  const [{ zones: initialZones, target }] = useState(() => {
    const r = api.rng('zones')
    const zones = r.sample(ZONE_NAMES, 3)
    return { zones, target: r.pick(zones) }
  })
  const [zones, setZones] = useState(initialZones)
  const [placedIn, setPlacedIn] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const { fb, set } = useFeedback()
  const drag = useRef<DragState | null>(null)
  const zoneRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Stress mode: the zones are re-ordered once, but never in the middle of a drag.
  useEffect(() => {
    if (!api.settings.dynamic) return
    let t = 0
    const reorder = () => {
      if (drag.current) {
        t = window.setTimeout(reorder, 300)
        return
      }
      setZones((z) => [...z].reverse())
    }
    t = window.setTimeout(reorder, api.delay(900))
    return () => window.clearTimeout(t)
  }, [api])

  const zoneAt = (x: number, y: number): string | null => {
    for (const name of zones) {
      const r = zoneRefs.current[name]?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name
    }
    return null
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = { pointerId: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height }
    e.currentTarget.setPointerCapture(e.pointerId)
    setGhost({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
    set('info', 'Dragging…')
    api.log('Drag started: Package')
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    setGhost({ x: e.clientX - d.dx, y: e.clientY - d.dy, w: d.w, h: d.h })
    setHover(zoneAt(e.clientX, e.clientY))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    setGhost(null)
    setHover(null)
    const zone = zoneAt(e.clientX, e.clientY)
    if (!zone) {
      set('info', 'Dropped outside every zone. The object snapped back.')
      api.log('Dropped outside any zone')
    } else if (zone === target) {
      setPlacedIn(zone)
      set('success', `Dropped into ${zone}`)
      api.log(`Dropped into zone ${zone}`)
      api.succeed(`dropped in ${zone}`)
    } else {
      set('error', `Wrong zone: ${zone}`)
      api.log(`Dropped into zone ${zone}`)
      api.fail(`dropped in ${zone}, expected ${target}`)
    }
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    setGhost(null)
    setHover(null)
    set('info', 'Drag cancelled')
    api.log('Drag cancelled')
  }

  const dragging = ghost !== null

  const objectEl = (
    <div
      id={`${api.id}-object`}
      data-testid={`${api.id}-object`}
      role="button"
      aria-label="Draggable package"
      aria-grabbed={dragging}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        'flex h-16 w-32 cursor-grab touch-none select-none items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        dragging && 'opacity-30',
      )}
    >
      <Package className="size-4" aria-hidden /> Package
    </div>
  )

  return (
    <div className="grid gap-5">
      <Task>
        Drag the package into the zone labelled <Target>{target}</Target> and release it there.
      </Task>

      <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4">
        {placedIn ? <span className="text-sm text-muted-foreground">Package delivered</span> : objectEl}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {zones.map((name) => (
          <div
            key={name}
            ref={(el) => {
              zoneRefs.current[name] = el
            }}
            id={`${api.id}-zone-${name.toLowerCase()}`}
            data-testid={`${api.id}-zone-${name.toLowerCase()}`}
            data-zone={name}
            data-hover={hover === name}
            role="group"
            aria-label={`Drop zone ${name}`}
            className={cn(
              'flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm transition-colors',
              hover === name && 'border-primary bg-primary/10',
              placedIn === name && 'border-emerald-500 bg-emerald-500/10',
            )}
          >
            <span className="font-medium">{name}</span>
            {placedIn === name && (
              <span className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
                <Package className="size-3" aria-hidden /> Package
              </span>
            )}
          </div>
        ))}
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />

      {ghost && (
        <div
          aria-hidden
          data-testid={`${api.id}-ghost`}
          className="pointer-events-none fixed left-0 top-0 z-50 flex items-center justify-center gap-2 rounded-lg border border-primary bg-background text-sm font-medium shadow-lg"
          style={{ width: ghost.w, height: ghost.h, transform: `translate(${ghost.x}px, ${ghost.y}px)` }}
        >
          <Package className="size-4" aria-hidden /> Package
        </div>
      )}
    </div>
  )
}
