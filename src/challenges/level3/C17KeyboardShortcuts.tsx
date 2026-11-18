import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'

interface Combo {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

const COMBOS: Combo[] = [
  { ctrl: true, shift: true, alt: false, meta: false, key: 'K' },
  { ctrl: false, shift: false, alt: true, meta: false, key: 'J' },
  { ctrl: true, shift: false, alt: true, meta: false, key: '7' },
  { ctrl: false, shift: true, alt: false, meta: false, key: 'F2' },
  { ctrl: true, shift: true, alt: false, meta: false, key: '9' },
  { ctrl: false, shift: true, alt: true, meta: false, key: 'Q' },
  { ctrl: true, shift: false, alt: true, meta: false, key: 'L' },
  { ctrl: true, shift: true, alt: false, meta: false, key: 'F5' },
  { ctrl: true, shift: true, alt: true, meta: false, key: 'M' },
  { ctrl: false, shift: false, alt: true, meta: false, key: 'F7' },
]

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS', 'Fn', 'NumLock'])

function describe(c: Combo): string {
  return [c.ctrl && 'Ctrl', c.alt && 'Alt', c.shift && 'Shift', c.meta && 'Meta', c.key].filter(Boolean).join(' + ')
}

/** Layout-independent main key: physical code for letters/digits (Shift/Alt change event.key), else event.key. */
function normKey(e: KeyboardEvent): string {
  const code = e.code ?? ''
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]
  return e.key.length === 1 ? e.key.toUpperCase() : e.key
}

export default function C17KeyboardShortcuts({ api, status }: ChallengeProps) {
  const [target] = useState(() => api.rng('combo').pick(COMBOS))
  const [last, setLast] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const { fb, set } = useFeedback()

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (MODIFIER_KEYS.has(e.key)) return
    const hasModifier = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey
    // Plain keys (Tab, arrows, letters...) are ignored so focus can still move.
    if (!hasModifier) return
    // Shift alone with Tab/navigation keys must not be captured (Shift+Tab leaves the pad).
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) return
    e.preventDefault()
    e.stopPropagation()
    if (e.repeat || status === 'passed') return
    const combo: Combo = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, key: normKey(e) }
    const text = describe(combo)
    setLast(text)
    api.log(`Pressed ${text}`)
    const ok =
      combo.ctrl === target.ctrl && combo.shift === target.shift && combo.alt === target.alt && combo.meta === target.meta && combo.key === target.key
    if (ok) {
      set('success', `Combination accepted: ${text}`)
      api.succeed(text)
    } else {
      set('error', `Wrong combination: ${text}`)
      api.fail(`Pressed ${text}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Focus the shortcut pad, then press <Target>{describe(target)}</Target> exactly. Extra or missing modifiers count as a wrong combination.
      </Task>
      <div
        id={`${api.id}-pad`}
        data-testid={`${api.id}-pad`}
        role="group"
        aria-label="Shortcut pad"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-focused={focused}
        className={cn(
          'flex min-h-32 select-none flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-card p-6 text-center outline-none transition-colors',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          focused && 'border-ring',
        )}
      >
        <span className="text-sm font-medium">{focused ? 'Listening for key combinations' : 'Click or Tab to focus this pad'}</span>
        <span className="text-xs text-muted-foreground">Plain keys and modifier-only presses are ignored.</span>
      </div>
      <p className="text-sm">
        Last combination:{' '}
        <code id={`${api.id}-last`} data-testid={`${api.id}-last`} aria-live="off" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {last ?? 'none'}
        </code>
      </p>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
