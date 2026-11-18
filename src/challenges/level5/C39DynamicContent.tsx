import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const BUTTON_IDS = ['a', 'b', 'c']
const LABELS = ['Mutate', 'Shuffle', 'Refresh']
const STEPS = 10

export default function C39DynamicContent({ api }: ChallengeProps) {
  const spec = useMemo(() => {
    const r = api.rng('machine')
    const seen = new Set<string>()
    const codes: string[] = []
    while (codes.length < STEPS) {
      const code = `${r.string(1, 'ABCDEFGHJKMNPQRSTUVWXYZ')}${r.digits(1)}-${r.digits(2)}`
      if (seen.has(code)) continue
      seen.add(code)
      codes.push(code)
    }
    const layouts = Array.from({ length: 6 }, () => ({ order: r.shuffle(BUTTON_IDS), labels: r.shuffle(LABELS) }))
    return { codes, target: codes[r.int(3, 7)], layouts }
  }, [api])

  const [clicks, setClicks] = useState(0)
  const { fb, set } = useFeedback()
  const value = spec.codes[clicks % STEPS]
  const layout = spec.layouts[clicks % spec.layouts.length]

  const mutate = (btn: string, label: string) => {
    const next = clicks + 1
    api.log(`Clicked "${label}" (button ${btn}); value is now ${spec.codes[next % STEPS]}`)
    setClicks(next)
    set('info', `Value changed to ${spec.codes[next % STEPS]}.`)
  }

  const confirm = () => {
    api.log(`Confirm pressed with value ${value}`)
    if (value === spec.target) {
      set('success', `Confirmed ${value}.`)
      api.succeed(`Confirmed ${value}`)
    } else {
      set('error', `Wrong state: ${value}`)
      api.fail(`Confirmed ${value}, expected ${spec.target}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Click the mutator buttons until the display shows <Target>{spec.target}</Target>, then press <b>Confirm</b>. Every button advances the value by one step (after the last value it wraps to the first), but the buttons are relabelled and reordered after each click.
      </Task>
      <section aria-label="Mutator" id="c39-card" data-testid="c39-card" data-clicks={clicks} className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Current value</span>
          <output id="c39-display" data-testid="c39-display" data-value={value} aria-live="polite" className="font-mono text-3xl font-medium tracking-tight">
            {value}
          </output>
        </div>
        <div className="flex flex-wrap gap-2">
          {layout.order.map((btn, pos) => (
            <Button key={btn} id={`c39-btn-${btn}`} data-testid={`c39-btn-${btn}`} variant="outline" onClick={() => mutate(btn, layout.labels[pos])}>
              {layout.labels[pos]}
            </Button>
          ))}
        </div>
      </section>
      <div>
        <Button id="c39-confirm" data-testid="c39-confirm" onClick={confirm}>
          Confirm
        </Button>
      </div>
      <Feedback state={fb} id="c39-feedback" />
    </div>
  )
}
