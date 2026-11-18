import { useMemo, useRef, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { nativeSelect, panel, useAlive } from './shared'

const DATA: Record<string, Record<string, string[]>> = {
  'United States': {
    California: ['Los Angeles', 'San Diego', 'San Jose', 'Sacramento'],
    Texas: ['Austin', 'Dallas', 'Houston', 'El Paso'],
    Washington: ['Seattle', 'Spokane', 'Tacoma'],
  },
  Canada: {
    Ontario: ['Toronto', 'Ottawa', 'Hamilton'],
    Quebec: ['Montreal', 'Quebec City', 'Laval'],
    'British Columbia': ['Vancouver', 'Victoria', 'Kelowna'],
  },
  Germany: {
    Bavaria: ['Munich', 'Nuremberg', 'Augsburg'],
    Hesse: ['Frankfurt', 'Wiesbaden', 'Kassel'],
    Saxony: ['Leipzig', 'Dresden', 'Chemnitz'],
  },
  Australia: {
    'New South Wales': ['Sydney', 'Newcastle', 'Wollongong'],
    Victoria: ['Melbourne', 'Geelong', 'Ballarat'],
    Queensland: ['Brisbane', 'Cairns', 'Townsville'],
  },
}

export default function C28DynamicDropdowns({ api }: ChallengeProps) {
  const alive = useAlive()
  const { target, countries } = useMemo(() => {
    const r = api.rng('target')
    const country = r.pick(Object.keys(DATA))
    const state = r.pick(Object.keys(DATA[country]))
    const city = r.pick(DATA[country][state])
    return { target: { country, state, city }, countries: api.rng('order').shuffle(Object.keys(DATA)) }
  }, [api])

  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [loading, setLoading] = useState<'' | 'states' | 'cities'>('')
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()
  const token = useRef(0)

  const pickCountry = async (value: string) => {
    const mine = ++token.current
    setCountry(value)
    setState('')
    setCity('')
    setStates([])
    setCities([])
    api.log(`Country selected: ${value || 'none'}`)
    if (!value) {
      setLoading('')
      return
    }
    setLoading('states')
    const list = await api.request(() => Object.keys(DATA[value]), `load states for ${value}`)
    if (!alive.current || token.current !== mine) return
    setStates(list)
    setLoading('')
  }

  const pickState = async (value: string) => {
    const mine = ++token.current
    setState(value)
    setCity('')
    setCities([])
    api.log(`State selected: ${value || 'none'}`)
    if (!value) {
      setLoading('')
      return
    }
    setLoading('cities')
    const list = await api.request(() => DATA[country][value], `load cities for ${value}`)
    if (!alive.current || token.current !== mine) return
    setCities(list)
    setLoading('')
  }

  const submit = async () => {
    if (busy || loading) return
    const triple = `${country} / ${state} / ${city}`
    api.log(`Submitted ${triple}`)
    if (!country || !state || !city) {
      set('error', 'Choose a country, state and city first')
      return
    }
    setBusy(true)
    const ok = await api.request(() => country === target.country && state === target.state && city === target.city, 'submit location')
    if (!alive.current) return
    setBusy(false)
    if (ok) {
      set('success', `Location accepted: ${triple}`)
      api.succeed(triple)
    } else {
      set('error', `Wrong location: ${triple}`)
      api.fail(`Submitted ${triple}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Select country <Target>{target.country}</Target>, state <Target>{target.state}</Target> and city <Target>{target.city}</Target>, then submit.
      </Task>
      <form
        className={`${panel} grid gap-4`}
        aria-label="Location"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Country" htmlFor={`${api.id}-country`}>
            <select id={`${api.id}-country`} data-testid={`${api.id}-country`} className={nativeSelect} value={country} onChange={(e) => void pickCountry(e.target.value)}>
              <option value="">Select a country…</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="State" htmlFor={`${api.id}-state`}>
            <select
              id={`${api.id}-state`}
              data-testid={`${api.id}-state`}
              className={nativeSelect}
              value={state}
              disabled={!country || loading === 'states'}
              aria-busy={loading === 'states'}
              onChange={(e) => void pickState(e.target.value)}
            >
              <option value="">{loading === 'states' ? 'Loading…' : 'Select a state…'}</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City" htmlFor={`${api.id}-city`}>
            <select
              id={`${api.id}-city`}
              data-testid={`${api.id}-city`}
              className={nativeSelect}
              value={city}
              disabled={!state || loading === 'cities'}
              aria-busy={loading === 'cities'}
              onChange={(e) => {
                setCity(e.target.value)
                api.log(`City selected: ${e.target.value || 'none'}`)
              }}
            >
              <option value="">{loading === 'cities' ? 'Loading…' : 'Select a city…'}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
          <span id={`${api.id}-current`} data-testid={`${api.id}-current`} className="font-mono text-xs text-muted-foreground">
            {country || '—'} / {state || '—'} / {city || '—'}
          </span>
        </div>
      </form>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
