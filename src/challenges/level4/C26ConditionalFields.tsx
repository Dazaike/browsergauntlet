import { useMemo, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { capWords, nativeSelect, panel, useAlive } from './shared'

const ACCOUNTS = ['Personal', 'Business'] as const
const SHIPPING = ['Standard', 'Express', 'Pickup'] as const
const STORES = ['Downtown', 'Airport', 'Riverside', 'Northgate']

type Payload = Record<string, string | boolean>

interface State {
  account: string
  company: string
  vat: string
  shipping: string
  notes: string
  store: string
  gift: boolean
  giftMessage: string
}

const EMPTY: State = { account: 'Personal', company: '', vat: '', shipping: 'Standard', notes: '', store: '', gift: false, giftMessage: '' }

/** Only fields that are currently visible make it into the submitted data. */
function visiblePayload(s: State): Payload {
  const p: Payload = { accountType: s.account }
  if (s.account === 'Business') {
    p.company = s.company.trim()
    p.vat = s.vat.trim()
  }
  p.shipping = s.shipping
  if (s.shipping === 'Express') p.deliveryNotes = s.notes.trim()
  if (s.shipping === 'Pickup') p.pickupStore = s.store
  p.gift = s.gift
  if (s.gift) p.giftMessage = s.giftMessage.trim()
  return p
}

export default function C26ConditionalFields({ api }: ChallengeProps) {
  const alive = useAlive()
  const target = useMemo(() => {
    const r = api.rng('target')
    const shipping = r.pick(['Express', 'Pickup'] as const)
    const expected: Payload = {
      accountType: 'Business',
      company: capWords(r.phrase(2)),
      vat: `${r.pick(['DE', 'FR', 'NL', 'ES'])}${r.digits(9)}`,
      shipping,
    }
    if (shipping === 'Express') expected.deliveryNotes = r.phrase(3)
    else expected.pickupStore = r.pick(STORES)
    const gift = r.bool()
    expected.gift = gift
    if (gift) expected.giftMessage = capWords(r.phrase(2))
    return expected
  }, [api])

  const [s, setS] = useState<State>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const patch = (p: Partial<State>) => {
    setS((v) => ({ ...v, ...p }))
    setErrors({})
  }

  const payload = visiblePayload(s)

  const submit = async () => {
    if (busy) return
    const errs: Record<string, string> = {}
    if (s.account === 'Business') {
      if (!s.company.trim()) errs.company = 'Company is required.'
      if (!s.vat.trim()) errs.vat = 'VAT number is required.'
    }
    if (s.shipping === 'Express' && !s.notes.trim()) errs.notes = 'Delivery notes are required.'
    if (s.shipping === 'Pickup' && !s.store) errs.store = 'Choose a pickup store.'
    if (s.gift && !s.giftMessage.trim()) errs.giftMessage = 'Gift message is required.'
    setErrors(errs)
    api.log(`Submitted: ${JSON.stringify(payload)}`)
    if (Object.keys(errs).length) {
      set('error', `Required field empty: ${Object.keys(errs).join(', ')}`)
      api.fail(`Required visible field empty: ${Object.keys(errs).join(', ')}`)
      return
    }
    setBusy(true)
    const bad = await api.request(() => {
      const keys = new Set([...Object.keys(payload), ...Object.keys(target)])
      return [...keys].filter((k) => payload[k] !== target[k])
    }, 'submit form')
    if (!alive.current) return
    setBusy(false)
    if (bad.length) {
      set('error', `Wrong or unexpected value: ${bad.join(', ')}`)
      api.fail(`Mismatch in: ${bad.join(', ')}`)
    } else {
      set('success', 'Form data accepted')
      api.succeed('Visible fields matched the task')
    }
  }

  const radio = (name: string, value: string, checked: boolean, onSelect: () => void) => (
    <label key={value} htmlFor={`${api.id}-${name}-${value.toLowerCase()}`} className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name={`${api.id}-${name}`}
        id={`${api.id}-${name}-${value.toLowerCase()}`}
        data-testid={`${api.id}-${name}-${value.toLowerCase()}`}
        value={value}
        checked={checked}
        onChange={() => {
          onSelect()
          api.log(`${name} set to ${value}`)
        }}
        className="size-4 accent-primary"
      />
      {value}
    </label>
  )

  return (
    <div className="grid gap-4">
      <Task>
        Choose account type <Target>{String(target.accountType)}</Target> with company <Target>{String(target.company)}</Target> and VAT{' '}
        <Target>{String(target.vat)}</Target>. Choose shipping <Target>{String(target.shipping)}</Target> and{' '}
        {target.shipping === 'Express' ? (
          <>
            delivery notes <Target>{String(target.deliveryNotes)}</Target>
          </>
        ) : (
          <>
            pickup store <Target>{String(target.pickupStore)}</Target>
          </>
        )}
        .{' '}
        {target.gift ? (
          <>
            Tick gift with message <Target>{String(target.giftMessage)}</Target>.
          </>
        ) : (
          <>
            Leave gift <Target>unticked</Target>.
          </>
        )}{' '}
        Then submit.
      </Task>

      <form
        className={cn(panel, 'grid gap-5')}
        aria-label="Order details"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Account type</legend>
          <div className="flex flex-wrap gap-4">
            {ACCOUNTS.map((a) =>
              radio('account', a, s.account === a, () => patch(a === 'Business' ? { account: a } : { account: a, company: '', vat: '' })),
            )}
          </div>
        </fieldset>

        {s.account === 'Business' && (
          <div id={`${api.id}-business`} data-testid={`${api.id}-business`} className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
            <Field label="Company name" htmlFor={`${api.id}-company`} error={errors.company}>
              <Input
                id={`${api.id}-company`}
                data-testid={`${api.id}-company`}
                value={s.company}
                autoComplete="off"
                aria-invalid={!!errors.company}
                onChange={(e) => patch({ company: e.target.value })}
                onBlur={() => s.company && api.log('Company entered')}
              />
            </Field>
            <Field label="VAT number" htmlFor={`${api.id}-vat`} error={errors.vat}>
              <Input
                id={`${api.id}-vat`}
                data-testid={`${api.id}-vat`}
                value={s.vat}
                autoComplete="off"
                aria-invalid={!!errors.vat}
                onChange={(e) => patch({ vat: e.target.value })}
                onBlur={() => s.vat && api.log('VAT entered')}
              />
            </Field>
          </div>
        )}

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Shipping</legend>
          <div className="flex flex-wrap gap-4">
            {SHIPPING.map((m) => radio('shipping', m, s.shipping === m, () => patch({ shipping: m, notes: '', store: '' })))}
          </div>
        </fieldset>

        {s.shipping === 'Express' && (
          <div id={`${api.id}-express`} data-testid={`${api.id}-express`} className="rounded-md border border-border p-3">
            <Field label="Delivery notes" htmlFor={`${api.id}-notes`} error={errors.notes}>
              <Input
                id={`${api.id}-notes`}
                data-testid={`${api.id}-notes`}
                value={s.notes}
                autoComplete="off"
                aria-invalid={!!errors.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                onBlur={() => s.notes && api.log('Delivery notes entered')}
              />
            </Field>
          </div>
        )}

        {s.shipping === 'Pickup' && (
          <div id={`${api.id}-pickup`} data-testid={`${api.id}-pickup`} className="rounded-md border border-border p-3">
            <Field label="Pickup store" htmlFor={`${api.id}-store`} error={errors.store}>
              <select
                id={`${api.id}-store`}
                data-testid={`${api.id}-store`}
                className={nativeSelect}
                value={s.store}
                aria-invalid={!!errors.store}
                onChange={(e) => {
                  patch({ store: e.target.value })
                  api.log(`Pickup store set to ${e.target.value || 'none'}`)
                }}
              >
                <option value="">Select a store…</option>
                {STORES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <label htmlFor={`${api.id}-gift`} className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            id={`${api.id}-gift`}
            data-testid={`${api.id}-gift`}
            checked={s.gift}
            onChange={(e) => {
              patch(e.target.checked ? { gift: true } : { gift: false, giftMessage: '' })
              api.log(`Gift ${e.target.checked ? 'ticked' : 'unticked'}`)
            }}
            className="size-4 accent-primary"
          />
          This order is a gift
        </label>

        {s.gift && (
          <div id={`${api.id}-gift-box`} data-testid={`${api.id}-gift-box`} className="rounded-md border border-border p-3">
            <Field label="Gift message" htmlFor={`${api.id}-gift-message`} error={errors.giftMessage}>
              <Input
                id={`${api.id}-gift-message`}
                data-testid={`${api.id}-gift-message`}
                value={s.giftMessage}
                autoComplete="off"
                aria-invalid={!!errors.giftMessage}
                onChange={(e) => patch({ giftMessage: e.target.value })}
                onBlur={() => s.giftMessage && api.log('Gift message entered')}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Data that will be submitted</span>
          <pre id={`${api.id}-payload`} data-testid={`${api.id}-payload`} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>

        <div>
          <Button type="submit" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
