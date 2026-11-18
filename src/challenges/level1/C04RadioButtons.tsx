import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

interface Plan {
  name: string
  billing: string
  seats: number
}

const NAMES = ['Starter', 'Standard', 'Studio', 'Startup', 'Scale', 'Select']
const BILLING = ['monthly', 'quarterly', 'annually']

const describe = (p: Plan) => `${p.name} plan, billed ${p.billing}, ${p.seats} seats`

export default function C04RadioButtons({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => {
    const rng = api.rng('plans')
    const [n1, n2, n3] = rng.sample(NAMES, 3)
    const [b1, b2, b3] = rng.sample(BILLING, 3)
    const s = rng.int(2, 9)
    const target: Plan = { name: n1, billing: b1, seats: s }
    const variants: Plan[] = [
      target,
      { ...target, name: n2 },
      { ...target, billing: b2 },
      { ...target, seats: s + 1 },
      { ...target, seats: s + 10 },
      { name: n2, billing: b1, seats: s + 1 },
      { name: n3, billing: b3, seats: s },
    ]
    const options = rng.shuffle(variants.slice(0, rng.int(6, 7)))
    return { target: describe(target), options: options.map(describe) }
  })
  const [value, setValue] = useState('')
  const [done, setDone] = useState(false)
  const { fb, set } = useFeedback()

  const choose = (v: string) => {
    setValue(v)
    api.log(`Selected radio "${v}"`)
  }

  const submit = () => {
    if (done || status === 'passed') return
    api.log(`Submitted radio selection: ${value || 'none'}`)
    if (!value) {
      set('error', 'No option selected')
      api.fail('No option selected')
    } else if (value === puzzle.target) {
      setDone(true)
      set('success', 'Correct option selected')
      api.succeed(value)
    } else {
      set('error', `Wrong option: ${value}`)
      api.fail(`Selected "${value}"`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Select the option <Target>{puzzle.target}</Target> and submit. Several options are nearly identical.
      </Task>
      <RadioGroup
        aria-label="Plans"
        id={`${api.id}-group`}
        data-testid={`${api.id}-group`}
        data-value={value}
        value={value}
        onValueChange={choose}
        disabled={done}
        className="max-w-lg gap-1 rounded-lg border border-border p-3"
      >
        {puzzle.options.map((text, i) => (
          <div key={text} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
            <RadioGroupItem id={`${api.id}-radio-${i + 1}`} data-testid={`${api.id}-radio-${i + 1}`} value={text} />
            <label htmlFor={`${api.id}-radio-${i + 1}`} className="flex-1 cursor-pointer text-sm">
              {text}
            </label>
          </div>
        ))}
      </RadioGroup>
      <div>
        <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="button" disabled={done} onClick={submit}>
          Submit
        </Button>
      </div>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
