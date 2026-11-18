import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices, Flame, GraduationCap, Play, RotateCcw, Timer } from 'lucide-react'
import { CHALLENGES } from '@/challenges/meta'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { orderFor, useStore } from '@/lib/store'
import { randomSeed } from '@/lib/prng'
import { cn } from '@/lib/utils'
import type { Mode } from '@/lib/types'

const MODES: { key: Mode; title: string; icon: typeof Timer; points: string[] }[] = [
  { key: 'practice', title: 'Practice', icon: GraduationCap, points: ['Unlimited attempts', 'Hints available', 'No time limits', 'Complete any challenge individually'] },
  { key: 'challenge', title: 'Challenge', icon: Timer, points: ['Sequential order, one at a time', 'Per-challenge time limit', 'Limited retries per challenge', 'Final performance score'] },
  { key: 'stress', title: 'Stress test', icon: Flame, points: ['Seeded random challenge order', 'Configurable interaction delays', 'Dynamic elements + layout shifts', 'Optional simulated network latency'] },
]

function NumberField({ id, label, value, min, max, step = 1, onCommit, hint }: { id: string; label: string; value: number; min: number; max: number; step?: number; onCommit: (n: number) => void; hint?: string }) {
  return (
    <label htmlFor={id} className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input id={id} data-testid={id} type="number" min={min} max={max} step={step} value={value} onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onCommit(Math.max(min, Math.min(max, n)))
      }} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function ModesPage() {
  const navigate = useNavigate()
  const mode = useStore((s) => s.mode)
  const settings = useStore((s) => s.settings)
  const run = useStore((s) => s.run)
  const records = useStore((s) => s.records)
  const setMode = useStore((s) => s.setMode)
  const update = useStore((s) => s.updateSettings)
  const startRun = useStore((s) => s.startRun)
  const resetAll = useStore((s) => s.resetAll)
  const [seedDraft, setSeedDraft] = useState(settings.seed)
  const [confirm, setConfirm] = useState<'run' | 'reset' | null>(null)

  const hasProgress = Object.values(records).some((r) => r.attempts > 0 || r.status !== 'idle')

  const begin = () => {
    if (mode === 'practice') return
    startRun(mode)
    setConfirm(null)
    const first = orderFor(mode, settings.seed)[0]
    navigate(`/challenge/${CHALLENGES.find((c) => c.id === first)!.slug}`)
  }

  const applySeed = (s: string) => {
    const v = s.trim()
    if (!v) return
    update({ seed: v })
    setSeedDraft(v)
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modes &amp; settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick how the benchmark runs. Settings and progress persist across reloads. Automation can also configure via URL: <code className="font-mono text-xs">?seed=abc&amp;mode=stress&amp;delay=300&amp;latency=500&amp;autostart=1</code></p>
      </div>

      <div role="radiogroup" aria-label="Mode" className="grid gap-3 md:grid-cols-3">
        {MODES.map(({ key, title, icon: Icon, points }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            id={`mode-${key}`}
            data-testid={`mode-${key}`}
            onClick={() => setMode(key)}
            className={cn('flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors', mode === key ? 'border-foreground/40 bg-accent/60' : 'border-border bg-card hover:bg-accent/30')}
          >
            <span className="flex items-center gap-2 font-medium"><Icon className="size-4" aria-hidden /> {title}</span>
            <ul className="grid gap-1 text-xs text-muted-foreground">
              {points.map((p) => <li key={p}>· {p}</li>)}
            </ul>
          </button>
        ))}
      </div>

      <section aria-label="Seed" className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Deterministic seed</h2>
        <p className="text-xs text-muted-foreground">Every target value, option order and random delay derives from this seed. Same seed gives the same puzzle on every machine, so runs are reproducible.</p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            applySeed(seedDraft)
          }}
        >
          <Input id="seed-input" data-testid="seed-input" aria-label="Seed" className="max-w-xs font-mono" value={seedDraft} onChange={(e) => setSeedDraft(e.target.value)} />
          <Button id="seed-apply" type="submit" variant="outline" size="sm" disabled={!seedDraft.trim() || seedDraft.trim() === settings.seed}>Apply</Button>
          <Button id="seed-random" type="button" variant="ghost" size="sm" onClick={() => applySeed(randomSeed())}><Dices /> Random</Button>
          <span className="text-xs text-muted-foreground">active: <code data-testid="active-seed" className="font-mono text-foreground">{settings.seed}</code></span>
        </form>
        {run && mode !== 'practice' && !run.finishedAt && <p className="text-xs text-amber-400">A run is in progress and keeps its own seed (<code className="font-mono">{run.seed}</code>) until it finishes.</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Challenge mode settings" className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Challenge &amp; stress limits</h2>
          <NumberField id="setting-retries" label="Retries per challenge" value={settings.maxRetries} min={1} max={20} onCommit={(n) => update({ maxRetries: n })} hint="Failed attempts allowed before the challenge is failed." />
          <NumberField id="setting-limit" label="Time limit per challenge (s)" value={settings.timeLimitSec} min={0} max={1800} onCommit={(n) => update({ timeLimitSec: n })} hint="0 disables the limit." />
        </section>
        <section aria-label="Stress mode settings" className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Stress mode</h2>
          <NumberField id="setting-delay" label="Interaction delay (ms)" value={settings.delayMs} min={0} max={10000} step={50} onCommit={(n) => update({ delayMs: n })} hint="Added to delayed renders and artificial timers." />
          <NumberField id="setting-latency" label="Simulated network latency (ms)" value={settings.latencyMs} min={0} max={10000} step={50} onCommit={(n) => update({ latencyMs: n })} hint="Added to every simulated request." />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span><span className="font-medium">Dynamic elements</span><span className="block text-xs text-muted-foreground">Late layout shifts and mid-task re-renders.</span></span>
            <Switch id="setting-dynamic" data-testid="setting-dynamic" aria-label="Dynamic elements" checked={settings.dynamic} onCheckedChange={(v) => update({ dynamic: v })} />
          </label>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === 'practice' ? (
          <Button id="start-practice" size="sm" onClick={() => navigate(`/challenge/${CHALLENGES[0].slug}`)}><Play /> Open first challenge</Button>
        ) : (
          <Button id="start-run" data-testid="start-run" size="sm" onClick={() => (hasProgress ? setConfirm('run') : begin())}><Play /> Start {mode} run</Button>
        )}
        <Button id="reset-all" variant="outline" size="sm" disabled={!hasProgress && !run} onClick={() => setConfirm('reset')}><RotateCcw /> Reset all progress</Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === 'run' ? `Start a new ${mode} run?` : 'Reset all progress?'}</DialogTitle>
            <DialogDescription>
              {confirm === 'run' ? 'Existing progress is cleared and a fresh run begins with the current seed.' : 'This clears every record and the current run. The activity log is kept.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button id="confirm-cancel" variant="outline" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              id="confirm-ok"
              size="sm"
              onClick={() => {
                if (confirm === 'run') begin()
                else {
                  resetAll()
                  setConfirm(null)
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
