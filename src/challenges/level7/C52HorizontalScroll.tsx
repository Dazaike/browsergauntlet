import { useEffect, useMemo, useRef, useState } from 'react'
import { Feedback, Task, Target, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

const COUNT = 48
const COLORS = ['Teal', 'Amber', 'Coral', 'Indigo', 'Olive', 'Slate', 'Crimson', 'Ivory', 'Violet', 'Copper', 'Jade', 'Azure']
const PLACES = ['Harbor', 'Meadow', 'Summit', 'Canyon', 'Lagoon', 'Forest', 'Bridge', 'Island', 'Glacier', 'Orchard', 'Valley', 'Quay']

export default function C52HorizontalScroll({ api, status }: ChallengeProps) {
  const cards = useMemo(() => {
    const r = api.rng('names')
    return Array.from({ length: COUNT }, (_, i) => ({ n: i + 1, name: `${r.pick(COLORS)} ${r.pick(PLACES)}` }))
  }, [api])
  const target = useMemo(() => cards[api.rng('target').int(26, COUNT - 2)], [api, cards])
  const label = (c: { n: number; name: string }) => `Card #${c.n} — ${c.name}`

  const stripRef = useRef<HTMLDivElement>(null)
  const idleTimer = useRef<number | undefined>(undefined)
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set())
  const [scrollLeft, setScrollLeft] = useState(0)
  const { fb, set } = useFeedback()
  const locked = status === 'passed' || status === 'failed'

  // Cards become labelled once they come within two viewport widths of the strip.
  useEffect(() => {
    const root = stripRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.cardIndex))
        if (hit.length === 0) return
        setLoaded((prev) => {
          if (hit.every((n) => prev.has(n))) return prev
          const next = new Set(prev)
          hit.forEach((n) => next.add(n))
          return next
        })
      },
      { root, rootMargin: '0px 200% 0px 200%' },
    )
    root.querySelectorAll('[data-card-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const left = Math.round(e.currentTarget.scrollLeft)
    setScrollLeft(left)
    clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => api.log(`Strip scrolled to ${left}px`), 400)
  }

  const onPick = (c: { n: number; name: string }) => {
    api.log(`Clicked ${label(c)}`)
    if (c.n === target.n) {
      set('success', `Clicked ${label(c)}`)
      api.succeed(label(c))
    } else {
      set('error', `Wrong card: ${label(c)}`)
      api.fail(`wrong card #${c.n}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Scroll the strip sideways and click <Target>{label(target)}</Target>. Cards far from the viewport are not labelled until you scroll near them.
      </Task>
      <p className="text-sm text-muted-foreground">
        scrollLeft: <span id="c52-scroll" data-testid="c52-scroll" className="tabular-nums text-foreground">{scrollLeft}</span>px · {COUNT} cards
      </p>
      <div
        ref={stripRef}
        id="c52-strip"
        data-testid="c52-strip"
        role="group"
        aria-label="Card strip"
        onScroll={onScroll}
        className="flex w-full gap-3 overflow-x-auto pb-3 [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted"
      >
        {cards.map((c) => {
          const ready = loaded.has(c.n)
          return (
            <button
              key={c.n}
              type="button"
              id={`c52-card-${c.n}`}
              data-testid={`c52-card-${c.n}`}
              data-card-index={c.n}
              data-loaded={ready}
              aria-busy={!ready}
              aria-label={ready ? label(c) : 'Loading card'}
              disabled={locked}
              onClick={() => onPick(c)}
              className={cn(
                'flex h-28 w-[180px] shrink-0 flex-col justify-between rounded-lg border border-border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                ready ? 'bg-card hover:bg-muted' : 'bg-muted/40',
              )}
            >
              {ready ? (
                <>
                  <span className="text-xs text-muted-foreground">Card #{c.n}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                </>
              ) : (
                <>
                  <span className="h-3 w-12 animate-pulse rounded bg-muted" />
                  <span className="h-4 w-24 animate-pulse rounded bg-muted" />
                </>
              )}
            </button>
          )
        })}
      </div>
      <Feedback state={fb} id="c52-feedback" />
    </div>
  )
}
