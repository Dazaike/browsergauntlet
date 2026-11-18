import { useEffect, useRef, useState } from 'react'
import { Check, Eye, EyeOff, Minus, UserCheck } from 'lucide-react'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { nativeField } from './nativeFieldStyles'

const FREQS = ['Daily', 'Weekly', 'Monthly', 'Never'] as const
const INTERESTS = ['Music', 'Travel', 'Sports', 'Gaming', 'Cooking', 'Photography'] as const
const THEMES = ['System', 'Light', 'Dark'] as const

type UsernameStatus = 'empty' | 'invalid' | 'checking' | 'available' | 'taken'

const USERNAME_RE = /^[a-z0-9_]{3,16}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function buildPuzzle(api: ChallengeApi) {
  const r = api.rng('target')
  const word = r.word()
  const num = r.int(10, 89)
  const username = `${word}_${num}`
  const email = `${r.word()}${r.digits(2)}@example.com`
  const freq = r.pick(FREQS)
  const interests = r.sample(INTERESTS, r.int(2, 3)).sort((a, b) => INTERESTS.indexOf(a) - INTERESTS.indexOf(b))
  const theme = r.pick(THEMES)
  const taken = ['admin', 'root', 'support', 'guest', word, `${word}_${num + 1}`, `${word}_${num - 1}`, `${word}${num}`, `the_${word}_${num}`]
  return { username, email, freq, interests, theme, taken }
}

function passwordRules(pw: string, username: string) {
  return [
    { key: 'length', label: 'At least 12 characters', ok: pw.length >= 12 },
    { key: 'upper', label: 'An uppercase letter', ok: /[A-Z]/.test(pw) },
    { key: 'lower', label: 'A lowercase letter', ok: /[a-z]/.test(pw) },
    { key: 'digit', label: 'A digit', ok: /\d/.test(pw) },
    { key: 'symbol', label: 'A symbol (not a letter or digit)', ok: /[^A-Za-z0-9]/.test(pw) },
    { key: 'username', label: 'Does not contain the username', ok: pw.length > 0 && (username === '' || !pw.toLowerCase().includes(username.toLowerCase())) },
  ]
}

const sameSet = (a: string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

export default function C42AccountRegistration({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => buildPuzzle(api))
  const [username, setUsername] = useState('')
  const [uStatus, setUStatus] = useState<UsernameStatus>('empty')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [freq, setFreq] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [theme, setTheme] = useState('')
  const [terms, setTerms] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [prefsReady, setPrefsReady] = useState(!api.settings.dynamic)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setPrefsReady(true), api.delay(800))
    return () => clearTimeout(t)
  }, [api])

  const isTaken = (u: string) => puzzle.taken.includes(u)

  // Debounced async availability check.
  useEffect(() => {
    if (username === '') { setUStatus('empty'); return }
    if (!USERNAME_RE.test(username)) { setUStatus('invalid'); return }
    setUStatus('checking')
    let cancelled = false
    const t = setTimeout(() => {
      void api.request(() => isTaken(username), `username availability: ${username}`).then((taken) => {
        if (cancelled || !mounted.current) return
        setUStatus(taken ? 'taken' : 'available')
        api.log(`Username "${username}" is ${taken ? 'taken' : 'available'}`)
      })
    }, api.delay(400))
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  const rules = passwordRules(password, username)
  const rulesOk = rules.every((r) => r.ok)
  const confirmOk = confirm.length > 0 && confirm === password
  const emailOk = EMAIL_RE.test(email.trim())
  const locked = done || status === 'failed'

  const usernameMsg: Record<UsernameStatus, string> = {
    empty: '',
    invalid: 'Use 3–16 characters: lowercase letters, digits and underscore.',
    checking: 'Checking availability…',
    available: 'Username is available.',
    taken: 'That username is already taken.',
  }

  const toggleInterest = (name: string, on: boolean) => {
    setInterests((cur) => (on ? [...cur, name] : cur.filter((x) => x !== name)))
    api.log(`Interest ${name} ${on ? 'checked' : 'unchecked'}`)
  }

  const submit = async () => {
    if (submitting || locked) return
    setAttempted(true)
    setSubmitting(true)
    api.log('Registration submitted')
    let uState = uStatus
    if (USERNAME_RE.test(username) && uState !== 'available' && uState !== 'taken') {
      uState = (await api.request(() => isTaken(username), `username availability: ${username}`)) ? 'taken' : 'available'
      if (!mounted.current) return
      setUStatus(uState)
    }
    await api.request(() => null, 'register account')
    if (!mounted.current) return
    setSubmitting(false)

    const failing: string[] = []
    if (!USERNAME_RE.test(username)) failing.push('username format')
    else if (uState === 'taken') failing.push('username taken')
    if (!emailOk) failing.push('email format')
    if (!rulesOk) failing.push('password rules')
    if (!confirmOk) failing.push('password confirmation')
    if (!terms) failing.push('terms not accepted')
    if (failing.length > 0) {
      const reason = `Registration rejected: ${failing.join(', ')}`
      set('error', reason)
      api.fail(reason)
      return
    }
    const wrong: string[] = []
    if (username !== puzzle.username) wrong.push('username')
    if (email.trim() !== puzzle.email) wrong.push('email')
    if (freq !== puzzle.freq) wrong.push('newsletter frequency')
    if (!sameSet(interests, puzzle.interests)) wrong.push('interests')
    if (theme !== puzzle.theme) wrong.push('theme')
    if (wrong.length > 0) {
      const reason = `Registration submitted with wrong values: ${wrong.join(', ')}`
      set('error', reason)
      api.fail(reason)
      return
    }
    setDone(true)
    set('success', `Account ${username} registered`)
    api.succeed(`registered ${username}`)
  }

  const showErr = (cond: boolean, msg: string) => (attempted && cond ? msg : undefined)

  return (
    <div className="grid gap-4">
      <Task>
        Register with username <Target>{puzzle.username}</Target> and email <Target>{puzzle.email}</Target>. Choose a password that meets every rule and confirm it.
        Set newsletter frequency to <Target>{puzzle.freq}</Target>, tick exactly these interests:{' '}
        {puzzle.interests.map((i, n) => (<span key={i}>{n > 0 && ', '}<Target>{i}</Target></span>))}
        , set the theme to <Target>{puzzle.theme}</Target>, accept the terms and submit.
      </Task>

      <form noValidate className="grid gap-4 rounded-lg border border-border bg-card p-3 sm:p-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor={`${api.id}-username`} error={showErr(uStatus === 'empty', 'Enter a username.')}>
            <Input
              id={`${api.id}-username`}
              data-testid={`${api.id}-username`}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              disabled={locked}
              aria-describedby={`${api.id}-username-status`}
              aria-invalid={uStatus === 'taken' || uStatus === 'invalid' ? true : undefined}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => username && api.log(`Username entered: ${username}`)}
            />
            <p
              id={`${api.id}-username-status`}
              data-testid={`${api.id}-username-status`}
              data-status={uStatus}
              role="status"
              aria-live="polite"
              className={cn('min-h-4 text-xs', uStatus === 'available' && 'text-emerald-500', (uStatus === 'taken' || uStatus === 'invalid') && 'text-red-500', (uStatus === 'checking' || uStatus === 'empty') && 'text-muted-foreground')}
            >
              {usernameMsg[uStatus]}
            </p>
          </Field>
          <Field label="Email" htmlFor={`${api.id}-email`} error={showErr(!emailOk, 'Enter a valid email address.')}>
            <Input
              id={`${api.id}-email`}
              data-testid={`${api.id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              disabled={locked}
              aria-invalid={attempted && !emailOk ? true : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => email && api.log('Email entered')}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Field label="Password" htmlFor={`${api.id}-password`}>
              <div className="flex gap-2">
                <Input
                  id={`${api.id}-password`}
                  data-testid={`${api.id}-password`}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  disabled={locked}
                  aria-describedby={`${api.id}-rules`}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => password && api.log('Password entered')}
                />
                <Button
                  id={`${api.id}-toggle-password`}
                  data-testid={`${api.id}-toggle-password`}
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={show}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => { setShow((s) => !s); api.log(`Password ${show ? 'hidden' : 'shown'}`) }}
                >
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </Field>
            <ul id={`${api.id}-rules`} data-testid={`${api.id}-rules`} aria-label="Password rules" className="grid gap-1 text-xs">
              {rules.map((r) => (
                <li key={r.key} id={`${api.id}-rule-${r.key}`} data-testid={`${api.id}-rule-${r.key}`} data-met={r.ok} className={cn('flex items-center gap-1.5', r.ok ? 'text-emerald-500' : 'text-muted-foreground')}>
                  {r.ok ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                  <span>{r.label}</span>
                  <span className="sr-only">{r.ok ? '(met)' : '(not met)'}</span>
                </li>
              ))}
            </ul>
          </div>
          <Field
            label="Confirm password"
            htmlFor={`${api.id}-confirm`}
            error={confirm.length > 0 && confirm !== password ? 'Passwords do not match.' : showErr(confirm.length === 0, 'Confirm the password.')}
          >
            <Input
              id={`${api.id}-confirm`}
              data-testid={`${api.id}-confirm`}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              disabled={locked}
              aria-invalid={confirm.length > 0 && confirm !== password ? true : undefined}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>

        {prefsReady ? (
          <div id={`${api.id}-preferences`} className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <fieldset className="grid content-start gap-1.5" disabled={locked}>
              <legend className="mb-1 text-sm font-medium">Newsletter frequency</legend>
              {FREQS.map((f) => (
                <label key={f} htmlFor={`${api.id}-freq-${f.toLowerCase()}`} className="flex items-center gap-2 text-sm">
                  <input
                    id={`${api.id}-freq-${f.toLowerCase()}`}
                    data-testid={`${api.id}-freq-${f.toLowerCase()}`}
                    type="radio"
                    name={`${api.id}-freq`}
                    value={f}
                    checked={freq === f}
                    className="size-4 accent-primary"
                    onChange={() => { setFreq(f); api.log(`Newsletter frequency: ${f}`) }}
                  />
                  {f}
                </label>
              ))}
            </fieldset>
            <fieldset className="grid content-start gap-1.5" disabled={locked}>
              <legend className="mb-1 text-sm font-medium">Interests</legend>
              {INTERESTS.map((i) => (
                <label key={i} htmlFor={`${api.id}-interest-${i.toLowerCase()}`} className="flex items-center gap-2 text-sm">
                  <input
                    id={`${api.id}-interest-${i.toLowerCase()}`}
                    data-testid={`${api.id}-interest-${i.toLowerCase()}`}
                    type="checkbox"
                    name={`${api.id}-interests`}
                    value={i}
                    checked={interests.includes(i)}
                    className="size-4 accent-primary"
                    onChange={(e) => toggleInterest(i, e.target.checked)}
                  />
                  {i}
                </label>
              ))}
            </fieldset>
            <Field label="Theme" htmlFor={`${api.id}-theme`} className="content-start">
              <select
                id={`${api.id}-theme`}
                data-testid={`${api.id}-theme`}
                className={nativeField}
                value={theme}
                disabled={locked}
                onChange={(e) => { setTheme(e.target.value); api.log(`Theme: ${e.target.value || 'none'}`) }}
              >
                <option value="">Choose a theme</option>
                {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        ) : (
          <p id={`${api.id}-preferences-loading`} role="status" className="border-t border-border pt-4 text-sm text-muted-foreground">Loading preferences…</p>
        )}

        <div className="grid gap-1.5 border-t border-border pt-4">
          <label htmlFor={`${api.id}-terms`} className="flex items-center gap-2 text-sm">
            <input
              id={`${api.id}-terms`}
              data-testid={`${api.id}-terms`}
              type="checkbox"
              checked={terms}
              disabled={locked}
              className="size-4 accent-primary"
              onChange={(e) => { setTerms(e.target.checked); api.log(`Terms ${e.target.checked ? 'accepted' : 'unaccepted'}`) }}
            />
            I accept the terms of service
          </label>
          {attempted && !terms && <p role="alert" className="text-xs text-red-500">You must accept the terms.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="submit" disabled={locked || submitting}>
            {submitting ? 'Submitting…' : 'Create account'}
          </Button>
        </div>
      </form>

      <Feedback state={fb} id={`${api.id}-feedback`} />

      {done && (
        <div id={`${api.id}-created`} data-testid={`${api.id}-created`} role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <UserCheck className="size-5 text-emerald-500" aria-hidden /> Account <span className="font-mono">{username}</span> created.
        </div>
      )}
    </div>
  )
}
