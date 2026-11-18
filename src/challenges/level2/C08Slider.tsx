import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const MIN = 0
const MAX = 100

export default function C08Slider({ api, status }: ChallengeProps) {
  const [{ target, start }] = useState(() => {
    const r = api.rng('target')
    const target = r.int(5, 95)
    let start = r.int(5, 95)
    while (Math.abs(start - target) < 15) start = r.int(5, 95)
    return { target, start }
  })
  const [value, setValue] = useState(start)
  const { fb, set } = useFeedback()
  const trackRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const valueRef = useRef(start)

  const update = (v: number) => {
    const next = Math.min(MAX, Math.max(MIN, Math.round(v)))
    valueRef.current = next
    setValue(next)
    return next
  }

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return valueRef.current
    return update(MIN + ((clientX - rect.left) / rect.width) * (MAX - MIN))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragging.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    sliderRef.current?.focus()
    fromPointer(e.clientX)
    api.log('Slider drag started')
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== e.pointerId) return
    fromPointer(e.clientX)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== e.pointerId) return
    dragging.current = null
    if (e.type === 'pointerup') fromPointer(e.clientX)
    api.log(`Slider moved to ${valueRef.current}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'PageDown' ? -10 : e.key === 'PageUp' ? 10 : 0
    if (step !== 0) update(valueRef.current + step)
    else if (e.key === 'Home') update(MIN)
    else if (e.key === 'End') update(MAX)
    else return
    e.preventDefault()
    api.log(`Slider moved to ${valueRef.current}`)
  }

  const confirm = () => {
    if (status === 'passed') return
    api.log(`Confirm pressed with value ${value}`)
    if (value === target) {
      set('success', `Value ${value} accepted`)
      api.succeed(`value ${value}`)
    } else {
      set('error', `Value ${value} is not the target`)
      api.fail(`confirmed ${value}, expected ${target}`)
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Set the slider to exactly <Target>{target}</Target> and press Confirm.
      </Task>

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <label id={`${api.id}-label`} className="text-sm font-medium">Value</label>
          <output id={`${api.id}-value`} data-testid={`${api.id}-value`} data-value={value} htmlFor={`${api.id}-slider`} className="font-mono text-2xl tabular-nums">
            {value}
          </output>
        </div>

        <div
          className="relative h-10 cursor-pointer touch-none select-none px-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div ref={trackRef} className="absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${value}%` }} />
            <div
              ref={sliderRef}
              id={`${api.id}-slider`}
              data-testid={`${api.id}-slider`}
              role="slider"
              tabIndex={0}
              aria-labelledby={`${api.id}-label`}
              aria-valuemin={MIN}
              aria-valuemax={MAX}
              aria-valuenow={value}
              aria-valuetext={String(value)}
              aria-orientation="horizontal"
              onKeyDown={onKeyDown}
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              style={{ left: `${value}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between px-3 text-xs text-muted-foreground tabular-nums" aria-hidden>
          <span>{MIN}</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>{MAX}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button id={`${api.id}-confirm`} data-testid={`${api.id}-confirm`} onClick={confirm}>Confirm</Button>
        <Feedback state={fb} id={`${api.id}-feedback`} />
      </div>
    </div>
  )
}
