import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const DOMAINS = ['mailinator.com', 'tempmail.dev', 'spam.io', 'fake.org', 'example.com', 'trashbox.net']
const LETTERS = ['K', 'M', 'R', 'T', 'V', 'W', 'Z']
const COUNTRIES = ['Argentina', 'Brazil', 'Canada', 'Denmark', 'Egypt', 'Finland', 'Ghana', 'Japan', 'Norway', 'Portugal']

type FieldName = 'name' | 'email' | 'age' | 'country' | 'agree'
type Errors = Partial<Record<FieldName, string>>

interface Values {
  name: string
  email: string
  age: string
  country: string
  agree: boolean
}

const EMPTY: Values = { name: '', email: '', age: '', country: '', agree: false }
const ORDER: FieldName[] = ['name', 'email', 'age', 'country', 'agree']

export default function C07FormSubmission({ api, status }: ChallengeProps) {
  const [rules] = useState(() => {
    const rng = api.rng('rules')
    return { letter: rng.pick(LETTERS), blocked: rng.sample(DOMAINS, 2) }
  })
  const [values, setValues] = useState<Values>(EMPTY)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const mounted = useRef(true)
  const { fb, set } = useFeedback()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const validate = (v: Values): Errors => {
    const e: Errors = {}
    const name = v.name.trim()
    if (name.length < 3) e.name = 'Name must be at least 3 characters.'
    else if (!/^[A-Za-z ]+$/.test(name)) e.name = 'Name may contain only letters and spaces.'
    else if (name[0].toUpperCase() !== rules.letter) e.name = `Name must start with the letter ${rules.letter}.`

    const email = v.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Enter a valid email address.'
    else if (rules.blocked.includes(email.slice(email.lastIndexOf('@') + 1).toLowerCase())) e.email = 'This email domain is blocked.'

    const age = v.age.trim()
    if (!/^\d+$/.test(age)) e.age = 'Age must be a whole number.'
    else if (Number(age) < 18 || Number(age) > 99) e.age = 'Age must be between 18 and 99.'

    if (!v.country) e.country = 'Choose a country.'
    if (!v.agree) e.agree = 'You must accept the agreement.'
    return e
  }

  const errors = validate(values)
  const shown: Errors = attempted ? errors : {}
  const update = <K extends FieldName>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (done || submitting || status === 'passed') return
    setAttempted(true)
    const invalid = ORDER.filter((f) => errors[f])
    api.log(`Form submit attempt (${invalid.length} invalid field${invalid.length === 1 ? '' : 's'})`)
    if (invalid.length > 0) {
      set('error', `Fix ${invalid.length} field${invalid.length === 1 ? '' : 's'}: ${invalid.join(', ')}`)
      api.fail(`Invalid fields: ${invalid.join(', ')}`)
      document.getElementById(`${api.id}-${invalid[0]}`)?.focus()
      return
    }
    setSubmitting(true)
    set('info', 'Submitting…')
    await api.request(() => true, 'submit form')
    if (!mounted.current) return
    setSubmitting(false)
    setDone(true)
    set('success', 'Form submitted')
    api.succeed('All fields valid')
  }

  const locked = done || submitting
  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive'
  const logBlur = (label: string) => api.log(`Edited ${label}`)

  return (
    <div className="grid gap-4">
      <Task>
        Complete the form following the rules below, then submit. The name must start with the letter <Target>{rules.letter}</Target>. Email addresses on{' '}
        <Target>{rules.blocked[0]}</Target> or <Target>{rules.blocked[1]}</Target> are blocked.
      </Task>
      <ul className="max-w-xl list-disc space-y-0.5 pl-5 text-xs text-muted-foreground" data-testid={`${api.id}-rules`}>
        <li>Name: at least 3 characters, letters and spaces only, starting with {rules.letter}.</li>
        <li>Email: valid format, not on {rules.blocked.join(' or ')}.</li>
        <li>Age: whole number from 18 to 99.</li>
        <li>Country: must be chosen from the list.</li>
        <li>Agreement: must be checked.</li>
      </ul>
      <form id={`${api.id}-form`} onSubmit={submit} noValidate className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${api.id}-name`} error={shown.name}>
          <Input
            id={`${api.id}-name`}
            data-testid={`${api.id}-name`}
            name="name"
            autoComplete="off"
            value={values.name}
            readOnly={locked}
            aria-invalid={!!shown.name}
            onChange={(e) => update('name', e.target.value)}
            onBlur={() => values.name && logBlur('name')}
          />
        </Field>
        <Field label="Email" htmlFor={`${api.id}-email`} error={shown.email}>
          <Input
            id={`${api.id}-email`}
            data-testid={`${api.id}-email`}
            name="email"
            type="text"
            inputMode="email"
            autoComplete="off"
            value={values.email}
            readOnly={locked}
            aria-invalid={!!shown.email}
            onChange={(e) => update('email', e.target.value)}
            onBlur={() => values.email && logBlur('email')}
          />
        </Field>
        <Field label="Age" htmlFor={`${api.id}-age`} error={shown.age}>
          <Input
            id={`${api.id}-age`}
            data-testid={`${api.id}-age`}
            name="age"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.age}
            readOnly={locked}
            aria-invalid={!!shown.age}
            onChange={(e) => update('age', e.target.value)}
            onBlur={() => values.age && logBlur('age')}
          />
        </Field>
        <Field label="Country" htmlFor={`${api.id}-country`} error={shown.country}>
          <select
            id={`${api.id}-country`}
            data-testid={`${api.id}-country`}
            name="country"
            value={values.country}
            disabled={locked}
            aria-invalid={!!shown.country}
            onChange={(e) => {
              update('country', e.target.value)
              api.log(`Country set to ${e.target.value || 'placeholder'}`)
            }}
            className={selectClass}
          >
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor={`${api.id}-agree`} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              id={`${api.id}-agree`}
              data-testid={`${api.id}-agree`}
              name="agree"
              type="checkbox"
              checked={values.agree}
              disabled={locked}
              aria-invalid={!!shown.agree}
              onChange={(e) => {
                update('agree', e.target.checked)
                api.log(`Agreement ${e.target.checked ? 'checked' : 'unchecked'}`)
              }}
              className="size-4 accent-primary"
            />
            I accept the terms and conditions
          </label>
          {shown.agree && (
            <p role="alert" className="text-xs text-red-500">
              {shown.agree}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="submit" disabled={locked}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
