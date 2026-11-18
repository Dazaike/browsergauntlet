import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Check } from 'lucide-react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SIZE = 5
const COLS = 'ABCDE'

const coord = (i: number) => `${COLS[i % SIZE]}${Math.floor(i / SIZE) + 1}`

export default function C61KeyboardOnly({ api, status }: ChallengeProps) {
  const [targets] = useState<number[]>(() =>
    api
      .rng('targets')
      .sample(Array.from({ length: SIZE * SIZE }, (_, i) => i), 4)
      .sort((a, b) => a - b),
  )
  const [focusIdx, setFocusIdx] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const { fb, set } = useFeedback()

  const selectedSorted = [...selected].sort((a, b) => a - b)

  const moveTo = (i: number) => {
    setFocusIdx(i)
    cells.current[i]?.focus()
  }

  const locked = status === 'passed' || status === 'failed'

  const toggle = (i: number) => {
    if (locked) return
    const on = !selected.includes(i)
    setSelected((s) => (on ? [...s, i] : s.filter((x) => x !== i)))
    api.log(`${coord(i)} ${on ? 'selected' : 'deselected'}`)
    set('info', `${coord(i)} ${on ? 'selected' : 'deselected'}`)
  }

  const submit = () => {
    if (locked) return
    const ok = selectedSorted.length === targets.length && selectedSorted.every((v, k) => v === targets[k])
    const list = selectedSorted.map(coord).join(', ') || 'none'
    api.log(`Submitted selection: ${list}`)
    if (ok) {
      set('success', `Selection ${list} accepted`)
      api.succeed(`Selected ${list}`)
    } else {
      set('error', `Wrong selection: ${list}`)
      api.fail(`Wrong selection: ${list}`)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // derive the position from the focused cell, not from state that may lag a fast key sequence
    const at = cells.current.indexOf(e.target as HTMLDivElement)
    const idx = at >= 0 ? at : focusIdx
    const row = Math.floor(idx / SIZE)
    const col = idx % SIZE
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight': next = row * SIZE + Math.min(SIZE - 1, col + 1); break
      case 'ArrowLeft': next = row * SIZE + Math.max(0, col - 1); break
      case 'ArrowDown': next = Math.min(SIZE - 1, row + 1) * SIZE + col; break
      case 'ArrowUp': next = Math.max(0, row - 1) * SIZE + col; break
      case 'Home': next = e.ctrlKey ? 0 : row * SIZE; break
      case 'End': next = e.ctrlKey ? SIZE * SIZE - 1 : row * SIZE + SIZE - 1; break
      case 'PageUp': next = col; break
      case 'PageDown': next = (SIZE - 1) * SIZE + col; break
      case 'Enter':
        e.preventDefault()
        if (e.repeat) return
        if (e.ctrlKey || e.metaKey) submit()
        else toggle(idx)
        return
      case ' ':
        e.preventDefault()
        if (!e.repeat) toggle(idx)
        return
      default:
        return
    }
    e.preventDefault()
    moveTo(next)
  }

  const blockPointer = (e: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.type === 'click') {
      set('info', 'Pointer input is disabled. Use the keyboard.')
      api.log('Pointer input ignored on grid')
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Use only the keyboard. Tab into the grid, move with the arrow keys and press Space or Enter to select exactly these cells: {targets.map((t) => (
          <span key={t}>
            <Target>{coord(t)}</Target>{' '}
          </span>
        ))}
        Then submit with <kbd className="rounded border border-border bg-muted px-1 font-mono text-xs">Ctrl+Enter</kbd> inside the grid, or Tab to the Submit button and press it with Enter/Space.
      </Task>

      <p className="text-xs text-muted-foreground" data-testid={`${api.id}-pointer-note`}>
        Pointer input disabled
      </p>

      <div
        id={`${api.id}-grid`}
        data-testid={`${api.id}-grid`}
        role="grid"
        aria-label="Keyboard-only 5 by 5 grid"
        aria-multiselectable="true"
        aria-describedby={`${api.id}-pointer-note-text`}
        onKeyDown={onKeyDown}
        onPointerDownCapture={blockPointer}
        onMouseDownCapture={blockPointer}
        onClickCapture={blockPointer}
        className="grid w-fit max-w-full cursor-not-allowed touch-none select-none gap-1.5"
        style={{ touchAction: 'none' }}
      >
        {Array.from({ length: SIZE }, (_, r) => (
          <div key={r} role="row" className="flex gap-1.5">
            {Array.from({ length: SIZE }, (_, c) => {
              const i = r * SIZE + c
              const on = selected.includes(i)
              return (
                <div
                  key={i}
                  ref={(el) => {
                    cells.current[i] = el
                  }}
                  id={`${api.id}-cell-${coord(i)}`}
                  data-testid={`${api.id}-cell-${coord(i)}`}
                  data-cell={coord(i)}
                  role="gridcell"
                  aria-selected={on}
                  aria-label={coord(i)}
                  tabIndex={i === focusIdx ? 0 : -1}
                  onFocus={() => setFocusIdx(i)}
                  className={cn(
                    'flex size-12 items-center justify-center rounded-md border text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:size-14',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {on ? <Check className="size-4" aria-hidden /> : coord(i)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <span id={`${api.id}-pointer-note-text`} className="sr-only">
        Pointer input disabled. Use arrow keys, Space or Enter to toggle, Control Enter to submit.
      </span>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Focused</dt>
        <dd id={`${api.id}-focus`} data-testid={`${api.id}-focus`} className="font-mono">{coord(focusIdx)}</dd>
        <dt className="text-muted-foreground">Selected</dt>
        <dd id={`${api.id}-selected`} data-testid={`${api.id}-selected`} className="font-mono">{selectedSorted.map(coord).join(', ') || 'none'}</dd>
      </dl>

      <div>
        <Button
          id={`${api.id}-submit`}
          data-testid={`${api.id}-submit`}
          onClick={(e) => {
            // Keyboard activation (Enter/Space) and script-driven clicks (element.click(), dispatchEvent) report
            // detail === 0; a real pointer click reports detail >= 1 and is ignored. Script-driven clicks therefore
            // submit, which is acceptable: the rule only guards against real pointer input (mouse/touch/pen).
            if (e.detail > 0) {
              set('info', 'Pointer input is disabled. Press Enter or Space on the focused Submit button.')
              api.log('Pointer click on Submit ignored')
              return
            }
            submit()
          }}
        >
          Submit
        </Button>
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
