import { useMemo, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { nativeSelect, panel, useAlive } from './shared'

const PLANS = ['Free', 'Pro', 'Team'] as const
const THEMES = ['Light', 'Dark', 'System'] as const
const STEPS = ['Account', 'Preferences', 'Review'] as const

interface Values {
  username: string
  email: string
  plan: string
  theme: string
  updates: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

function validate(step: number, v: Values): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 0) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(v.username)) e.username = 'Username must be 3-20 letters, digits or underscores.'
    if (!EMAIL_RE.test(v.email)) e.email = 'Enter a valid email address.'
  } else if (step === 1) {
    if (!v.plan) e.plan = 'Choose a plan.'
    if (!v.theme) e.theme = 'Choose a theme.'
  }
  return e
}

export default function C23MultiStepForm({ api }: ChallengeProps) {
  const alive = useAlive()
  const target = useMemo<Values>(() => {
    const r = api.rng('target')
    return {
      username: `${r.word()}_${r.digits(2)}`,
      email: `${r.word()}${r.digits(3)}@example.com`,
      plan: r.pick(PLANS),
      theme: r.pick(THEMES),
      updates: r.bool(),
    }
  }, [api])

  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Values>({ username: '', email: '', plan: '', theme: '', updates: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const patch = (p: Partial<Values>) => {
    setValues((v) => ({ ...v, ...p }))
    setErrors({})
  }

  const next = () => {
    const errs = validate(step, values)
    setErrors(errs)
    if (Object.keys(errs).length) {
      set('error', `Step ${step + 1} has ${Object.keys(errs).length} error(s). Fix them to continue.`)
      api.log(`Next blocked on step ${STEPS[step]}: ${Object.keys(errs).join(', ')}`)
      return
    }
    api.log(`Moved to step ${STEPS[step + 1]}`)
    set('info', `Step ${step + 2} of 3: ${STEPS[step + 1]}`)
    setStep(step + 1)
  }

  const back = () => {
    api.log(`Moved back to step ${STEPS[step - 1]}`)
    set('info', `Step ${step} of 3: ${STEPS[step - 1]}`)
    setErrors({})
    setStep(step - 1)
  }

  const submit = async () => {
    if (busy) return
    setBusy(true)
    api.log('Submitted review step')
    const result = await api.request(() => {
      const bad = (Object.keys(target) as (keyof Values)[]).filter((k) => values[k] !== target[k])
      return bad
    }, 'submit wizard')
    if (!alive.current) return
    setBusy(false)
    if (result.length) {
      set('error', `Wrong or missing value: ${result.join(', ')}`)
      api.fail(`Review submitted with wrong values: ${result.join(', ')}`)
    } else {
      set('success', 'All values accepted')
      api.succeed('Wizard submitted with correct values')
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Complete the 3-step wizard with username <Target>{target.username}</Target>, email <Target>{target.email}</Target>, plan{' '}
        <Target>{target.plan}</Target>, theme <Target>{target.theme}</Target>, and product updates{' '}
        <Target>{target.updates ? 'on' : 'off'}</Target>. Submit on the Review step.
      </Task>

      <ol id={`${api.id}-stepper`} data-testid={`${api.id}-stepper`} aria-label="Progress" className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            id={`${api.id}-step-${i + 1}`}
            data-testid={`${api.id}-step-${i + 1}`}
            aria-current={i === step ? 'step' : undefined}
            data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5',
              i === step ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground',
              i < step && 'text-foreground',
            )}
          >
            <span className="font-mono text-xs">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <form
        className={cn(panel, 'grid gap-4')}
        aria-label={`Step ${step + 1}: ${STEPS[step]}`}
        data-step={step + 1}
        onSubmit={(ev) => {
          ev.preventDefault()
          if (step < 2) next()
          else void submit()
        }}
        noValidate
      >
        {step === 0 && (
          <>
            <Field label="Username" htmlFor={`${api.id}-username`} error={errors.username} hint="3-20 letters, digits or underscores">
              <Input
                id={`${api.id}-username`}
                data-testid={`${api.id}-username`}
                value={values.username}
                autoComplete="off"
                aria-invalid={!!errors.username}
                onChange={(e) => patch({ username: e.target.value })}
                onBlur={() => values.username && api.log('Username entered')}
              />
            </Field>
            <Field label="Email" htmlFor={`${api.id}-email`} error={errors.email}>
              <Input
                id={`${api.id}-email`}
                data-testid={`${api.id}-email`}
                type="email"
                value={values.email}
                autoComplete="off"
                aria-invalid={!!errors.email}
                onChange={(e) => patch({ email: e.target.value })}
                onBlur={() => values.email && api.log('Email entered')}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset className="grid gap-1.5" aria-describedby={errors.plan ? `${api.id}-plan-error` : undefined}>
              <legend className="text-sm font-medium">Plan</legend>
              <div className="flex flex-wrap gap-4">
                {PLANS.map((p) => (
                  <label key={p} htmlFor={`${api.id}-plan-${p.toLowerCase()}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${api.id}-plan`}
                      id={`${api.id}-plan-${p.toLowerCase()}`}
                      data-testid={`${api.id}-plan-${p.toLowerCase()}`}
                      value={p}
                      checked={values.plan === p}
                      onChange={() => {
                        patch({ plan: p })
                        api.log(`Plan selected: ${p}`)
                      }}
                      className="size-4 accent-primary"
                    />
                    {p}
                  </label>
                ))}
              </div>
              {errors.plan && (
                <p id={`${api.id}-plan-error`} role="alert" className="text-xs text-red-500">
                  {errors.plan}
                </p>
              )}
            </fieldset>
            <Field label="Theme" htmlFor={`${api.id}-theme`} error={errors.theme}>
              <select
                id={`${api.id}-theme`}
                data-testid={`${api.id}-theme`}
                className={nativeSelect}
                value={values.theme}
                aria-invalid={!!errors.theme}
                onChange={(e) => {
                  patch({ theme: e.target.value })
                  api.log(`Theme selected: ${e.target.value || 'none'}`)
                }}
              >
                <option value="">Select a theme…</option>
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <label htmlFor={`${api.id}-updates`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id={`${api.id}-updates`}
                data-testid={`${api.id}-updates`}
                checked={values.updates}
                onChange={(e) => {
                  patch({ updates: e.target.checked })
                  api.log(`Product updates ${e.target.checked ? 'on' : 'off'}`)
                }}
                className="size-4 accent-primary"
              />
              Email me product updates
            </label>
          </>
        )}

        {step === 2 && (
          <dl id={`${api.id}-review`} data-testid={`${api.id}-review`} className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Username</dt>
            <dd id={`${api.id}-review-username`} className="min-w-0 break-all font-mono">{values.username}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd id={`${api.id}-review-email`} className="min-w-0 break-all font-mono">{values.email}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd id={`${api.id}-review-plan`} className="font-mono">{values.plan}</dd>
            <dt className="text-muted-foreground">Theme</dt>
            <dd id={`${api.id}-review-theme`} className="font-mono">{values.theme}</dd>
            <dt className="text-muted-foreground">Product updates</dt>
            <dd id={`${api.id}-review-updates`} className="font-mono">{values.updates ? 'on' : 'off'}</dd>
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" id={`${api.id}-back`} data-testid={`${api.id}-back`} disabled={step === 0 || busy} onClick={back}>
            Back
          </Button>
          {step < 2 ? (
            <Button type="button" id={`${api.id}-next`} data-testid={`${api.id}-next`} onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="submit" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </div>
      </form>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
