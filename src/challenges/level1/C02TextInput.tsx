import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

export default function C02TextInput({ api, status }: ChallengeProps) {
  const [target] = useState(() => {
    const rng = api.rng('target')
    const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
    return `${cap(rng.word())}_${rng.digits(3)} ${rng.word()}!`
  })
  const [value, setValue] = useState('')
  const [done, setDone] = useState(false)
  const { fb, set } = useFeedback()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (done || status === 'passed') return
    api.log(`Submitted text (${value.length} chars)`)
    if (value === target) {
      setDone(true)
      set('success', 'Value accepted')
      api.succeed('Exact match')
    } else if (value === '') {
      set('error', 'Nothing entered')
      api.fail('Empty submission')
    } else {
      set('error', 'Value does not match the target')
      api.fail(`Submitted "${value}"`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Type this exact string (case-sensitive, no extra whitespace) and submit: <Target>{target}</Target>
      </Task>
      <form onSubmit={submit} noValidate className="grid max-w-md gap-3">
        <Field label="Text" htmlFor={`${api.id}-input`}>
          <Input
            id={`${api.id}-input`}
            data-testid={`${api.id}-input`}
            name="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => value && api.log(`Typed ${value.length} chars`)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={done}
            data-value={value}
          />
        </Field>
        <div>
          <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="submit" disabled={done}>
            Submit
          </Button>
        </div>
      </form>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
