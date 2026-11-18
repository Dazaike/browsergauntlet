import { useMemo, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { panel, useAlive } from './shared'

type Key = 'email' | 'phone' | 'postal' | 'url' | 'date'
type Values = Record<Key, string>

const FIELDS: { key: Key; label: string; hint: string }[] = [
  { key: 'email', label: 'Email', hint: 'name@domain.tld' },
  { key: 'phone', label: 'Phone', hint: 'US number, e.g. (555) 123-4567 or 555-123-4567' },
  { key: 'postal', label: 'Postal code', hint: 'US ZIP: 12345 or 12345-6789' },
  { key: 'url', label: 'Website', hint: 'http:// or https:// URL with a domain' },
  { key: 'date', label: 'Date', hint: 'YYYY-MM-DD, a real calendar date' },
]

function validDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

function validUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return (u.protocol === 'http:' || u.protocol === 'https:') && /^[^.\s]+(\.[^.\s]+)+$/.test(u.hostname) && /^https?:\/\/[^/\s]/.test(v)
  } catch {
    return false
  }
}

/** Returns an error message, or '' when valid. */
function check(key: Key, raw: string): string {
  if (raw.trim() === '') return 'This field is required.'
  const v = raw
  switch (key) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) ? '' : 'Enter a valid email like name@domain.tld.'
    case 'phone':
      return /^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/.test(v) ? '' : 'Phone must have 10 digits, e.g. (555) 123-4567.'
    case 'postal':
      return /^\d{5}(-\d{4})?$/.test(v) ? '' : 'Postal code must be 12345 or 12345-6789.'
    case 'url':
      return validUrl(v) ? '' : 'URL must start with http:// or https:// and include a domain.'
    case 'date':
      return validDate(v) ? '' : 'Date must be a real date in YYYY-MM-DD format.'
  }
}

export default function C27FieldValidation({ api }: ChallengeProps) {
  const alive = useAlive()
  const initial = useMemo<Values>(() => {
    const r = api.rng('initial')
    const w = r.word()
    return {
      email: r.pick([`${w}.example.com`, `${w}@@example.com`, `${w}@example`, `${w} ${r.word()}@example.com`]),
      phone: r.pick([`555-${r.digits(4)}`, `(${r.digits(3)}) 12-34`, `${r.digits(7)}`]),
      postal: r.pick([`${r.digits(4)}`, `${r.string(5, 'ABCDEFGH')}`, `${r.digits(6)}`]),
      url: r.pick([`htp://${w}.com`, `https://${w}`, `www.${w}.com`, `https:/${w}.com`]),
      date: r.pick(['2026-02-30', '2026-13-05', '05/21/2026', '2026-00-10', '2026-4-9']),
    }
  }, [api])

  const [values, setValues] = useState<Values>(initial)
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback({ type: 'info', text: 'Five fields are invalid. Fix them to submit.' })

  const errors = Object.fromEntries(FIELDS.map((f) => [f.key, check(f.key, values[f.key])])) as Record<Key, string>
  const invalid = FIELDS.filter((f) => errors[f.key])

  const submit = async () => {
    if (busy) return
    api.log(`Submitted with ${invalid.length} invalid field(s)`)
    if (invalid.length) {
      const names = invalid.map((f) => f.label).join(', ')
      set('error', `Still invalid: ${names}`)
      api.fail(`Submitted with invalid fields: ${names}`)
      return
    }
    setBusy(true)
    await api.request(() => true, 'submit validated form')
    if (!alive.current) return
    setBusy(false)
    set('success', 'All fields valid')
    api.succeed('All five fields valid on submit')
  }

  return (
    <div className="grid gap-4">
      <Task>
        All five fields below start with invalid values. Edit each one until its error message disappears (blank values are not allowed), then submit.
      </Task>
      <form
        className={cn(panel, 'grid gap-4')}
        aria-label="Contact details"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key} data-valid={!errors[f.key]}>
            <Field label={f.label} htmlFor={`${api.id}-${f.key}`} error={errors[f.key]} hint={f.hint}>
              <Input
                id={`${api.id}-${f.key}`}
                data-testid={`${api.id}-${f.key}`}
                value={values[f.key]}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                onBlur={() => api.log(`${f.label} ${errors[f.key] ? 'still invalid' : 'valid'}`)}
              />
            </Field>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
          <span id={`${api.id}-invalid-count`} data-testid={`${api.id}-invalid-count`} className="text-sm text-muted-foreground">
            {invalid.length} invalid field{invalid.length === 1 ? '' : 's'}
          </span>
        </div>
      </form>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
