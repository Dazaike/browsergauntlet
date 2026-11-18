import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

interface Settings {
  displayName: string
  email: string
  role: string
  notifyEmail: boolean
  notifyPush: boolean
  digest: string
  visibility: string
  twoFactor: boolean
  retention: number
  theme: string
  density: string
  fontSize: number
}

type TabId = 'profile' | 'notifications' | 'privacy' | 'appearance'

const TABS: { id: TabId; label: string; keys: (keyof Settings)[] }[] = [
  { id: 'profile', label: 'Profile', keys: ['displayName', 'email', 'role'] },
  { id: 'notifications', label: 'Notifications', keys: ['notifyEmail', 'notifyPush', 'digest'] },
  { id: 'privacy', label: 'Privacy', keys: ['visibility', 'twoFactor', 'retention'] },
  { id: 'appearance', label: 'Appearance', keys: ['theme', 'density', 'fontSize'] },
]

const DEFAULTS: Settings = {
  displayName: 'Alex Morgan',
  email: 'alex.morgan@example.test',
  role: 'developer',
  notifyEmail: true,
  notifyPush: false,
  digest: 'daily',
  visibility: 'team',
  twoFactor: false,
  retention: 90,
  theme: 'system',
  density: 'comfortable',
  fontSize: 14,
}

const ROLES = [['developer', 'Developer'], ['designer', 'Designer'], ['manager', 'Manager'], ['analyst', 'Analyst'], ['support', 'Support lead']] as const
const DIGESTS = [['realtime', 'Real-time'], ['daily', 'Daily'], ['weekly', 'Weekly']] as const
const VISIBILITY = [['public', 'Public'], ['team', 'Team only'], ['private', 'Private']] as const
const THEMES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as const
const DENSITIES = [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']] as const
const RETENTIONS = [30, 60, 120, 180, 360]
const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:w-64'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const labelOf = (list: readonly (readonly [string, string])[], v: string) => list.find(([k]) => k === v)?.[1] ?? v
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const FIELD_LABEL: Record<keyof Settings, string> = {
  displayName: 'Display name', email: 'Email', role: 'Role', notifyEmail: 'Email notifications', notifyPush: 'Push notifications',
  digest: 'Digest frequency', visibility: 'Profile visibility', twoFactor: 'Two-factor', retention: 'Data retention',
  theme: 'Theme', density: 'Density', fontSize: 'Font size',
}

function buildTarget(api: ChallengeProps['api']): Pick<Settings, 'displayName' | 'role' | 'notifyEmail' | 'digest' | 'visibility' | 'retention' | 'theme'> {
  const rng = api.rng('target')
  const [a, b] = rng.sample(['amber', 'cedar', 'delta', 'ember', 'falcon', 'garnet', 'harbor', 'indigo', 'juniper', 'kestrel'], 2)
  return {
    displayName: `${cap(a)} ${cap(b)}`,
    role: rng.pick(ROLES.filter(([k]) => k !== DEFAULTS.role))[0],
    notifyEmail: !DEFAULTS.notifyEmail,
    digest: rng.pick(DIGESTS.filter(([k]) => k !== DEFAULTS.digest))[0],
    visibility: rng.pick(VISIBILITY.filter(([k]) => k !== DEFAULTS.visibility))[0],
    retention: rng.pick(RETENTIONS),
    theme: rng.pick(THEMES.filter(([k]) => k !== DEFAULTS.theme))[0],
  }
}

function validate(s: Settings): Partial<Record<keyof Settings, string>> {
  const e: Partial<Record<keyof Settings, string>> = {}
  const name = s.displayName.trim()
  if (name.length < 2 || name.length > 40) e.displayName = 'Display name must be 2 to 40 characters.'
  if (!EMAIL_RE.test(s.email.trim())) e.email = 'Enter a valid email address.'
  if (!ROLES.some(([k]) => k === s.role)) e.role = 'Choose a role.'
  if (!DIGESTS.some(([k]) => k === s.digest)) e.digest = 'Choose a digest frequency.'
  if (!VISIBILITY.some(([k]) => k === s.visibility)) e.visibility = 'Choose a visibility.'
  if (!Number.isInteger(s.retention) || s.retention < 30 || s.retention > 360 || s.retention % 30 !== 0) e.retention = 'Retention must be 30 to 360 days in steps of 30.'
  if (!THEMES.some(([k]) => k === s.theme)) e.theme = 'Choose a theme.'
  if (!DENSITIES.some(([k]) => k === s.density)) e.density = 'Choose a density.'
  if (!Number.isInteger(s.fontSize) || s.fontSize < 12 || s.fontSize > 20) e.fontSize = 'Font size must be 12 to 20.'
  return e
}

export default function C46SettingsDashboard({ api }: ChallengeProps) {
  const [target] = useState(() => buildTarget(api))
  const [saved, setSaved] = useState<Settings>(DEFAULTS)
  const [draft, setDraft] = useState<Settings>(DEFAULTS)
  const [tab, setTab] = useState<TabId>('profile')
  const [errors, setErrors] = useState<Partial<Record<keyof Settings, string>>>({})
  const [saving, setSaving] = useState(false)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      pending.forEach(clearTimeout)
    }
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K], logText: string, debounce = false) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
    const t = timers.current
    clearTimeout(t.get(key))
    if (debounce) t.set(key, setTimeout(() => api.log(logText), 400))
    else api.log(logText)
  }

  const dirtyKeys = (Object.keys(DEFAULTS) as (keyof Settings)[]).filter((k) => draft[k] !== saved[k])
  const dirty = dirtyKeys.length > 0

  const save = async () => {
    if (saving || !dirty) return
    const snapshot: Settings = { ...draft, displayName: draft.displayName.trim(), email: draft.email.trim() }
    const errs = validate(snapshot)
    setErrors(errs)
    api.log(`Save all pressed (${dirtyKeys.length} changed fields)`)
    if (Object.values(errs).some(Boolean)) {
      const first = TABS.find((t) => t.keys.some((k) => errs[k]))
      if (first) setTab(first.id)
      set('error', 'Fix the highlighted fields before saving.')
      return
    }
    setSaving(true)
    await api.request(() => null, 'save settings')
    if (!mounted.current) return
    setSaving(false)
    setSaved(snapshot)
    // keep anything the user typed while the save was in flight; only adopt the trimmed values for untouched fields
    setDraft((d) => ({ ...d, displayName: d.displayName === draft.displayName ? snapshot.displayName : d.displayName, email: d.email === draft.email ? snapshot.email : d.email }))
    const wrong = (Object.keys(target) as (keyof typeof target)[]).filter((k) => snapshot[k] !== target[k])
    if (wrong.length > 0) {
      const names = wrong.map((k) => FIELD_LABEL[k]).join(', ')
      set('error', `Settings saved, but do not match the task: ${names}`)
      api.fail(`Saved settings differ from the target: ${names}`)
      return
    }
    set('success', 'All settings saved')
    api.succeed('All target settings saved')
  }

  const discard = () => {
    setDraft(saved)
    setErrors({})
    api.log('Discarded unsaved changes')
    set('info', 'Unsaved changes discarded')
  }

  const tabDirty = (id: TabId) => TABS.find((t) => t.id === id)!.keys.filter((k) => draft[k] !== saved[k]).length

  return (
    <div className="grid gap-4">
      <Task>
        Across the tabs set the display name to <Target>{target.displayName}</Target>, role to <Target>{labelOf(ROLES, target.role)}</Target>, email notifications{' '}
        <Target>{target.notifyEmail ? 'on' : 'off'}</Target>, digest frequency to <Target>{labelOf(DIGESTS, target.digest)}</Target>, profile visibility to{' '}
        <Target>{labelOf(VISIBILITY, target.visibility)}</Target>, data retention to <Target>{String(target.retention)}</Target> days and theme to{' '}
        <Target>{labelOf(THEMES, target.theme)}</Target>. Then press Save all.
      </Task>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="c46-unsaved"
          data-testid="c46-unsaved"
          data-dirty={dirty}
          role="status"
          className={dirty ? 'rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-sm text-amber-500' : 'rounded-md border border-border px-2.5 py-1 text-sm text-muted-foreground'}
        >
          {dirty ? `Unsaved changes (${dirtyKeys.length})` : 'All changes saved'}
        </p>
        <div className="flex gap-2">
          <Button id="c46-discard" data-testid="c46-discard" variant="outline" size="sm" disabled={!dirty || saving} onClick={discard}>Discard changes</Button>
          <Button id="c46-save" data-testid="c46-save" size="sm" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save all'}</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabId); api.log(`Opened ${v} tab`) }}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} id={`c46-tab-${t.id}`} data-testid={`c46-tab-${t.id}`} data-dirty={tabDirty(t.id) > 0}>
              {t.label}
              {tabDirty(t.id) > 0 && <span aria-label={`${tabDirty(t.id)} unsaved`} className="ml-1.5 size-1.5 rounded-full bg-amber-500" />}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="grid gap-4 rounded-lg border border-border bg-card p-4">
          <Field label="Display name" htmlFor="c46-name" error={errors.displayName}>
            <Input id="c46-name" data-testid="c46-name" value={draft.displayName} aria-invalid={!!errors.displayName} onChange={(e) => update('displayName', e.target.value, `Display name edited to "${e.target.value}"`, true)} />
          </Field>
          <Field label="Email" htmlFor="c46-email" error={errors.email}>
            <Input id="c46-email" data-testid="c46-email" type="email" value={draft.email} aria-invalid={!!errors.email} onChange={(e) => update('email', e.target.value, 'Email edited', true)} />
          </Field>
          <Field label="Role" htmlFor="c46-role" error={errors.role}>
            <select id="c46-role" data-testid="c46-role" className={SELECT_CLS} value={draft.role} onChange={(e) => update('role', e.target.value, `Role set to ${labelOf(ROLES, e.target.value)}`)}>
              {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </TabsContent>

        <TabsContent value="notifications" className="grid gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="c46-notify-email" className="text-sm font-medium">Email notifications</label>
            <Switch id="c46-notify-email" data-testid="c46-notify-email" checked={draft.notifyEmail} onCheckedChange={(v) => update('notifyEmail', v, `Email notifications ${v ? 'on' : 'off'}`)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="c46-notify-push" className="text-sm font-medium">Push notifications</label>
            <Switch id="c46-notify-push" data-testid="c46-notify-push" checked={draft.notifyPush} onCheckedChange={(v) => update('notifyPush', v, `Push notifications ${v ? 'on' : 'off'}`)} />
          </div>
          <fieldset className="grid gap-2" aria-describedby={errors.digest ? 'c46-digest-error' : undefined}>
            <legend className="mb-1 text-sm font-medium">Digest frequency</legend>
            <RadioGroup id="c46-digest" data-testid="c46-digest" aria-label="Digest frequency" value={draft.digest} onValueChange={(v) => update('digest', v, `Digest set to ${labelOf(DIGESTS, v)}`)}>
              {DIGESTS.map(([k, l]) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem id={`c46-digest-${k}`} data-testid={`c46-digest-${k}`} value={k} />
                  <label htmlFor={`c46-digest-${k}`} className="text-sm">{l}</label>
                </div>
              ))}
            </RadioGroup>
            {errors.digest && <p id="c46-digest-error" role="alert" className="text-xs text-red-500">{errors.digest}</p>}
          </fieldset>
        </TabsContent>

        <TabsContent value="privacy" className="grid gap-4 rounded-lg border border-border bg-card p-4">
          <Field label="Profile visibility" htmlFor="c46-visibility" error={errors.visibility}>
            <select id="c46-visibility" data-testid="c46-visibility" className={SELECT_CLS} value={draft.visibility} onChange={(e) => update('visibility', e.target.value, `Visibility set to ${labelOf(VISIBILITY, e.target.value)}`)}>
              {VISIBILITY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="c46-twofactor" className="text-sm font-medium">Two-factor authentication</label>
            <Switch id="c46-twofactor" data-testid="c46-twofactor" checked={draft.twoFactor} onCheckedChange={(v) => update('twoFactor', v, `Two-factor ${v ? 'on' : 'off'}`)} />
          </div>
          <Field label="Data retention (days)" htmlFor="c46-retention" error={errors.retention} hint="30 to 360 days, in steps of 30.">
            <div className="flex items-center gap-3">
              <input
                id="c46-retention"
                data-testid="c46-retention"
                type="range"
                min={30}
                max={360}
                step={30}
                value={draft.retention}
                aria-valuetext={`${draft.retention} days`}
                className="w-full max-w-xs accent-primary"
                onChange={(e) => update('retention', Number(e.target.value), `Retention set to ${e.target.value} days`, true)}
              />
              <output id="c46-retention-value" data-testid="c46-retention-value" htmlFor="c46-retention" className="w-20 font-mono text-sm tabular-nums">{draft.retention} days</output>
            </div>
          </Field>
        </TabsContent>

        <TabsContent value="appearance" className="grid gap-4 rounded-lg border border-border bg-card p-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Theme</legend>
            <RadioGroup id="c46-theme" data-testid="c46-theme" aria-label="Theme" value={draft.theme} onValueChange={(v) => update('theme', v, `Theme set to ${labelOf(THEMES, v)}`)}>
              {THEMES.map(([k, l]) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem id={`c46-theme-${k}`} data-testid={`c46-theme-${k}`} value={k} />
                  <label htmlFor={`c46-theme-${k}`} className="text-sm">{l}</label>
                </div>
              ))}
            </RadioGroup>
            {errors.theme && <p role="alert" className="text-xs text-red-500">{errors.theme}</p>}
          </fieldset>
          <Field label="Density" htmlFor="c46-density" error={errors.density}>
            <select id="c46-density" data-testid="c46-density" className={SELECT_CLS} value={draft.density} onChange={(e) => update('density', e.target.value, `Density set to ${labelOf(DENSITIES, e.target.value)}`)}>
              {DENSITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Font size (px)" htmlFor="c46-fontsize" error={errors.fontSize}>
            <div className="flex items-center gap-3">
              <input
                id="c46-fontsize"
                data-testid="c46-fontsize"
                type="range"
                min={12}
                max={20}
                step={1}
                value={draft.fontSize}
                className="w-full max-w-xs accent-primary"
                onChange={(e) => update('fontSize', Number(e.target.value), `Font size set to ${e.target.value}px`, true)}
              />
              <output id="c46-fontsize-value" data-testid="c46-fontsize-value" htmlFor="c46-fontsize" className="w-16 font-mono text-sm tabular-nums">{draft.fontSize}px</output>
            </div>
          </Field>
        </TabsContent>
      </Tabs>

      <Feedback id="c46-feedback" state={fb} />

      <section aria-label="Saved settings" className="grid gap-1.5">
        <h2 className="text-sm font-medium">Saved snapshot</h2>
        <pre id="c46-saved" data-testid="c46-saved" className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">{JSON.stringify(saved, null, 2)}</pre>
      </section>
    </div>
  )
}
