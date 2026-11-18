import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const TARGET_LABELS = ['Launch', 'Deploy', 'Publish', 'Activate', 'Release']
const DECOY_LABELS = ['Cancel', 'Skip', 'Preview', 'Remind me later', 'Save draft', 'Discard']

export default function C38DelayedElements({ api }: ChallengeProps) {
  const [spec] = useState(() => {
    const r = api.rng('spec')
    return {
      label: r.pick(TARGET_LABELS),
      decoys: r.sample(DECOY_LABELS, 2),
      slot: r.int(0, 2),
      waitMs: api.delay(2500 + r.int(0, 1500)),
    }
  })
  const [ready, setReady] = useState(false)
  const { fb, set } = useFeedback()

  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true)
      api.log('Delayed button rendered')
    }, spec.waitMs)
    return () => clearTimeout(t)
  }, [spec.waitMs, api])

  const click = (label: string, isTarget: boolean) => {
    api.log(`Clicked "${label}"`)
    if (isTarget) {
      set('success', `"${label}" clicked.`)
      api.succeed(`"${label}" clicked after it rendered`)
    } else {
      set('error', `Wrong button: ${label}`)
      api.fail(`Clicked decoy "${label}"`)
    }
  }

  const slots: ('target' | 0 | 1)[] = [0, 1]
  slots.splice(spec.slot, 0, 'target')

  return (
    <div className="grid gap-4">
      <Task>
        Wait for the <Target>{spec.label}</Target> button to appear, then click it. Do not click the other buttons.
      </Task>
      <div id="c38-container" data-testid="c38-container" data-ready={ready} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        {slots.map((s) =>
          s === 'target' ? (
            ready ? (
              <Button key="target" id="c38-target" data-testid="c38-target" onClick={() => click(spec.label, true)}>
                {spec.label}
              </Button>
            ) : (
              <Skeleton key="target" id="c38-skeleton" data-testid="c38-skeleton" aria-hidden className="h-9 w-24" />
            )
          ) : (
            <Button key={`decoy-${s}`} id={`c38-decoy-${s + 1}`} data-testid={`c38-decoy-${s + 1}`} variant="outline" onClick={() => click(spec.decoys[s], false)}>
              {spec.decoys[s]}
            </Button>
          ),
        )}
      </div>
      <p id="c38-status" data-testid="c38-status" role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {ready ? `Loaded: the "${spec.label}" button is available.` : 'Loading content...'}
      </p>
      <Feedback state={fb} id="c38-feedback" />
    </div>
  )
}
