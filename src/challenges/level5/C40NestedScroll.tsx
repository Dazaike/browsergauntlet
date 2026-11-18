import { useMemo, useState } from 'react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const INNER = 300
const OUTER_BEFORE = 14
const OUTER_AFTER = 14

const rowCls = 'flex h-9 w-full items-center justify-between px-3 text-left font-mono text-sm hover:bg-muted'

export default function C40NestedScroll({ api }: ChallengeProps) {
  const spec = useMemo(() => {
    const r = api.rng('rows')
    const pool = Array.from({ length: 4096 }, (_, i) => i)
    const hex = r.shuffle(pool).slice(0, INNER + OUTER_BEFORE + OUTER_AFTER).map((n) => `0x${n.toString(16).toUpperCase().padStart(3, '0')}`)
    const inner = hex.slice(0, INNER)
    return {
      inner,
      before: hex.slice(INNER, INNER + OUTER_BEFORE),
      after: hex.slice(INNER + OUTER_BEFORE),
      target: inner[r.int(180, 290)],
    }
  }, [api])
  const [picked, setPicked] = useState<string | null>(null)
  const { fb, set } = useFeedback()

  const pick = (panel: 'inner' | 'outer', hex: string) => {
    setPicked(`${panel}-${hex}`)
    api.log(`Clicked row ${hex} in the ${panel} panel`)
    if (panel === 'inner' && hex === spec.target) {
      set('success', `Row ${hex} clicked.`)
      api.succeed(`Row ${hex} clicked in the inner panel`)
    } else {
      set('error', `Wrong row: ${hex} (${panel} panel)`)
      api.fail(`Clicked row ${hex} in the ${panel} panel`)
    }
  }

  const row = (panel: 'inner' | 'outer', hex: string) => {
    const key = `${panel}-${hex}`
    return (
      <li key={key}>
        <button type="button" id={`c40-${key}`} data-testid={`c40-${key}`} data-selected={picked === key} onClick={() => pick(panel, hex)} className={cn(rowCls, picked === key && 'bg-muted')}>
          <span>Row {hex}</span>
          <span className="text-xs text-muted-foreground">{panel}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="grid gap-4">
      <Task>
        Inside the <b>Inner panel</b> (nested within the <b>Outer panel</b>), scroll until <Target>Row {spec.target}</Target> is visible and click it. Rows with the same look in the outer panel are decoys.
      </Task>
      <div
        id="c40-outer"
        data-testid="c40-outer"
        role="region"
        aria-label="Outer panel"
        tabIndex={0}
        className="h-[420px] overflow-y-auto rounded-lg border border-border bg-card"
      >
        <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Outer panel</p>
        <ul className="divide-y divide-border">{spec.before.map((h) => row('outer', h))}</ul>
        <div className="border-y border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Inner panel ({INNER} rows)</p>
          <div
            id="c40-inner"
            data-testid="c40-inner"
            role="region"
            aria-label="Inner panel"
            tabIndex={0}
            className="h-60 overflow-y-auto rounded-md border border-border bg-card"
          >
            <ul className="divide-y divide-border">{spec.inner.map((h) => row('inner', h))}</ul>
          </div>
        </div>
        <ul className="divide-y divide-border">{spec.after.map((h) => row('outer', h))}</ul>
      </div>
      <Feedback state={fb} id="c40-feedback" />
      <p className="text-sm text-muted-foreground">The page keeps scrolling below this line; scroll chaining between the panels and the page follows normal browser behaviour.</p>
      <div aria-hidden className="h-[50vh] rounded-lg border border-dashed border-border" />
    </div>
  )
}
