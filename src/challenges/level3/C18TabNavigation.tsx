import { useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Input } from '@/components/ui/input'

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima']

interface Layout {
  /** fields in DOM (= Tab) order */
  fields: string[]
  /** CSS grid `order` per DOM index: visual position differs from Tab position */
  visual: number[]
  target: string
}

export default function C18TabNavigation({ api, status }: ChallengeProps) {
  const [layout] = useState<Layout>(() => {
    const rng = api.rng('layout')
    const fields = rng.sample(NAMES, 6)
    let visual = rng.shuffle([0, 1, 2, 3, 4, 5])
    // Make sure the visual order never equals the Tab order.
    if (visual.every((v, i) => v === i)) visual = [5, 4, 3, 2, 1, 0]
    // Target sits at Tab position 3..5 (index 2..4): never the first field.
    const target = fields[rng.int(2, 4)]
    return { fields, visual, target }
  })
  const [focused, setFocused] = useState<string | null>(null)
  const { fb, set } = useFeedback()

  const slug = (name: string) => name.toLowerCase()

  // Cancelling mousedown is what stops a click from moving focus into a field; cancelling click stops label activation.
  const blockPointer = (e: MouseEvent) => {
    e.preventDefault()
    if (e.type === 'click') {
      api.log('Pointer click on a field ignored (keyboard only)')
      set('info', 'Pointer input is ignored. Use the keyboard only.')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, name: string) => {
    if (e.key !== 'Enter' || e.repeat) return
    e.preventDefault()
    if (status === 'passed') return
    api.log(`Enter pressed on field ${name}`)
    if (name === layout.target) {
      set('success', `Enter accepted on ${name}`)
      api.succeed(name)
    } else {
      set('error', `Wrong field: Enter was pressed on ${name}`)
      api.fail(`Enter pressed on ${name}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Keyboard only: use Tab / Shift+Tab to move focus to the field <Target>{layout.target}</Target> and press Enter while it is focused.
      </Task>
      <p className="text-xs text-muted-foreground">
        Keyboard only: clicks on the fields are ignored. The visual order of the fields differs from the Tab order.
      </p>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        onMouseDownCapture={blockPointer}
        onClickCapture={blockPointer}
      >
        {layout.fields.map((name, i) => (
          <div key={name} className="grid gap-1.5" style={{ order: layout.visual[i] }}>
            <label htmlFor={`${api.id}-field-${slug(name)}`} className="text-sm font-medium">
              {name}
            </label>
            <Input
              id={`${api.id}-field-${slug(name)}`}
              data-testid={`${api.id}-field-${slug(name)}`}
              data-field={name}
              placeholder={`${name} field`}
              autoComplete="off"
              onFocus={() => setFocused(name)}
              onBlur={() => setFocused((f) => (f === name ? null : f))}
              onKeyDown={(e) => onKeyDown(e, name)}
            />
          </div>
        ))}
      </div>
      <p className="text-sm">
        Focused field:{' '}
        <code id={`${api.id}-focused`} data-testid={`${api.id}-focused`} data-value={focused ?? ''} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {focused ?? 'none'}
        </code>
      </p>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
