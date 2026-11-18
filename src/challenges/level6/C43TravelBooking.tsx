import { useEffect, useRef, useState } from 'react'
import { Minus, Plane, Plus, TicketCheck } from 'lucide-react'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import type { Rng } from '@/lib/prng'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { nativeField } from './nativeFieldStyles'

const CITIES = [
  { code: 'ALD', name: 'Aldermere' }, { code: 'BRM', name: 'Brightmoor' }, { code: 'CNF', name: 'Cinderfall' }, { code: 'DNM', name: 'Dunmarrow' },
  { code: 'EWK', name: 'Eastwick' }, { code: 'FHL', name: 'Fairhollow' }, { code: 'GRW', name: 'Greywater' }, { code: 'HMR', name: 'Highmere' },
]
const AIRLINES = ['Skyline Air', 'Northwind', 'Aurora Jets', 'Pelican Airways', 'Zephyr Lines', 'Meridian']
const WINDOWS = ['morning', 'afternoon', 'evening'] as const
type Window = (typeof WINDOWS)[number]
const WINDOW_LABEL: Record<Window, string> = { morning: 'Morning (05:00–11:59)', afternoon: 'Afternoon (12:00–17:59)', evening: 'Evening (18:00–23:59)' }
const MIN_DATE = '2027-03-01'
const MAX_DATE = '2027-03-31'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Flight { id: string; airline: string; number: string; dep: number; dur: number; stops: number; price: number }
interface Snapshot { origin: string; dest: string; depart: string; ret: string; pax: number; flights: Flight[] }
interface Goal { origin: string; dest: string; depart: string; ret: string; pax: number; airline: string; maxStops: number; window: Window; maxPrice: number }

const windowOf = (dep: number): Window => (dep < 720 ? 'morning' : dep < 1080 ? 'afternoon' : 'evening')
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const cityLabel = (code: string) => { const c = CITIES.find((x) => x.code === code); return c ? `${c.name} (${c.code})` : code }
const day = (n: number) => `2027-03-${String(n).padStart(2, '0')}`

const matches = (f: Flight, t: Goal) => f.airline === t.airline && f.stops <= t.maxStops && windowOf(f.dep) === t.window && f.price <= t.maxPrice

function buildTarget(api: ChallengeApi): Goal {
  const r = api.rng('target')
  const [o, d] = r.sample(CITIES, 2)
  const dep = r.int(4, 14)
  return {
    origin: o.code, dest: d.code, depart: day(dep), ret: day(dep + r.int(3, 9)), pax: r.int(2, 4),
    airline: r.pick(AIRLINES), maxStops: r.pick([0, 1]), window: r.pick(WINDOWS), maxPrice: r.int(5, 12) * 50,
  }
}

/** One flight. `bad` names the single constraint to violate (decoys); undefined = satisfy all target constraints; 'free' = unconstrained. */
function makeFlight(r: Rng, t: Goal, bad?: 'airline' | 'stops' | 'window' | 'price' | 'free'): Omit<Flight, 'id'> {
  if (bad === 'free') {
    const stops = r.pick([0, 0, 1, 1, 2])
    const dep = r.int(60, 281) * 5
    return { airline: r.pick(AIRLINES), number: '', dep, dur: 90 + stops * 70 + r.int(0, 12) * 5, stops, price: r.int(110, 900) }
  }
  const others = AIRLINES.filter((a) => a !== t.airline)
  const airline = bad === 'airline' ? r.pick(others) : t.airline
  const stops = bad === 'stops' ? r.int(t.maxStops + 1, 2) : r.int(0, t.maxStops)
  const win = bad === 'window' ? r.pick(WINDOWS.filter((w) => w !== t.window)) : t.window
  const [lo, hi] = win === 'morning' ? [300, 715] : win === 'afternoon' ? [720, 1075] : [1080, 1410]
  const dep = r.int(lo / 5, hi / 5) * 5
  const price = bad === 'price' ? t.maxPrice + r.int(1, 15) * 10 : Math.max(110, t.maxPrice - r.int(0, 12) * 10)
  return { airline, number: '', dep, dur: 90 + stops * 70 + r.int(0, 12) * 5, stops, price }
}

function buildFlights(r: Rng, t: Goal | null): Flight[] {
  const raw: Omit<Flight, 'id'>[] = []
  if (t) {
    raw.push(makeFlight(r, t))
    for (const bad of ['airline', 'stops', 'window', 'price'] as const) raw.push(makeFlight(r, t, bad))
    while (raw.length < 14) {
      const f = makeFlight(r, t, 'free')
      if (!matches({ ...f, id: '' }, t)) raw.push(f)
    }
  } else {
    // Any airline/price mix; there is no "correct" answer for non-target searches.
    const dummy: Goal = { origin: '', dest: '', depart: '', ret: '', pax: 1, airline: '', maxStops: 0, window: 'morning', maxPrice: 0 }
    while (raw.length < 14) raw.push(makeFlight(r, dummy, 'free'))
  }
  return r.shuffle(raw).map((f, i) => ({ ...f, id: `f${i + 1}`, number: `${f.airline.slice(0, 2).toUpperCase()}${r.int(100, 989)}` }))
}

export default function C43TravelBooking({ api, status }: ChallengeProps) {
  const [target] = useState(() => buildTarget(api))
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [depart, setDepart] = useState('')
  const [ret, setRet] = useState('')
  const [pax, setPax] = useState(1)
  const [formError, setFormError] = useState('')
  const [searching, setSearching] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [maxPrice, setMaxPrice] = useState(1000)
  const [stopsFilter, setStopsFilter] = useState('any')
  const [airlineFilter, setAirlineFilter] = useState<string[]>([])
  const [windowFilter, setWindowFilter] = useState('any')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [detailErrors, setDetailErrors] = useState<{ name?: string; email?: string }>({})
  const [reserving, setReserving] = useState(false)
  const [reservation, setReservation] = useState<string | null>(null)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)
  const seq = useRef(0)
  const logTimers = useRef<Record<string, number>>({})

  useEffect(() => {
    mounted.current = true
    const pending = logTimers.current
    return () => { mounted.current = false; Object.values(pending).forEach(clearTimeout) }
  }, [])

  useEffect(() => {
    if (!snap) return
    if (!api.settings.dynamic) { setRevealed(snap.flights.length); return }
    setRevealed(10)
    const t = setTimeout(() => setRevealed(snap.flights.length), api.delay(900))
    return () => clearTimeout(t)
  }, [snap, api])

  const logSoon = (key: string, msg: string) => {
    clearTimeout(logTimers.current[key])
    logTimers.current[key] = window.setTimeout(() => api.log(msg), 400)
  }

  const locked = reservation !== null || status === 'failed'

  const search = async () => {
    if (searching || locked) return
    let err = ''
    if (!origin || !dest) err = 'Choose an origin and a destination.'
    else if (origin === dest) err = 'Origin and destination must differ.'
    else if (!depart || !ret) err = 'Enter both a departure and a return date.'
    else if (depart < MIN_DATE || depart > MAX_DATE || ret < MIN_DATE || ret > MAX_DATE) err = `Dates must be between ${MIN_DATE} and ${MAX_DATE}.`
    else if (ret <= depart) err = 'Return date must be after the departure date.'
    setFormError(err)
    if (err) { set('error', err); api.log(`Search blocked: ${err}`); return }
    const my = ++seq.current
    setSearching(true)
    setSelectedId(null)
    api.log(`Searching ${origin} → ${dest}, ${depart} to ${ret}, ${pax} passenger(s)`)
    const result = await api.request<Snapshot>(() => {
      const isTarget = origin === target.origin && dest === target.dest && depart === target.depart
      const r = api.rng(isTarget ? 'flights-target' : `flights:${origin}:${dest}:${depart}:${ret}`)
      return { origin, dest, depart, ret, pax, flights: buildFlights(r, isTarget ? target : null) }
    }, 'flight search')
    if (!mounted.current || my !== seq.current) return
    setSearching(false)
    setSnap(result)
    set('info', `${result.flights.length} flights found`)
  }

  const visible = snap
    ? snap.flights.slice(0, revealed).filter((f) =>
        f.price <= maxPrice &&
        (stopsFilter === 'any' || f.stops <= Number(stopsFilter)) &&
        (airlineFilter.length === 0 || airlineFilter.includes(f.airline)) &&
        (windowFilter === 'any' || windowOf(f.dep) === windowFilter))
    : []
  const selected = snap?.flights.find((f) => f.id === selectedId) ?? null

  const reserve = async () => {
    if (!snap || !selected || reserving || locked) return
    const errs: { name?: string; email?: string } = {}
    if (name.trim().length < 2) errs.name = 'Enter the passenger name.'
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.'
    setDetailErrors(errs)
    if (errs.name || errs.email) { set('error', 'Complete the passenger details.'); api.log('Reserve blocked: invalid passenger details'); return }
    setReserving(true)
    api.log(`Reserving ${selected.airline} ${selected.number} for ${snap.pax} passenger(s)`)
    const ref = await api.request(() => `RES-${api.rng('reservation').string(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789')}`, 'reserve flight')
    if (!mounted.current) return
    setReserving(false)
    const problems: string[] = []
    if (snap.origin !== target.origin || snap.dest !== target.dest) problems.push('route')
    if (snap.depart !== target.depart) problems.push('departure date')
    if (snap.ret !== target.ret) problems.push('return date')
    if (snap.pax !== target.pax) problems.push('passenger count')
    if (selected.airline !== target.airline) problems.push('airline')
    if (selected.stops > target.maxStops) problems.push('stops')
    if (windowOf(selected.dep) !== target.window) problems.push('departure window')
    if (selected.price > target.maxPrice) problems.push('price')
    if (problems.length > 0) {
      const reason = `Reservation violates: ${problems.join(', ')}`
      set('error', reason)
      api.fail(reason)
      return
    }
    setReservation(ref)
    set('success', `Reservation ${ref} created`)
    api.succeed(`${selected.airline} ${selected.number} ${ref}`)
  }

  const stopsText = (n: number) => (n === 0 ? 'Nonstop' : `${n} stop${n > 1 ? 's' : ''}`)

  return (
    <div className="grid gap-4">
      <Task>
        Book a round trip from <Target>{cityLabel(target.origin)}</Target> to <Target>{cityLabel(target.dest)}</Target>, departing <Target>{target.depart}</Target> and
        returning <Target>{target.ret}</Target>, for <Target>{target.pax}</Target> passengers. Pick the flight operated by <Target>{target.airline}</Target> that is{' '}
        <Target>{target.maxStops === 0 ? 'nonstop' : 'at most 1 stop'}</Target>, departs in the <Target>{target.window}</Target> and costs at most{' '}
        <Target>${target.maxPrice}</Target> per passenger. Then reserve it with any passenger name and email.
      </Task>

      <form noValidate aria-label="Flight search" className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void search() }}>
        <Field label="From" htmlFor={`${api.id}-origin`}>
          <select id={`${api.id}-origin`} data-testid={`${api.id}-origin`} className={nativeField} value={origin} disabled={locked} onChange={(e) => { setOrigin(e.target.value); api.log(`Origin: ${e.target.value}`) }}>
            <option value="">Select city</option>
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </Field>
        <Field label="To" htmlFor={`${api.id}-dest`}>
          <select id={`${api.id}-dest`} data-testid={`${api.id}-dest`} className={nativeField} value={dest} disabled={locked} onChange={(e) => { setDest(e.target.value); api.log(`Destination: ${e.target.value}`) }}>
            <option value="">Select city</option>
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </Field>
        <Field label="Depart" htmlFor={`${api.id}-depart`}>
          <Input id={`${api.id}-depart`} data-testid={`${api.id}-depart`} type="date" min={MIN_DATE} max={MAX_DATE} value={depart} disabled={locked} onChange={(e) => { setDepart(e.target.value); logSoon("depart", `Departure date: ${e.target.value}`) }} />
        </Field>
        <Field label="Return" htmlFor={`${api.id}-return`}>
          <Input id={`${api.id}-return`} data-testid={`${api.id}-return`} type="date" min={depart || MIN_DATE} max={MAX_DATE} value={ret} disabled={locked} onChange={(e) => { setRet(e.target.value); logSoon("return", `Return date: ${e.target.value}`) }} />
        </Field>
        <div className="grid gap-1.5">
          <span id={`${api.id}-pax-label`} className="text-sm font-medium">Passengers</span>
          <div role="group" aria-labelledby={`${api.id}-pax-label`} className="flex items-center gap-1">
            <Button id={`${api.id}-pax-dec`} data-testid={`${api.id}-pax-dec`} type="button" size="icon" variant="outline" aria-label="Fewer passengers" disabled={locked || pax <= 1} onClick={() => { setPax(pax - 1); api.log(`Passengers: ${pax - 1}`) }}><Minus /></Button>
            <output id={`${api.id}-pax`} data-testid={`${api.id}-pax`} data-value={pax} aria-live="polite" className="w-8 text-center text-sm tabular-nums">{pax}</output>
            <Button id={`${api.id}-pax-inc`} data-testid={`${api.id}-pax-inc`} type="button" size="icon" variant="outline" aria-label="More passengers" disabled={locked || pax >= 6} onClick={() => { setPax(pax + 1); api.log(`Passengers: ${pax + 1}`) }}><Plus /></Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
          <Button id={`${api.id}-search`} data-testid={`${api.id}-search`} type="submit" disabled={locked || searching}><Plane /> {searching ? 'Searching…' : 'Search flights'}</Button>
          {formError && <p id={`${api.id}-form-error`} role="alert" className="text-sm text-red-500">{formError}</p>}
        </div>
      </form>

      {snap && (
        <section aria-label="Search results" className="grid gap-3">
          <p id={`${api.id}-results-summary`} data-testid={`${api.id}-results-summary`} className="text-sm text-muted-foreground">
            Results for {cityLabel(snap.origin)} → {cityLabel(snap.dest)}, {snap.depart} to {snap.ret}, {snap.pax} passenger{snap.pax > 1 ? 's' : ''} · {visible.length} of {revealed} shown
          </p>
          <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <label htmlFor={`${api.id}-filter-price`} className="text-sm font-medium">Max price per passenger</label>
              <input
                id={`${api.id}-filter-price`}
                data-testid={`${api.id}-filter-price`}
                type="range"
                min={100}
                max={1000}
                step={10}
                value={maxPrice}
                className="w-full accent-primary"
                onChange={(e) => { setMaxPrice(Number(e.target.value)); logSoon("price", `Max price filter: $${e.target.value}`) }}
              />
              <output id={`${api.id}-filter-price-value`} data-testid={`${api.id}-filter-price-value`} data-value={maxPrice} className="text-xs tabular-nums text-muted-foreground">Up to ${maxPrice}</output>
            </div>
            <Field label="Stops" htmlFor={`${api.id}-filter-stops`}>
              <select id={`${api.id}-filter-stops`} data-testid={`${api.id}-filter-stops`} className={nativeField} value={stopsFilter} onChange={(e) => { setStopsFilter(e.target.value); api.log(`Stops filter: ${e.target.value}`) }}>
                <option value="any">Any number of stops</option>
                <option value="0">Nonstop only</option>
                <option value="1">Up to 1 stop</option>
              </select>
            </Field>
            <Field label="Departure window" htmlFor={`${api.id}-filter-window`}>
              <select id={`${api.id}-filter-window`} data-testid={`${api.id}-filter-window`} className={nativeField} value={windowFilter} onChange={(e) => { setWindowFilter(e.target.value); api.log(`Departure window filter: ${e.target.value}`) }}>
                <option value="any">Any time</option>
                {WINDOWS.map((w) => <option key={w} value={w}>{WINDOW_LABEL[w]}</option>)}
              </select>
            </Field>
            <fieldset className="grid content-start gap-1">
              <legend className="mb-1 text-sm font-medium">Airlines</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {AIRLINES.map((a) => {
                  const slug = a.toLowerCase().replace(/\s+/g, '-')
                  return (
                    <label key={a} htmlFor={`${api.id}-filter-airline-${slug}`} className="flex items-center gap-1.5 text-xs">
                      <input
                        id={`${api.id}-filter-airline-${slug}`}
                        data-testid={`${api.id}-filter-airline-${slug}`}
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={airlineFilter.includes(a)}
                        onChange={(e) => { setAirlineFilter((cur) => (e.target.checked ? [...cur, a] : cur.filter((x) => x !== a))); api.log(`Airline filter ${a} ${e.target.checked ? 'on' : 'off'}`) }}
                      />
                      {a}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>

          {visible.length === 0 ? (
            <p id={`${api.id}-no-results`} role="status" className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No flights match the filters.</p>
          ) : (
            <ul id={`${api.id}-results`} data-testid={`${api.id}-results`} className="grid gap-2">
              {visible.map((f) => (
                <li
                  key={f.id}
                  id={`${api.id}-result-${f.id}`}
                  data-testid={`${api.id}-result-${f.id}`}
                  data-airline={f.airline}
                  data-stops={f.stops}
                  data-price={f.price}
                  data-departs={hhmm(f.dep)}
                  className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5', selectedId === f.id ? 'border-primary' : 'border-border')}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <p className="text-sm font-medium">{f.airline} <span className="font-mono text-xs text-muted-foreground">{f.number}</span></p>
                    <p className="text-sm tabular-nums">{hhmm(f.dep)} → {hhmm(f.dep + f.dur)}{f.dep + f.dur >= 1440 ? ' +1' : ''}</p>
                    <p className="text-xs text-muted-foreground">{stopsText(f.stops)} · {Math.floor(f.dur / 60)}h {String(f.dur % 60).padStart(2, '0')}m</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">${f.price}</p>
                      <p className="text-xs text-muted-foreground">per passenger · ${f.price * snap.pax} total</p>
                    </div>
                    <Button
                      id={`${api.id}-select-${f.id}`}
                      data-testid={`${api.id}-select-${f.id}`}
                      size="sm"
                      variant={selectedId === f.id ? 'default' : 'outline'}
                      aria-pressed={selectedId === f.id}
                      aria-label={`Select ${f.airline} ${f.number}`}
                      disabled={locked}
                      onClick={() => { setSelectedId(f.id); setDetailErrors({}); api.log(`Selected flight ${f.airline} ${f.number}`); set('info', `Selected ${f.airline} ${f.number}`) }}
                    >
                      {selectedId === f.id ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {snap && selected && (
        <form noValidate aria-label="Passenger details" className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 sm:p-4" onSubmit={(e) => { e.preventDefault(); void reserve() }}>
          <p id={`${api.id}-selected`} data-testid={`${api.id}-selected`} data-flight={selected.id} className="text-sm sm:col-span-2">
            Selected: <span className="font-medium">{selected.airline} {selected.number}</span>, {hhmm(selected.dep)}, {stopsText(selected.stops).toLowerCase()}, ${selected.price} per passenger
          </p>
          <Field label="Passenger name" htmlFor={`${api.id}-name`} error={detailErrors.name}>
            <Input id={`${api.id}-name`} data-testid={`${api.id}-name`} autoComplete="name" value={name} disabled={locked} aria-invalid={detailErrors.name ? true : undefined} onChange={(e) => setName(e.target.value)} onBlur={() => name && api.log('Passenger name entered')} />
          </Field>
          <Field label="Contact email" htmlFor={`${api.id}-email`} error={detailErrors.email}>
            <Input id={`${api.id}-email`} data-testid={`${api.id}-email`} type="email" autoComplete="email" value={email} disabled={locked} aria-invalid={detailErrors.email ? true : undefined} onChange={(e) => setEmail(e.target.value)} onBlur={() => email && api.log('Passenger email entered')} />
          </Field>
          <div className="sm:col-span-2">
            <Button id={`${api.id}-reserve`} data-testid={`${api.id}-reserve`} type="submit" disabled={locked || reserving}>{reserving ? 'Reserving…' : 'Reserve'}</Button>
          </div>
        </form>
      )}

      <Feedback state={fb} id={`${api.id}-feedback`} />

      {reservation && (
        <div id={`${api.id}-confirmation`} data-testid={`${api.id}-confirmation`} role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <TicketCheck className="size-5 text-emerald-500" aria-hidden /> Reservation <span className="font-mono">{reservation}</span> confirmed.
        </div>
      )}
    </div>
  )
}
