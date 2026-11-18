import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const TABS = [
  { key: 'overview', name: 'Overview', text: 'A summary of the workspace, its members and recent changes.' },
  { key: 'usage', name: 'Usage', text: 'Requests, storage and bandwidth for the current billing cycle.' },
  { key: 'billing', name: 'Billing', text: 'Invoices, payment methods and the next renewal date.' },
  { key: 'security', name: 'Security', text: 'Sign-in policies, active sessions and audit settings.' },
  { key: 'activity', name: 'Activity', text: 'A chronological feed of actions performed in this workspace.' },
]
const DECOY_LABELS = ['Invoice code', 'Support pin', 'Build tag', 'Region code', 'Ticket ref']
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export default function C37Tabs({ api }: ChallengeProps) {
  const spec = useMemo(() => {
    const r = api.rng('tabs')
    const hiddenKey = r.pick(TABS.slice(1)).key
    const labels = r.shuffle(DECOY_LABELS)
    const lines: Record<string, { label: string; value: string }> = {}
    TABS.forEach((t, i) => {
      lines[t.key] = t.key === hiddenKey ? { label: 'Access code', value: r.string(6, ALPHABET) } : { label: labels[i], value: r.string(6, ALPHABET) }
    })
    return { hiddenKey, lines, secret: lines[hiddenKey].value }
  }, [api])

  const [tab, setTab] = useState('overview')
  const [loaded, setLoaded] = useState<string[]>([])
  const [answer, setAnswer] = useState('')
  const { fb, set } = useFeedback()

  useEffect(() => {
    if (loaded.includes(tab)) return
    const t = setTimeout(() => setLoaded((l) => [...l, tab]), api.delay(300))
    return () => clearTimeout(t)
  }, [tab, loaded, api])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = answer.trim()
    if (!value) {
      set('info', 'Enter the access code first.')
      return
    }
    api.log(`Submitted answer "${value}"`)
    if (value === spec.secret) {
      set('success', 'Access code accepted.')
      api.succeed('Access code entered')
    } else {
      set('error', `Wrong access code: ${value}`)
      api.fail(`Wrong access code "${value}"`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Look through every tab and find the line labelled <Target>Access code</Target>. Type its value into the answer field and submit.
      </Task>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v)
          api.log(`Tab opened: ${v}`)
        }}
      >
        <TabsList id="c37-tablist" data-testid="c37-tablist" aria-label="Sections" className="h-auto w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} id={`c37-tab-${t.key}`} data-testid={`c37-tab-${t.key}`} aria-controls={`c37-tabpanel-${t.key}`} className="flex-none px-3">
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent
            key={t.key}
            value={t.key}
            id={`c37-tabpanel-${t.key}`}
            data-testid={`c37-tabpanel-${t.key}`}
            aria-labelledby={`c37-tab-${t.key}`}
            data-loaded={loaded.includes(t.key)}
            className="min-h-24 rounded-lg border border-border bg-card p-4"
          >
            {loaded.includes(t.key) ? (
              <div className="grid gap-2">
                <p className="text-muted-foreground">{t.text}</p>
                <p>
                  {spec.lines[t.key].label}: <code className="font-mono font-medium">{spec.lines[t.key].value}</code>
                </p>
              </div>
            ) : (
              <div className="grid gap-2" role="status" aria-label="Loading tab content">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label="Answer" htmlFor="c37-answer" className="min-w-0 flex-1 basis-48">
          <Input id="c37-answer" data-testid="c37-answer" value={answer} autoComplete="off" spellCheck={false} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        <Button id="c37-submit" data-testid="c37-submit" type="submit">
          Submit
        </Button>
      </form>
      <Feedback state={fb} id="c37-feedback" />
    </div>
  )
}
