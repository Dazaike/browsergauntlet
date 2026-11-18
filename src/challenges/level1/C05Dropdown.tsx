import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

export default function C05Dropdown({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => {
    const rng = api.rng('options')
    const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
    const options = rng.phrase(30).split(' ').map(cap).sort()
    return { options, target: rng.pick(options) }
  })
  const [loaded, setLoaded] = useState(!api.settings.dynamic)
  const [value, setValue] = useState('')
  const [done, setDone] = useState(false)
  const { fb, set } = useFeedback()

  // Stress mode: the option list arrives late.
  useEffect(() => {
    if (loaded) return
    const t = setTimeout(() => setLoaded(true), api.delay(700))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = () => {
    if (done || status === 'passed') return
    api.log(`Submitted dropdown value: ${value || 'placeholder'}`)
    if (!value) {
      set('error', 'No option chosen (placeholder still selected)')
      api.fail('Placeholder selected')
    } else if (value === puzzle.target) {
      setDone(true)
      set('success', `Option accepted: ${value}`)
      api.succeed(value)
    } else {
      set('error', `Wrong option: ${value}`)
      api.fail(`Selected "${value}"`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Open the dropdown, choose <Target>{puzzle.target}</Target> and submit.
      </Task>
      <div className="grid max-w-md gap-3">
        <Field label="Project" htmlFor={`${api.id}-select`}>
          <select
            id={`${api.id}-select`}
            data-testid={`${api.id}-select`}
            name="project"
            value={value}
            disabled={done || !loaded}
            onChange={(e) => {
              setValue(e.target.value)
              api.log(`Dropdown changed to ${e.target.value || 'placeholder'}`)
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">{loaded ? 'Select a project…' : 'Loading…'}</option>
            {loaded &&
              puzzle.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
          </select>
        </Field>
        <p id={`${api.id}-current`} className="text-xs text-muted-foreground">
          Current: {value || 'none'}
        </p>
        <div>
          <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="button" disabled={done} onClick={submit}>
            Submit
          </Button>
        </div>
      </div>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
