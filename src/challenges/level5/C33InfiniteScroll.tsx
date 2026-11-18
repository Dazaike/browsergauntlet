import { useCallback, useEffect, useRef, useState } from 'react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const TOTAL = 300
const BATCH = 20

export default function C33InfiniteScroll({ api }: ChallengeProps) {
  const [target] = useState(() => api.rng('target').int(90, 220))
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const { fb, set } = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const loadingRef = useRef(false)
  const countRef = useRef(0)
  const alive = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || countRef.current >= TOTAL) return
    loadingRef.current = true
    setLoading(true)
    const from = countRef.current
    const next = await api.request(() => Math.min(TOTAL, from + BATCH), `load items ${from + 1}-${Math.min(TOTAL, from + BATCH)}`)
    if (!alive.current) return
    countRef.current = next
    loadingRef.current = false
    setCount(next)
    setLoading(false)
  }, [api])

  useEffect(() => {
    void loadMore()
  }, [loadMore])

  // Re-created after every batch so a sentinel that is still visible triggers the next load.
  useEffect(() => {
    const root = rootRef.current
    const el = sentinelRef.current
    if (!root || !el || loading || count === 0 || count >= TOTAL) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { root, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [count, loading, loadMore])

  const pick = (n: number) => {
    setPicked(n)
    api.log(`Clicked Item #${n}`)
    if (n === target) {
      set('success', `Item #${n} selected.`)
      api.succeed(`Item #${n} clicked`)
    } else {
      set('error', `Wrong item: Item #${n}`)
      api.fail(`Clicked Item #${n}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Scroll the list until <Target>Item #{target}</Target> has loaded, then click it.
      </Task>
      <p className="text-sm text-muted-foreground">
        <span id="c33-count" data-testid="c33-count" data-count={count}>
          Loaded {count} of {TOTAL} items
        </span>
      </p>
      <div
        ref={rootRef}
        id="c33-list"
        data-testid="c33-list"
        role="region"
        aria-label="Infinite item list"
        tabIndex={0}
        aria-busy={loading}
        className="h-[360px] overflow-y-auto rounded-lg border border-border bg-card"
      >
        <ul className="divide-y divide-border">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <li key={n}>
              <button
                type="button"
                id={`c33-item-${n}`}
                data-testid={`c33-item-${n}`}
                data-selected={picked === n}
                onClick={() => pick(n)}
                className={cn('flex h-10 w-full items-center justify-between px-3 text-left text-sm hover:bg-muted', picked === n && 'bg-muted')}
              >
                <span>Item #{n}</span>
                <span className="text-xs text-muted-foreground">batch {Math.ceil(n / BATCH)}</span>
              </button>
            </li>
          ))}
          <li ref={sentinelRef} id="c33-sentinel" data-testid="c33-sentinel" className="flex h-10 items-center justify-center text-xs text-muted-foreground">
            {count >= TOTAL ? 'End of list' : loading ? 'Loading more...' : 'Scroll for more'}
          </li>
        </ul>
      </div>
      <Feedback state={fb} id="c33-feedback" />
    </div>
  )
}
