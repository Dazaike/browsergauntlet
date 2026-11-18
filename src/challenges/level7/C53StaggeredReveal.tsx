import { useEffect, useRef, useState } from 'react'
import { Feedback, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

const COUNT = 5
const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']

export default function C53StaggeredReveal({ api, status }: ChallengeProps) {
  // slotOf[k] = slot that receives the k-th button to appear; delays[k] = wait before it appears.
  const [plan] = useState(() => {
    const layout = api.rng('layout')
    const names = layout.shuffle(NAMES)
    const slotOf = layout.shuffle([0, 1, 2, 3, 4])
    const r = api.rng('delays')
    return { names, slotOf, delays: Array.from({ length: COUNT }, () => r.int(600, 1800)) }
  })
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(0)
  const doneRef = useRef(0)
  const { fb, set } = useFeedback({ type: 'info', text: 'Waiting for the first button…' })
  const locked = status === 'passed' || status === 'failed'

  useEffect(() => {
    if (shown >= COUNT) return
    const t = setTimeout(() => {
      setShown(shown + 1)
      api.log(`Button ${plan.names[plan.slotOf[shown]]} appeared in slot ${plan.slotOf[shown] + 1}`, 'system')
    }, api.delay(plan.delays[shown]))
    return () => clearTimeout(t)
  }, [shown, api, plan])

  // order[slot] = appearance order (0-based) of the button living in that slot
  const orderOfSlot = plan.slotOf.reduce<number[]>((acc, slot, k) => {
    acc[slot] = k
    return acc
  }, [])

  const onClick = (order: number, name: string) => {
    if (locked) return
    api.log(`Clicked ${name} (badge ${order + 1})`)
    if (order === doneRef.current) {
      doneRef.current += 1
      setDone(doneRef.current)
      if (doneRef.current === COUNT) {
        set('success', `All ${COUNT} clicked in order`)
        api.succeed('clicked in appearance order')
      } else {
        set('info', `Correct: ${doneRef.current} of ${COUNT}`)
      }
    } else {
      const expected = doneRef.current + 1
      doneRef.current = 0
      setDone(0)
      set('error', `Out of order: ${name} was number ${order + 1}, expected number ${expected}. Start again from number 1.`)
      api.fail(`clicked ${name} (#${order + 1}) while expecting #${expected}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Five buttons appear one at a time in the slots below. Click them in the order they appeared. A wrong click resets your progress.
      </Task>
      <p className="text-sm text-muted-foreground">
        Appeared: <strong id="c53-shown" data-testid="c53-shown" className="text-foreground">{shown}</strong> / {COUNT} · Clicked in order: <strong id="c53-done" data-testid="c53-done" className="text-foreground">{done}</strong>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: COUNT }, (_, slot) => {
          const order = orderOfSlot[slot]
          const visible = order < shown
          const name = plan.names[slot]
          const clicked = visible && order < done
          return (
            <div key={slot} id={`c53-slot-${slot + 1}`} data-testid={`c53-slot-${slot + 1}`} className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Slot {slot + 1}</span>
              <div className="flex h-12 items-center rounded-md border border-dashed border-border/70 p-1">
                {visible && (
                  <button
                    type="button"
                    id={`c53-btn-${name.toLowerCase()}`}
                    data-testid={`c53-btn-${name.toLowerCase()}`}
                    data-order={order + 1}
                    disabled={clicked || locked}
                    onClick={() => onClick(order, name)}
                    className={cn(
                      'flex h-full w-full items-center justify-between gap-2 rounded-sm bg-primary px-2.5 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none',
                      clicked && 'bg-emerald-600 opacity-60',
                    )}
                  >
                    {name}
                    <span
                      data-testid={`c53-badge-${name.toLowerCase()}`}
                      aria-label={`Order ${order + 1}`}
                      className="flex size-5 items-center justify-center rounded-full bg-background/90 text-xs text-foreground"
                    >
                      {order + 1}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Feedback state={fb} id="c53-feedback" />
    </div>
  )
}
