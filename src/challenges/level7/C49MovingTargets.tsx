import { useEffect, useRef, useState } from 'react'
import { Feedback, Task, Target, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

const SLOTS = [
  { left: 4, top: 10 },
  { left: 38, top: 10 },
  { left: 70, top: 10 },
  { left: 4, top: 62 },
  { left: 38, top: 62 },
  { left: 70, top: 62 },
]
const NEEDED = 3
const MAX_MISSES = 3

export default function C49MovingTargets({ api, status }: ChallengeProps) {
  const [order] = useState(() => api.rng('order').shuffle([0, 1, 2, 3, 4, 5]))
  const [step, setStep] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const hitsRef = useRef(0)
  const missesRef = useRef(0)
  const { fb, set } = useFeedback()
  const finished = status === 'passed' || status === 'failed' || hits >= NEEDED
  const slot = order[step % order.length]
  const interval = api.delay(api.settings.dynamic ? 1100 : 1500)

  // The button also jumps on its own after every interval.
  useEffect(() => {
    if (finished) return
    const t = setTimeout(() => setStep((s) => s + 1), interval)
    return () => clearTimeout(t)
  }, [step, finished, interval])

  // A real click is resolved on pointerdown, so a timed jump between pointerdown and pointerup can
  // neither turn a hit into a miss nor a miss into a hit. Click events with detail 0 (keyboard
  // activation, element.click(), dispatchEvent) are handled separately; real clicks (detail > 0)
  // are ignored because their pointerdown already counted.
  const isPrimary = (e: React.PointerEvent) => !(e.pointerType === 'mouse' && e.button !== 0)

  const hit = () => {
    if (finished) return
    hitsRef.current += 1
    setHits(hitsRef.current)
    api.log(`Hit ${hitsRef.current}/${NEEDED} at slot ${slot + 1}`)
    if (hitsRef.current >= NEEDED) {
      set('success', `Hit ${hitsRef.current} of ${NEEDED}`)
      api.succeed(`${NEEDED} hits, ${missesRef.current} misses`)
      return
    }
    set('info', `Hit ${hitsRef.current} of ${NEEDED}. The button moved.`)
    setStep((s) => s + 1)
  }

  const miss = () => {
    if (finished) return
    missesRef.current += 1
    api.log(`Missed (arena click ${missesRef.current}/${MAX_MISSES})`)
    if (missesRef.current >= MAX_MISSES) {
      missesRef.current = 0
      setMisses(0)
      set('error', 'Three misses')
      api.fail('three misses')
      return
    }
    setMisses(missesRef.current)
    set('error', `Miss ${missesRef.current} of ${MAX_MISSES}`)
  }

  const onTargetPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (isPrimary(e)) hit()
  }
  const onTargetClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.detail === 0) hit()
  }
  const onArenaPointerDown = (e: React.PointerEvent) => {
    if (isPrimary(e)) miss()
  }
  const onArenaClick = (e: React.MouseEvent) => {
    if (e.detail === 0) miss()
  }

  return (
    <div className="grid gap-4">
      <Task>
        Click the <Target>Catch me</Target> button <strong>{NEEDED}</strong> times. It jumps to another position every interval and right after each hit. Clicking the arena without hitting the button counts as a miss.
      </Task>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Hits: <strong id="c49-hits" data-testid="c49-hits" data-value={hits}>{hits}</strong> / {NEEDED}</span>
        <span>Misses: <strong id="c49-misses" data-testid="c49-misses" data-value={misses}>{misses}</strong> / {MAX_MISSES}</span>
      </div>
      <div
        id="c49-arena"
        data-testid="c49-arena"
        onPointerDown={onArenaPointerDown}
        onClick={onArenaClick}
        className="relative h-[260px] w-full max-w-[520px] touch-none select-none overflow-hidden rounded-lg border border-border bg-muted/30"
      >
        {SLOTS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute h-9 w-20 rounded-md border border-dashed border-border/60"
            style={{ left: `${s.left}%`, top: `${s.top}%` }}
          />
        ))}
        <button
          type="button"
          id="c49-target"
          data-testid="c49-target"
          data-slot={slot}
          onPointerDown={onTargetPointerDown}
          onClick={onTargetClick}
          disabled={finished}
          className={cn(
            'absolute h-9 w-20 rounded-md bg-primary text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            finished && 'opacity-50',
          )}
          style={{ left: `${SLOTS[slot].left}%`, top: `${SLOTS[slot].top}%` }}
        >
          Catch me
        </button>
      </div>
      <Feedback state={fb} id="c49-feedback" />
    </div>
  )
}
