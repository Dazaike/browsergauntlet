import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

interface Choice {
  key: string
  label: string
}

export default function C01ButtonClick({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => {
    const rng = api.rng('buttons')
    const w = rng.word().replace(/^./, (c) => c.toUpperCase())
    const all: Choice[] = [
      { key: 'plain', label: w },
      { key: 'num', label: `${w} 2` },
      { key: 'dash', label: `${w}-` },
      { key: 'lower', label: w.toLowerCase() },
      { key: 'upper', label: w.toUpperCase() },
      { key: 'dot', label: `${w}.` },
      { key: 'under', label: `${w}_` },
      { key: 'colon', label: `${w}:` },
    ]
    const choices = all.slice(0, rng.int(6, 8))
    return { target: rng.pick(choices), choices: rng.shuffle(choices) }
  })
  const [order, setOrder] = useState<Choice[]>(puzzle.choices)
  const [done, setDone] = useState(false)
  const pressed = useRef(false)
  const { fb, set } = useFeedback()

  // Stress mode: reshuffle once shortly after mount, never mid-press.
  useEffect(() => {
    if (!api.settings.dynamic) return
    let t: number | undefined
    const reshuffle = () => {
      if (pressed.current) {
        t = window.setTimeout(reshuffle, 250)
        return
      }
      setOrder((o) => api.rng('reshuffle').shuffle(o))
    }
    t = window.setTimeout(reshuffle, api.delay(900))
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const click = (c: Choice) => {
    if (done || status === 'passed') return
    api.log(`Clicked button "${c.label}"`)
    if (c.key === puzzle.target.key) {
      setDone(true)
      set('success', `Correct button: ${c.label}`)
      api.succeed(`Clicked "${c.label}"`)
    } else {
      set('error', `Wrong button: ${c.label}`)
      api.fail(`Clicked "${c.label}" instead of "${puzzle.target.label}"`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Click the button labelled <Target>{puzzle.target.label}</Target> exactly. Similar labels differ in case, spacing or punctuation.
      </Task>
      <div
        role="group"
        aria-label="Choices"
        data-testid={`${api.id}-choices`}
        className="flex flex-wrap gap-3"
        onPointerDown={() => (pressed.current = true)}
        onPointerUp={() => (pressed.current = false)}
        onPointerCancel={() => (pressed.current = false)}
        onPointerLeave={() => (pressed.current = false)}
      >
        {order.map((c) => (
          <Button
            key={c.key}
            id={`${api.id}-btn-${c.key}`}
            data-testid={`${api.id}-btn-${c.key}`}
            type="button"
            variant="outline"
            disabled={done}
            onClick={() => click(c)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
