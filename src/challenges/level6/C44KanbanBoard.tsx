import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { nativeField } from './nativeFieldStyles'

const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const
type Col = (typeof COLUMNS)[number]['key']
const PRIORITIES = ['Low', 'Medium', 'High'] as const
type Priority = (typeof PRIORITIES)[number]
const ASSIGNEES = ['Mia', 'Noah', 'Liam', 'Zoe', 'Ava'] as const
const TITLES = [
  'Fix login redirect', 'Write release notes', 'Audit dependencies', 'Design empty state', 'Add dark mode', 'Migrate database',
  'Refactor billing', 'Improve search', 'Update onboarding', 'Cache API results', 'Localize emails', 'Optimize images',
]
const DRAG_THRESHOLD = 5

interface Card { id: string; title: string; priority: Priority; assignee: string; col: Col }
interface Edit { id: string; priority: Priority; assignee: string }
interface Drop { col: Col; index: number }
interface Gesture { id: string; pid: number; sx: number; sy: number; offX: number; offY: number; w: number; active: boolean }
interface Ghost { id: string; x: number; y: number; offX: number; offY: number; w: number }

const colLabel = (c: Col) => COLUMNS.find((x) => x.key === c)?.label ?? c

function buildPuzzle(api: ChallengeApi) {
  const r = api.rng('board')
  const cols = r.shuffle<Col>(['backlog', 'backlog', 'backlog', 'progress', 'progress', 'review', 'review', 'done'])
  const cards: Card[] = r.sample(TITLES, 8).map((title, i) => ({
    id: `k${i + 1}`, title, col: cols[i], priority: r.pick(PRIORITIES), assignee: r.pick(ASSIGNEES),
  }))
  const t = api.rng('target')
  const picks = t.sample(cards, 4)
  const moves = picks.slice(0, 3).map((c) => ({ id: c.id, col: t.pick(COLUMNS.filter((x) => x.key !== c.col)).key }))
  const e = picks[3]
  const edit: Edit = {
    id: e.id,
    priority: t.pick(PRIORITIES.filter((p) => p !== e.priority)),
    assignee: t.pick(ASSIGNEES.filter((a) => a !== e.assignee)),
  }
  return { cards, moves, edit }
}

/** Remove the card and re-insert it into `col` before the `index`-th card of that column (or after the last). */
function moveCard(cards: Card[], id: string, col: Col, index: number): Card[] {
  const card = cards.find((c) => c.id === id)
  if (!card) return cards
  const rest = cards.filter((c) => c.id !== id)
  const inCol = rest.filter((c) => c.col === col)
  const moved = { ...card, col }
  let pos = rest.length
  if (index < inCol.length) pos = rest.indexOf(inCol[index])
  else if (inCol.length > 0) pos = rest.indexOf(inCol[inCol.length - 1]) + 1
  return [...rest.slice(0, pos), moved, ...rest.slice(pos)]
}

const PRIORITY_STYLE: Record<Priority, string> = {
  Low: 'bg-muted text-muted-foreground',
  Medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  High: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

export default function C44KanbanBoard({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => buildPuzzle(api))
  const [cards, setCards] = useState<Card[]>(puzzle.cards)
  const [loaded, setLoaded] = useState(!api.settings.dynamic)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)
  const [editing, setEditing] = useState<{ id: string; priority: Priority; assignee: string; col: Col } | null>(null)
  const { fb, set } = useFeedback()
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const colEls = useRef<Partial<Record<Col, HTMLElement | null>>>({})

  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setLoaded(true), api.delay(700))
    return () => clearTimeout(t)
  }, [api])

  const locked = status === 'failed'
  const byId = (id: string) => cards.find((c) => c.id === id)
  const titleOf = (id: string) => puzzle.cards.find((c) => c.id === id)?.title ?? id

  const dropAt = (x: number, y: number, dragId: string): Drop | null => {
    for (const { key } of COLUMNS) {
      const el = colEls.current[key]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
      let index = 0
      el.querySelectorAll<HTMLElement>('[data-card-id]').forEach((n) => {
        if (n.dataset.cardId === dragId) return
        const b = n.getBoundingClientRect()
        if (b.top + b.height / 2 < y) index++
      })
      return { col: key, index }
    }
    return null
  }

  const endGesture = (el: HTMLElement, pid: number) => {
    if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid)
    gesture.current = null
    setGhost(null)
    setDrop(null)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, c: Card) => {
    if (locked || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rect = e.currentTarget.getBoundingClientRect()
    suppressClick.current = false
    gesture.current = { id: c.id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, active: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.pid !== e.pointerId) return
    if (!g.active) {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_THRESHOLD) return
      g.active = true
      api.log(`Drag started: ${titleOf(g.id)}`)
    }
    setGhost({ id: g.id, x: e.clientX, y: e.clientY, offX: g.offX, offY: g.offY, w: g.w })
    const next = dropAt(e.clientX, e.clientY, g.id)
    setDrop((cur) => (cur?.col === next?.col && cur?.index === next?.index ? cur : next))
  }

  /** The browser fires a click after a drag only if the original element survived; never leave the flag armed. */
  const armClickSuppression = () => {
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 50)
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.pid !== e.pointerId) return
    // Some drivers send down at A and up at B with no intermediate move: treat that as a drag too.
    const wasActive = g.active || Math.hypot(e.clientX - g.sx, e.clientY - g.sy) >= DRAG_THRESHOLD
    const target = wasActive ? dropAt(e.clientX, e.clientY, g.id) : null
    endGesture(e.currentTarget, e.pointerId)
    if (!wasActive) return
    armClickSuppression()
    if (!target) {
      api.log(`Drag cancelled: ${titleOf(g.id)} dropped outside a column`)
      set('info', 'Dropped outside a column; card not moved')
      return
    }
    setCards((cur) => moveCard(cur, g.id, target.col, target.index))
    api.log(`Dropped ${titleOf(g.id)} in ${colLabel(target.col)} at position ${target.index + 1}`)
    set('info', `${titleOf(g.id)} moved to ${colLabel(target.col)}`)
  }

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.pid !== e.pointerId) return
    if (g.active) { armClickSuppression(); api.log(`Drag cancelled: ${titleOf(g.id)}`) }
    endGesture(e.currentTarget, e.pointerId)
  }

  const openEdit = (c: Card) => {
    setEditing({ id: c.id, priority: c.priority, assignee: c.assignee, col: c.col })
    api.log(`Opened card: ${c.title}`)
  }

  const onClick = (c: Card) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (!locked) openEdit(c)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, c: Card) => {
    if (locked || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    openEdit(c)
  }

  const save = () => {
    if (!editing) return
    const orig = byId(editing.id)
    if (!orig) return
    setCards((cur) => {
      const updated = cur.map((c) => (c.id === editing.id ? { ...c, priority: editing.priority, assignee: editing.assignee } : c))
      return editing.col === orig.col ? updated : moveCard(updated, editing.id, editing.col, Number.MAX_SAFE_INTEGER)
    })
    api.log(`Saved ${orig.title}: priority ${editing.priority}, assignee ${editing.assignee}, column ${colLabel(editing.col)}`)
    set('info', `Saved ${orig.title}`)
    setEditing(null)
  }

  const verify = () => {
    if (locked || !loaded) return
    const diffs: string[] = []
    for (const o of puzzle.cards) {
      const cur = byId(o.id)
      const wantCol = puzzle.moves.find((m) => m.id === o.id)?.col ?? o.col
      const wantPriority = puzzle.edit.id === o.id ? puzzle.edit.priority : o.priority
      const wantAssignee = puzzle.edit.id === o.id ? puzzle.edit.assignee : o.assignee
      if (!cur) { diffs.push(`${o.title} (missing)`); continue }
      if (cur.col !== wantCol) diffs.push(`${o.title} (column)`)
      if (cur.priority !== wantPriority) diffs.push(`${o.title} (priority)`)
      if (cur.assignee !== wantAssignee) diffs.push(`${o.title} (assignee)`)
    }
    api.log('Verify pressed')
    if (diffs.length > 0 || cards.length !== puzzle.cards.length) {
      const reason = `Board differs from target: ${diffs.join(', ')}`
      set('error', reason)
      api.fail(reason)
      return
    }
    set('success', 'Board matches the target')
    api.succeed('board state verified')
  }

  const ghostCard = ghost ? byId(ghost.id) : undefined
  const editingCard = editing ? byId(editing.id) : undefined

  return (
    <div className="grid gap-4">
      <Task>
        {puzzle.moves.map((m) => (
          <span key={m.id}>Move <Target>{titleOf(m.id)}</Target> to <Target>{colLabel(m.col)}</Target>. </span>
        ))}
        On the card <Target>{titleOf(puzzle.edit.id)}</Target> set the priority to <Target>{puzzle.edit.priority}</Target> and the assignee to{' '}
        <Target>{puzzle.edit.assignee}</Target>. Leave every other card in its original column with its original properties, then press Verify.
        Drag cards between columns; click a card to edit it.
      </Task>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" id={`${api.id}-board`}>
        {COLUMNS.map(({ key, label }) => {
          const list = cards.filter((c) => c.col === key)
          const isOver = drop?.col === key
          const others = list.filter((c) => c.id !== ghost?.id)
          return (
            <section
              key={key}
              id={`${api.id}-col-${key}`}
              data-testid={`${api.id}-col-${key}`}
              data-column={key}
              aria-label={label}
              ref={(el) => { colEls.current[key] = el }}
              className={cn('flex min-h-40 min-w-0 flex-col rounded-lg border bg-muted/30 p-2', isOver ? 'border-primary bg-primary/5 ring-2 ring-primary/40' : 'border-border')}
            >
              <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
                {label}
                <span data-testid={`${api.id}-count-${key}`} className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
              </h3>
              <ul className="grid flex-1 content-start gap-2" aria-label={`${label} cards`}>
                {!loaded && <li className="px-1 py-2 text-xs text-muted-foreground">Loading cards…</li>}
                {loaded && list.map((c) => (
                  <li key={c.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      id={`${api.id}-card-${c.id}`}
                      data-testid={`${api.id}-card-${c.id}`}
                      data-card-id={c.id}
                      data-title={c.title}
                      data-column={c.col}
                      data-priority={c.priority}
                      data-assignee={c.assignee}
                      onPointerDown={(e) => onPointerDown(e, c)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                      onClick={() => onClick(c)}
                      onKeyDown={(e) => onKeyDown(e, c)}
                      className={cn(
                        'cursor-grab touch-none select-none rounded-md border border-border bg-card p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
                        ghost?.id === c.id && 'opacity-40',
                        isOver && drop && others[drop.index]?.id === c.id && 'shadow-[0_-3px_0_0_var(--color-primary)]',
                        isOver && drop && drop.index >= others.length && others[others.length - 1]?.id === c.id && 'shadow-[0_3px_0_0_var(--color-primary)]',
                      )}
                    >
                      <p className="font-medium">{c.title}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className={cn('rounded px-1.5 py-0.5 font-medium', PRIORITY_STYLE[c.priority])}>{c.priority}</span>
                        <span className="text-muted-foreground">{c.assignee}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button id={`${api.id}-verify`} data-testid={`${api.id}-verify`} disabled={locked || !loaded} onClick={verify}>Verify</Button>
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />

      {ghost && ghostCard && (
        <div
          aria-hidden
          data-testid={`${api.id}-ghost`}
          className="pointer-events-none fixed z-[60] rounded-md border border-primary bg-card p-2.5 text-sm shadow-md"
          style={{ left: ghost.x - ghost.offX, top: ghost.y - ghost.offY, width: ghost.w }}
        >
          <p className="font-medium">{ghostCard.title}</p>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent id={`${api.id}-edit-panel`} data-testid={`${api.id}-edit-panel`}>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>{editingCard?.title}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label htmlFor={`${api.id}-edit-priority`} className="text-sm font-medium">Priority</label>
                <select id={`${api.id}-edit-priority`} data-testid={`${api.id}-edit-priority`} className={nativeField} value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${api.id}-edit-assignee`} className="text-sm font-medium">Assignee</label>
                <select id={`${api.id}-edit-assignee`} data-testid={`${api.id}-edit-assignee`} className={nativeField} value={editing.assignee} onChange={(e) => setEditing({ ...editing, assignee: e.target.value })}>
                  {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${api.id}-edit-move`} className="text-sm font-medium">Move to…</label>
                <select id={`${api.id}-edit-move`} data-testid={`${api.id}-edit-move`} className={nativeField} value={editing.col} onChange={(e) => setEditing({ ...editing, col: e.target.value as Col })}>
                  {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button id={`${api.id}-cancel`} data-testid={`${api.id}-cancel`} type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button id={`${api.id}-save`} data-testid={`${api.id}-save`} type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
