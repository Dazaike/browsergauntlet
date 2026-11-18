import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const CRITERIA: { text: string; test: (w: string) => boolean }[] = [
  { text: 'start with a vowel (a, e, i, o, u)', test: (w) => /^[aeiou]/.test(w) },
  { text: 'contain the letter "r"', test: (w) => w.includes('r') },
  { text: 'have 6 or more letters', test: (w) => w.length >= 6 },
  { text: 'end with the letter "e" or "t"', test: (w) => /[et]$/.test(w) },
  { text: 'contain the letter "o"', test: (w) => w.includes('o') },
]

export default function C03Checkboxes({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => {
    for (let k = 0; ; k++) {
      const rng = api.rng(`items-${k}`)
      const criterion = rng.pick(CRITERIA)
      const items = rng.phrase(10).split(' ')
      const matches = items.filter(criterion.test)
      if (matches.length >= 3 && matches.length <= 6) return { criterion, items, matches: new Set(matches) }
    }
  })
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [done, setDone] = useState(false)
  const { fb, set } = useFeedback()

  const toggle = (word: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(word)
      else next.delete(word)
      return next
    })
    api.log(`${on ? 'Checked' : 'Unchecked'} "${word}"`)
  }

  const submit = () => {
    if (done || status === 'passed') return
    const missed = puzzle.items.filter((w) => puzzle.matches.has(w) && !checked.has(w))
    const extra = puzzle.items.filter((w) => !puzzle.matches.has(w) && checked.has(w))
    api.log(`Submitted ${checked.size} checked`)
    if (missed.length === 0 && extra.length === 0) {
      setDone(true)
      set('success', 'Selection accepted')
      api.succeed(`${checked.size} correct`)
    } else {
      set('error', `Selection incorrect: ${missed.length} missed, ${extra.length} wrongly checked`)
      api.fail(`Missed ${missed.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Check every word that does <Target>{puzzle.criterion.text}</Target>. Leave all other boxes unchecked, then submit.
      </Task>
      <fieldset className="grid max-w-md gap-1 rounded-lg border border-border p-3" disabled={done}>
        <legend className="px-1 text-xs text-muted-foreground">Words</legend>
        {puzzle.items.map((w) => (
          <div key={w} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
            <Checkbox
              id={`${api.id}-check-${w}`}
              data-testid={`${api.id}-check-${w}`}
              checked={checked.has(w)}
              onCheckedChange={(v) => toggle(w, v === true)}
            />
            <label htmlFor={`${api.id}-check-${w}`} className="flex-1 cursor-pointer text-sm">
              {w}
            </label>
          </div>
        ))}
      </fieldset>
      <p id={`${api.id}-count`} className="text-xs text-muted-foreground" data-testid={`${api.id}-count`}>
        Checked: {checked.size}
      </p>
      <div>
        <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="button" disabled={done} onClick={submit}>
          Submit
        </Button>
      </div>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
