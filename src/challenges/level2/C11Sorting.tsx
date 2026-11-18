import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

interface Card {
  id: string
  num: number
  name: string
}

type Rule = 'num-asc' | 'num-desc' | 'name-asc' | 'name-desc'

const RULES: Record<Rule, { label: string; cmp: (a: Card, b: Card) => number }> = {
  'num-asc': { label: 'ascending by number (smallest first)', cmp: (a, b) => a.num - b.num },
  'num-desc': { label: 'descending by number (largest first)', cmp: (a, b) => b.num - a.num },
  'name-asc': { label: 'alphabetically by name, A to Z', cmp: (a, b) => a.name.localeCompare(b.name) },
  'name-desc': { label: 'reverse alphabetically by name, Z to A', cmp: (a, b) => b.name.localeCompare(a.name) },
}

interface DragState {
  id: string
  pointerId: number
  dx: number
  dy: number
  w: number
  h: number
}

export default function C11Sorting({ api, status }: ChallengeProps) {
  const [{ cards: initial, rule }] = useState(() => {
    const r = api.rng('cards')
    const count = r.int(5, 6)
    const nums = new Set<number>()
    while (nums.size < count) nums.add(r.int(10, 99))
    const names = r.sample(['amber', 'birch', 'cobalt', 'delta', 'ember', 'falcon', 'garnet', 'harbor', 'indigo', 'jasper', 'kestrel', 'lagoon', 'maple', 'nebula', 'orchid'], count)
    const cards: Card[] = [...nums].map((num, i) => ({ id: `k${i}`, num, name: names[i][0].toUpperCase() + names[i].slice(1) }))
    const rule = r.pick(Object.keys(RULES) as Rule[])
    let order = r.shuffle(cards)
    const sorted = [...cards].sort(RULES[rule].cmp).map((c) => c.id).join()
    while (order.map((c) => c.id).join() === sorted) order = r.shuffle(cards)
    return { cards: order, rule }
  })
  const [order, setOrder] = useState(initial)
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number; card: Card } | null>(null)
  const { fb, set } = useFeedback()
  const drag = useRef<DragState | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef(initial)
  const stopDrag = useRef<(() => void) | null>(null)

  // Drag listeners live on window: React re-inserts the dragged DOM node when the order changes,
  // which releases pointer capture, so the gesture must not depend on it.
  useEffect(() => () => stopDrag.current?.(), [])

  const commit = (next: Card[]) => {
    orderRef.current = next
    flushSync(() => setOrder(next))
  }

  /** Moves the dragged card into the slot of the card under the pointer (above/below the list = first/last slot). */
  const reorder = (clientY: number) => {
    const d = drag.current
    const list = listRef.current
    if (!d || !list) return
    const els = Array.from(list.querySelectorAll<HTMLElement>('[data-card]'))
    if (els.length === 0) return
    let to: number
    if (clientY < els[0].getBoundingClientRect().top) to = 0
    else if (clientY > els[els.length - 1].getBoundingClientRect().bottom) to = els.length - 1
    else
      to = els.findIndex((el) => {
        const r = el.getBoundingClientRect()
        return clientY >= r.top && clientY <= r.bottom
      })
    const cur = orderRef.current
    const from = cur.findIndex((c) => c.id === d.id)
    if (to < 0 || from < 0 || to === from) return
    const next = cur.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, card: Card) => {
    if (e.button !== 0 || drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const d: DragState = { id: card.id, pointerId: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height }
    drag.current = d
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return
      setGhost((g) => (g ? { ...g, x: ev.clientX - d.dx, y: ev.clientY - d.dy } : g))
      reorder(ev.clientY)
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return
      if (ev.type === 'pointerup') reorder(ev.clientY)
      stop()
      setGhost(null)
      api.log(`Card dropped at position ${orderRef.current.findIndex((c) => c.id === d.id) + 1}`)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      stopDrag.current = null
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    stopDrag.current = stop
    setGhost({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, card })
    api.log(`Drag started: card ${card.num}`)
  }

  const check = () => {
    if (status === 'passed') return
    const expected = [...orderRef.current].sort(RULES[rule].cmp).map((c) => c.id)
    const actual = orderRef.current.map((c) => c.id)
    const summary = orderRef.current.map((c) => c.num).join(', ')
    api.log(`Check order pressed: ${summary}`)
    if (expected.every((id, i) => id === actual[i])) {
      set('success', 'Order is correct')
      api.succeed(`order ${summary}`)
    } else {
      const wrong = actual.findIndex((id, i) => id !== expected[i]) + 1
      set('error', `Order is wrong (first mismatch at position ${wrong})`)
      api.fail(`wrong order: ${summary}`)
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Arrange the cards <Target>{RULES[rule].label}</Target> by dragging them, then press Check order.
      </Task>

      <div ref={listRef} role="list" aria-label="Cards" id={`${api.id}-list`} data-testid={`${api.id}-list`} data-order={order.map((c) => c.num).join(',')} className="grid max-w-md gap-2">
        {order.map((card, i) => (
          <div
            key={card.id}
            role="listitem"
            id={`${api.id}-card-${card.num}`}
            data-testid={`${api.id}-card-${card.num}`}
            data-card={card.id}
            data-index={i}
            data-num={card.num}
            data-name={card.name}
            aria-label={`Card ${card.num} ${card.name}, position ${i + 1}`}
            onPointerDown={(e) => onPointerDown(e, card)}
            onDragStart={(e) => e.preventDefault()}
            className={cn(
              'flex h-14 cursor-grab touch-none select-none items-center gap-3 rounded-lg border border-border bg-background px-3 text-sm',
              ghost?.card.id === card.id && 'border-dashed opacity-30',
            )}
          >
            <GripVertical className="size-4 text-muted-foreground" aria-hidden />
            <span className="w-8 font-mono text-lg font-semibold tabular-nums">{card.num}</span>
            <span className="font-medium">{card.name}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button id={`${api.id}-check`} data-testid={`${api.id}-check`} onClick={check}>Check order</Button>
        <Feedback state={fb} id={`${api.id}-feedback`} />
      </div>

      {ghost && (
        <div
          aria-hidden
          data-testid={`${api.id}-ghost`}
          className="pointer-events-none fixed left-0 top-0 z-50 flex items-center gap-3 rounded-lg border border-primary bg-background px-3 text-sm shadow-lg"
          style={{ width: ghost.w, height: ghost.h, transform: `translate(${ghost.x}px, ${ghost.y}px)` }}
        >
          <GripVertical className="size-4 text-muted-foreground" aria-hidden />
          <span className="w-8 font-mono text-lg font-semibold tabular-nums">{ghost.card.num}</span>
          <span className="font-medium">{ghost.card.name}</span>
        </div>
      )}
    </div>
  )
}
