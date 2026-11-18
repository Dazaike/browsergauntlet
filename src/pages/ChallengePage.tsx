import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ChallengeShell } from '@/challenges/ChallengeShell'
import { CHALLENGES, findChallenge } from '@/challenges/meta'
import { COMPONENTS } from '@/challenges/registry'
import { Button } from '@/components/ui/button'
import { useGate } from '@/lib/hooks'
import { useStore } from '@/lib/store'

function GateNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div data-testid="gate" className="mx-auto mt-10 grid max-w-lg gap-3 rounded-lg border border-border bg-card p-6 text-sm">
      <p className="flex items-center gap-2 text-base font-medium"><Lock className="size-4" aria-hidden /> {title}</p>
      {children}
    </div>
  )
}

export function ChallengePage() {
  const { slug } = useParams()
  const meta = findChallenge(slug)
  const mode = useStore((s) => s.mode)
  const run = useStore((s) => s.run)
  const gate = useGate(meta?.id ?? '')

  if (!meta) {
    return (
      <GateNotice title="Challenge not found">
        <p className="text-muted-foreground">No challenge with slug “{slug}”.</p>
        <Button asChild variant="outline" size="sm"><Link to="/challenges">Browse challenges</Link></Button>
      </GateNotice>
    )
  }
  const Component = COMPONENTS[meta.id]
  if (!Component) {
    return (
      <GateNotice title="Challenge unavailable">
        <p className="text-muted-foreground">Challenge {meta.id} has no registered component.</p>
      </GateNotice>
    )
  }

  if (gate.kind === 'needs-run') {
    return (
      <GateNotice title={`${mode === 'challenge' ? 'Challenge' : 'Stress'} mode needs a run`}>
        <p className="text-muted-foreground">Start a run first. Challenges are completed sequentially with limited retries and a timer.</p>
        <Button id="gate-start-run" asChild size="sm"><Link to="/modes">Go to modes &amp; start a run</Link></Button>
      </GateNotice>
    )
  }
  if (gate.kind === 'not-in-run') {
    return (
      <GateNotice title="Not part of this run">
        <p className="text-muted-foreground">This challenge is not in the current run.</p>
        <Button asChild variant="outline" size="sm"><Link to="/results">Back to results</Link></Button>
      </GateNotice>
    )
  }
  if (gate.kind === 'locked') {
    const cur = CHALLENGES.find((c) => c.id === gate.currentId)!
    return (
      <GateNotice title="Challenge locked">
        <p className="text-muted-foreground">In {mode} mode challenges run sequentially. Finish challenge {cur.num} “{cur.title}” first.</p>
        <Button id="gate-current" asChild size="sm"><Link to={`/challenge/${cur.slug}`}>Go to challenge {cur.num}</Link></Button>
      </GateNotice>
    )
  }

  // prev / next
  let prevMeta
  let nextMeta
  if (mode !== 'practice' && run) {
    const i = run.order.indexOf(meta.id)
    prevMeta = i > 0 ? CHALLENGES.find((c) => c.id === run.order[i - 1]) : undefined
    nextMeta = i < run.order.length - 1 ? CHALLENGES.find((c) => c.id === run.order[i + 1]) : undefined
  } else {
    prevMeta = CHALLENGES[meta.num - 2]
    nextMeta = CHALLENGES[meta.num]
  }

  return (
    <ChallengeShell
      key={meta.id}
      meta={meta}
      Component={Component}
      prevHref={prevMeta ? `/challenge/${prevMeta.slug}` : undefined}
      nextHref={nextMeta ? `/challenge/${nextMeta.slug}` : '/results'}
      nextLabel={nextMeta ? 'Next challenge' : 'View results'}
    />
  )
}
