import { useState } from 'react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const LABELS = ['Amber', 'Birch', 'Cobalt', 'Delta', 'Ember', 'Falcon', 'Garnet', 'Harbor', 'Indigo', 'Jasper', 'Kestrel', 'Lagoon']

export default function C12DoubleClick({ api, status }: ChallengeProps) {
  const [{ tiles, target }] = useState(() => {
    const r = api.rng('tiles')
    const tiles = r.sample(LABELS, 6)
    return { tiles, target: r.pick(tiles) }
  })
  const [clicks, setClicks] = useState<Record<string, number>>({})
  const [doubles, setDoubles] = useState<Record<string, number>>({})
  const { fb, set } = useFeedback()

  const bump = (setter: typeof setClicks, name: string) => setter((m) => ({ ...m, [name]: (m[name] ?? 0) + 1 }))

  const onDouble = (name: string) => {
    if (status === 'passed') return
    bump(setDoubles, name)
    api.log(`Double-click on ${name}`)
    if (name === target) {
      set('success', `Double-clicked ${name}`)
      api.succeed(`double-clicked ${name}`)
    } else {
      set('error', `Wrong tile: ${name}`)
      api.fail(`double-clicked ${name}, expected ${target}`)
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Double-click the tile labelled <Target>{target}</Target>.
      </Task>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Tiles">
        {tiles.map((name) => {
          const key = name.toLowerCase()
          const d = doubles[name] ?? 0
          return (
            <button
              key={name}
              type="button"
              id={`${api.id}-tile-${key}`}
              data-testid={`${api.id}-tile-${key}`}
              data-tile={name}
              data-clicks={clicks[name] ?? 0}
              data-doubles={d}
              onClick={() => bump(setClicks, name)}
              onDoubleClick={() => onDouble(name)}
              className={cn(
                'flex h-24 select-none flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                d > 0 && 'border-primary bg-primary/10',
              )}
            >
              <span className="text-base font-medium">{name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                clicks {clicks[name] ?? 0} · double {d}
              </span>
            </button>
          )
        })}
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
