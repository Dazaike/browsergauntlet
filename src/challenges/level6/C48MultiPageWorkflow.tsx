import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Feedback, Field, Target, Task, useFeedback, type FeedbackState } from '@/challenges/kit'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

const BASE = '/challenge/multi-page-workflow'
const STORAGE_KEY = 'bg:c48:state'

type Plan = '' | 'free' | 'pro' | 'team'

interface WfState {
  displayName: string
  plan: Plan
  profileSaved: boolean
  notify: string[]
  region: string
  prefsSaved: boolean
  code: string
  reviewed: boolean
  finished: boolean
}

interface WfTarget {
  displayName: string
  plan: Exclude<Plan, '' | 'free'>
  notify: string[]
  region: string
  code: string
}

interface WfContext {
  api: ChallengeApi
  state: WfState
  target: WfTarget
  patch: (p: Partial<WfState>) => void
  fb: FeedbackState
  setFb: (type: FeedbackState['type'], text: string) => void
  alive: () => boolean
}

const EMPTY: WfState = { displayName: '', plan: '', profileSaved: false, notify: [], region: '', prefsSaved: false, code: '', reviewed: false, finished: false }

const PLANS: { id: Exclude<Plan, ''>; label: string; blurb: string }[] = [
  { id: 'free', label: 'Free', blurb: '1 project' },
  { id: 'pro', label: 'Pro', blurb: '20 projects' },
  { id: 'team', label: 'Team', blurb: 'Unlimited projects' },
]
const NOTIFY = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'push', label: 'Push' },
  { id: 'digest', label: 'Weekly digest' },
]
const REGIONS = [
  { id: 'eu-west', label: 'Europe (West)' },
  { id: 'eu-north', label: 'Europe (North)' },
  { id: 'us-east', label: 'US East' },
  { id: 'us-west', label: 'US West' },
  { id: 'ap-south', label: 'Asia Pacific (South)' },
]
const STEPS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'confirm', label: 'Confirm' },
] as const
const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:w-64'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const labelOf = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

function load(seed: number, passed: boolean): { state: WfState; existed: boolean } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const { seed: storedSeed, ...p } = JSON.parse(raw) as Partial<WfState> & { seed?: number }
      // State saved under another seed, or a finished workflow whose result was since reset, would make the task unsolvable.
      if (storedSeed === seed && (!p.finished || passed)) {
        return { state: { ...EMPTY, ...p, notify: Array.isArray(p.notify) ? p.notify.filter((n) => typeof n === 'string') : [] }, existed: true }
      }
    } catch {
      // corrupt entry: fall through and discard it
    }
    localStorage.removeItem(STORAGE_KEY)
  }
  return { state: EMPTY, existed: false }
}

function buildTarget(api: ChallengeApi): WfTarget {
  const rng = api.rng('target')
  const [a, b] = rng.sample(['amber', 'cedar', 'delta', 'ember', 'falcon', 'garnet', 'harbor', 'indigo', 'juniper', 'kestrel'], 2)
  const picked = rng.sample(NOTIFY, 2).map((n) => n.id)
  return {
    displayName: `${cap(a)} ${cap(b)}`,
    plan: rng.pick(['pro', 'team'] as const),
    notify: NOTIFY.map((n) => n.id).filter((id) => picked.includes(id)),
    region: rng.pick(REGIONS).id,
    code: rng.string(6),
  }
}

const Ctx = createContext<WfContext | null>(null)

function useWf(): WfContext {
  const c = useContext(Ctx)
  if (!c) throw new Error('Workflow context missing')
  return c
}

function Page({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id="c48-page" data-testid="c48-page" data-page={id} aria-labelledby="c48-page-title" className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <h2 id="c48-page-title" className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function StartPage() {
  const location = useLocation()
  const blockedFrom = (location.state as { blockedFrom?: string } | null)?.blockedFrom
  return (
    <Page id="start" title="Account setup">
      {blockedFrom && (
        <div id="c48-blocked" data-testid="c48-blocked" role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          Complete the previous steps first. You were sent back from <code>{blockedFrom.replace(BASE, '') || '/'}</code>.
        </div>
      )}
      <p className="text-sm text-muted-foreground">Complete three pages in order: Profile, Preferences and Confirm. Your answers are kept when you move between pages or use the browser back and forward buttons.</p>
      <div>
        <Link id="c48-start" data-testid="c48-start" to={`${BASE}/profile`} className={buttonVariants({ size: 'sm' })}>Start with Profile</Link>
      </div>
    </Page>
  )
}

function Guard({ need, children }: { need: 'profile' | 'preferences'; children: ReactNode }) {
  const { state } = useWf()
  const missing = !state.profileSaved ? 'profile' : need === 'preferences' && !state.prefsSaved ? 'preferences' : null
  if (!missing) return children
  return (
    <Page id="blocked" title="Step locked">
      <div id="c48-blocked" data-testid="c48-blocked" role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
        Complete the previous step first: the {labelOf([...STEPS], missing)} page is not finished yet.
      </div>
      <div>
        <Link id="c48-blocked-link" data-testid="c48-blocked-link" to={`${BASE}/${missing}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Go to {labelOf([...STEPS], missing)}</Link>
      </div>
    </Page>
  )
}

function ProfilePage() {
  const { api, state, patch, setFb, alive } = useWf()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const here = useRef(true)
  useEffect(() => () => { here.current = false }, [])

  const next = async () => {
    if (busy) return
    api.log('Profile: continue pressed')
    if (!state.displayName.trim()) return setFb('error', 'Enter a display name.')
    if (!state.plan) return setFb('error', 'Pick a plan.')
    setBusy(true)
    await api.request(() => null, 'save profile')
    if (!alive()) return
    patch({ profileSaved: true })
    if (!here.current) return // the user already left this page while the save was in flight
    setBusy(false)
    setFb('info', 'Profile saved')
    navigate(`${BASE}/preferences`)
  }

  return (
    <Page id="profile" title="Step 1: Profile">
      <Field label="Display name" htmlFor="c48-name">
        <Input id="c48-name" data-testid="c48-name" value={state.displayName} onChange={(e) => patch({ displayName: e.target.value })} onBlur={() => api.log('Profile: display name entered')} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Plan</legend>
        {PLANS.map((p) => (
          <label key={p.id} htmlFor={`c48-plan-${p.id}`} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="c48-plan"
              id={`c48-plan-${p.id}`}
              data-testid={`c48-plan-${p.id}`}
              value={p.id}
              className="size-4 accent-primary"
              checked={state.plan === p.id}
              onChange={() => { patch({ plan: p.id }); api.log(`Profile: plan ${p.label} selected`) }}
            />
            <span className="font-medium">{p.label}</span>
            <span className="text-muted-foreground">{p.blurb}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button id="c48-profile-next" data-testid="c48-profile-next" disabled={busy} onClick={next}>{busy ? 'Saving…' : 'Continue'}</Button>
      </div>
    </Page>
  )
}

function PreferencesPage() {
  const { api, state, patch, setFb, alive } = useWf()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const here = useRef(true)
  useEffect(() => () => { here.current = false }, [])

  const next = async () => {
    if (busy) return
    api.log('Preferences: continue pressed')
    if (!state.region) return setFb('error', 'Pick a region.')
    setBusy(true)
    await api.request(() => null, 'save preferences')
    if (!alive()) return
    patch({ prefsSaved: true })
    if (!here.current) return
    setBusy(false)
    setFb('info', 'Preferences saved')
    navigate(`${BASE}/confirm`)
  }

  return (
    <Page id="preferences" title="Step 2: Preferences">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Notifications</legend>
        {NOTIFY.map((n) => (
          <label key={n.id} htmlFor={`c48-notify-${n.id}`} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id={`c48-notify-${n.id}`}
              data-testid={`c48-notify-${n.id}`}
              className="size-4 accent-primary"
              checked={state.notify.includes(n.id)}
              onChange={(e) => {
                patch({ notify: e.target.checked ? [...state.notify, n.id] : state.notify.filter((x) => x !== n.id) })
                api.log(`Preferences: ${n.label} ${e.target.checked ? 'enabled' : 'disabled'}`)
              }}
            />
            {n.label}
          </label>
        ))}
      </fieldset>
      <Field label="Region" htmlFor="c48-region">
        <select id="c48-region" data-testid="c48-region" className={SELECT_CLS} value={state.region} onChange={(e) => { patch({ region: e.target.value }); api.log(`Preferences: region ${labelOf(REGIONS, e.target.value) || 'cleared'}`) }}>
          <option value="">Select a region</option>
          {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Link id="c48-prefs-back" data-testid="c48-prefs-back" to={`${BASE}/profile`} className={buttonVariants({ variant: 'outline' })}>Back</Link>
        <Button id="c48-prefs-next" data-testid="c48-prefs-next" disabled={busy} onClick={next}>{busy ? 'Saving…' : 'Continue'}</Button>
      </div>
    </Page>
  )
}

function ConfirmPage() {
  const { api, state, target, patch, setFb, alive } = useWf()
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!api.settings.dynamic)

  // Stress mode: the summary renders late.
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setReady(true), api.delay(600))
    return () => clearTimeout(t)
  }, [api, ready])

  const finish = async () => {
    if (busy || state.finished) return
    api.log('Finish pressed')
    if (!state.code.trim()) return setFb('error', 'Enter the reference code.')
    if (!state.reviewed) return setFb('error', 'Tick the review box first.')
    setBusy(true)
    await api.request(() => null, 'finish workflow')
    if (!alive()) return
    setBusy(false)
    const problems: string[] = []
    if (state.displayName.trim() !== target.displayName) problems.push('display name')
    if (state.plan !== target.plan) problems.push('plan')
    if (!sameSet(state.notify, target.notify)) problems.push('notifications')
    if (state.region !== target.region) problems.push('region')
    if (state.code.trim() !== target.code) problems.push('reference code')
    if (problems.length > 0) {
      setFb('error', `Not finished. Check: ${problems.join(', ')}`)
      api.fail(`Finished with missing or wrong values: ${problems.join(', ')}`)
      return
    }
    patch({ finished: true })
    setFb('success', 'Workflow submitted')
    api.succeed('Workflow finished with correct values')
  }

  return (
    <Page id="confirm" title="Step 3: Confirm">
      {ready ? (
        <dl id="c48-summary" data-testid="c48-summary" aria-label="Summary" className="grid gap-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Display name</dt>
          <dd id="c48-summary-name" data-testid="c48-summary-name" className="min-w-0 break-words font-medium">{state.displayName.trim() || '(empty)'}</dd>
          <dt className="text-muted-foreground">Plan</dt>
          <dd id="c48-summary-plan" data-testid="c48-summary-plan" className="font-medium">{state.plan ? labelOf(PLANS, state.plan) : '(none)'}</dd>
          <dt className="text-muted-foreground">Notifications</dt>
          <dd id="c48-summary-notify" data-testid="c48-summary-notify" className="font-medium">{state.notify.length ? NOTIFY.filter((n) => state.notify.includes(n.id)).map((n) => n.label).join(', ') : '(none)'}</dd>
          <dt className="text-muted-foreground">Region</dt>
          <dd id="c48-summary-region" data-testid="c48-summary-region" className="font-medium">{state.region ? labelOf(REGIONS, state.region) : '(none)'}</dd>
        </dl>
      ) : (
        <p id="c48-summary-loading" role="status" className="text-sm text-muted-foreground">Loading summary…</p>
      )}
      <Field label="Reference code" htmlFor="c48-code">
        <Input id="c48-code" data-testid="c48-code" value={state.code} autoComplete="off" className="sm:w-64" onChange={(e) => patch({ code: e.target.value })} onBlur={() => api.log('Confirm: reference code entered')} />
      </Field>
      <label htmlFor="c48-reviewed" className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id="c48-reviewed"
          data-testid="c48-reviewed"
          className="size-4 accent-primary"
          checked={state.reviewed}
          onChange={(e) => { patch({ reviewed: e.target.checked }); api.log(`Confirm: review box ${e.target.checked ? 'checked' : 'unchecked'}`) }}
        />
        I have reviewed the summary and it is correct
      </label>
      <div className="flex flex-wrap gap-2">
        <Link id="c48-confirm-back" data-testid="c48-confirm-back" to={`${BASE}/preferences`} className={buttonVariants({ variant: 'outline' })}>Back</Link>
        <Button id="c48-finish" data-testid="c48-finish" disabled={busy || !ready || state.finished} onClick={finish}>{state.finished ? 'Finished' : busy ? 'Submitting…' : 'Finish'}</Button>
      </div>
    </Page>
  )
}

export default function C48MultiPageWorkflow({ api, status }: ChallengeProps) {
  const [target] = useState(() => buildTarget(api))
  const [init] = useState(() => load(api.seed, status === 'passed'))
  const [state, setState] = useState<WfState>(init.state)
  const { fb, set } = useFeedback()
  const location = useLocation()
  const navigate = useNavigate()
  const mounted = useRef(true)
  const redirected = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, seed: api.seed }))
  }, [state])

  // No stored state on mount (fresh start or after reset): start from the root page.
  useEffect(() => {
    if (init.existed || redirected.current) return
    redirected.current = true
    const path = location.pathname.replace(/\/+$/, '')
    const guarded = path.endsWith('/preferences') || path.endsWith('/confirm')
    if (path !== BASE) navigate(BASE, { replace: true, state: guarded ? { blockedFrom: path } : null })
  }, [init.existed, location.pathname, navigate])

  const ctx: WfContext = {
    api,
    state,
    target,
    patch: (p) => setState((s) => ({ ...s, ...p })),
    fb,
    setFb: set,
    alive: () => mounted.current,
  }

  const done = [state.profileSaved, state.prefsSaved, state.finished]
  const completed = done.filter(Boolean).length

  return (
    <Ctx.Provider value={ctx}>
      <div className="grid gap-4">
        <Task>
          Page 1 (Profile): set the display name to <Target>{target.displayName}</Target> and pick the <Target>{labelOf(PLANS, target.plan)}</Target> plan. Page 2 (Preferences): enable only the{' '}
          <Target>{labelOf(NOTIFY, target.notify[0])}</Target> and <Target>{labelOf(NOTIFY, target.notify[1])}</Target> notifications and set the region to <Target>{labelOf(REGIONS, target.region)}</Target>.
          Page 3 (Confirm): check the summary, enter the reference code <Target>{target.code}</Target>, tick the review box and press Finish.
        </Task>

        <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
          <nav aria-label="Workflow steps">
            <ol className="flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <NavLink
                    id={`c48-nav-${s.id}`}
                    data-testid={`c48-nav-${s.id}`}
                    to={`${BASE}/${s.id}`}
                    data-done={done[i]}
                    className={({ isActive }) => cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }))}
                  >
                    {done[i] ? <Check aria-hidden /> : <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>}
                    {s.label}
                  </NavLink>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex items-center gap-3">
            <div
              id="c48-progress"
              data-testid="c48-progress"
              role="progressbar"
              aria-label="Workflow progress"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={completed}
              aria-valuetext={`${completed} of 3 steps complete`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${(completed / 3) * 100}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{completed} of 3 complete</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Route: <code id="c48-route" data-testid="c48-route">{location.pathname.replace(BASE, '') || '/'}</code>
          </p>
        </div>

        <Routes>
          <Route index element={<StartPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="preferences" element={<Guard need="profile"><PreferencesPage /></Guard>} />
          <Route path="confirm" element={<Guard need="preferences"><ConfirmPage /></Guard>} />
          <Route
            path="*"
            element={
              <Page id="not-found" title="Page not found">
                <Link id="c48-home" data-testid="c48-home" to={BASE} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Back to start</Link>
              </Page>
            }
          />
        </Routes>

        <Feedback id="c48-feedback" state={fb} />
      </div>
    </Ctx.Provider>
  )
}
