import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'

const LABELS = [
  'New file', 'Open folder', 'Open recent', 'Save', 'Save all', 'Rename', 'Duplicate', 'Export',
  'Import', 'Print', 'Share', 'Settings', 'Preferences', 'Archive', 'Close window',
]

interface Item {
  label: string
  disabled: boolean
  /** a separator is drawn before this item */
  separatorBefore: boolean
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export default function C22KeyboardMenu({ api, status }: ChallengeProps) {
  const [{ items, target }] = useState(() => {
    const rng = api.rng('menu')
    const labels = rng.sample(LABELS, 10)
    const disabledIdx = new Set<number>()
    while (disabledIdx.size < 2) disabledIdx.add(rng.int(1, 9))
    const list: Item[] = labels.map((label, i) => ({ label, disabled: disabledIdx.has(i), separatorBefore: i === 5 }))
    // Target: an enabled item that is not the first enabled one, so the keyboard must be used.
    const firstEnabled = list.findIndex((it) => !it.disabled)
    const choices = list.filter((it, i) => !it.disabled && i !== firstEnabled)
    return { items: list, target: rng.pick(choices).label }
  })
  const [active, setActive] = useState(-1)
  const { fb, set } = useFeedback()
  const buffer = useRef({ text: '', at: 0 })
  const lastMove = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const enabledIdx = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
  const itemId = (label: string) => `${api.id}-item-${slug(label)}`

  useEffect(() => {
    if (active < 0) return
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const move = (idx: number) => {
    setActive(idx)
    const now = performance.now()
    if (now - lastMove.current > 150) {
      lastMove.current = now
      api.log(`Menu highlight: ${items[idx].label}`)
    }
  }

  const step = (dir: 1 | -1) => {
    const pos = enabledIdx.indexOf(active)
    if (pos < 0) return move(dir === 1 ? enabledIdx[0] : enabledIdx[enabledIdx.length - 1])
    move(enabledIdx[(pos + dir + enabledIdx.length) % enabledIdx.length])
  }

  const typeahead = (ch: string) => {
    const now = performance.now()
    const b = buffer.current
    b.text = now - b.at > 700 ? ch : b.text + ch
    b.at = now
    const q = b.text.toLowerCase()
    const pos = enabledIdx.indexOf(active)
    // A single character cycles to the next match; longer buffers refine from the current item.
    const from = pos < 0 ? 0 : b.text.length === 1 ? pos + 1 : pos
    for (let k = 0; k < enabledIdx.length; k++) {
      const idx = enabledIdx[(from + k) % enabledIdx.length]
      if (items[idx].label.toLowerCase().startsWith(q)) return move(idx)
    }
  }

  const activate = () => {
    if (status === 'passed') return
    if (active < 0) {
      set('info', 'No item is highlighted. Use ArrowDown first.')
      return
    }
    const label = items[active].label
    api.log(`Menu item activated: ${label}`)
    if (label === target) {
      set('success', `Activated ${label}`)
      api.succeed(label)
    } else {
      set('error', `Wrong item: ${label}`)
      api.fail(`Activated ${label}`)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        return step(1)
      case 'ArrowUp':
        e.preventDefault()
        return step(-1)
      case 'Home':
        e.preventDefault()
        return move(enabledIdx[0])
      case 'End':
        e.preventDefault()
        return move(enabledIdx[enabledIdx.length - 1])
      case 'Enter':
        e.preventDefault()
        if (!e.repeat) activate()
        return
      default:
        if (e.key.length === 1 && e.key !== ' ' && /\S/.test(e.key)) {
          e.preventDefault()
          typeahead(e.key)
        }
    }
  }

  const activeLabel = active >= 0 ? items[active].label : null

  return (
    <div className="grid gap-4">
      <Task>
        Focus the menu, move to <Target>{target}</Target> with the arrow keys (Home, End and typing a letter also work) and press Enter on it.
      </Task>
      <div
        ref={menuRef}
        id={`${api.id}-menu`}
        data-testid={`${api.id}-menu`}
        role="menu"
        aria-label="Actions"
        aria-orientation="vertical"
        aria-activedescendant={activeLabel ? itemId(activeLabel) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => api.log('Menu focused')}
        className="w-full max-w-xs rounded-lg border border-border bg-popover p-1 shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {items.map((it, i) => (
          <div key={it.label}>
            {it.separatorBefore && <div role="separator" aria-orientation="horizontal" className="-mx-1 my-1 h-px bg-border" />}
            <div
              id={itemId(it.label)}
              data-testid={itemId(it.label)}
              data-index={i}
              data-active={i === active}
              role="menuitem"
              aria-disabled={it.disabled || undefined}
              onClick={() => {
                if (!it.disabled) move(i)
              }}
              className={cn(
                'rounded-sm px-2 py-1.5 text-sm select-none',
                it.disabled ? 'cursor-not-allowed text-muted-foreground opacity-50' : 'cursor-default',
                i === active && 'bg-accent text-accent-foreground',
              )}
            >
              {it.label}
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Highlighted:{' '}
        <code id={`${api.id}-active`} data-testid={`${api.id}-active`} data-value={activeLabel ?? ''} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {activeLabel ?? 'none'}
        </code>
      </p>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
