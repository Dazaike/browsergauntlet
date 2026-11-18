import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Feedback, Task, Target, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const POOL = [
  'Alpaca', 'Badger', 'Capybara', 'Dolphin', 'Eagle', 'Ferret', 'Gecko', 'Heron', 'Ibis', 'Jackal',
  'Koala', 'Lynx', 'Marmot', 'Narwhal', 'Ocelot', 'Penguin', 'Quokka', 'Raccoon', 'Salamander', 'Toucan',
]
const slug = (s: string) => s.toLowerCase()

export default function C54MultiSelect({ api, status }: ChallengeProps) {
  const [initial] = useState(() => {
    const opts = api.rng('options').sample(POOL, 12)
    const r = api.rng('target')
    return { opts, target: r.sample(opts, r.int(3, 4)) }
  })
  const [options, setOptions] = useState(initial.opts)
  const target = initial.target
  const [selected, setSelected] = useState<readonly string[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { fb, set } = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)
  openRef.current = open
  const locked = status === 'passed' || status === 'failed'

  // Stress mode: the option order changes once, never while the list is open.
  useEffect(() => {
    if (!api.settings.dynamic) return
    let t = 0
    const go = () => {
      if (openRef.current) t = window.setTimeout(go, 400)
      else setOptions((o) => api.rng('reorder').shuffle(o))
    }
    t = window.setTimeout(go, api.delay(900))
    return () => clearTimeout(t)
  }, [api])

  // Close on an outside *click* (not pointerdown) so the list never collapses between the
  // pointerdown and pointerup of a click on Apply. The list is in normal flow (it never covers Apply).
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`c54-option-${slug(options[active])}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, options])

  const toggle = (name: string) => {
    if (locked) return
    const on = selected.includes(name)
    setSelected(on ? selected.filter((s) => s !== name) : [...selected, name])
    api.log(`${on ? 'Deselected' : 'Selected'} ${name}`)
  }

  const setOpenState = (next: boolean) => {
    if (next === open) return
    setOpen(next)
    setActive(-1)
    api.log(next ? 'Dropdown opened' : 'Dropdown closed')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpenState(false)
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
        api.log('Dropdown opened')
      } else {
        const d = e.key === 'ArrowDown' ? 1 : -1
        setActive((a) => (a + d + options.length) % options.length)
      }
    } else if (e.key === 'Home' && open) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End' && open) {
      e.preventDefault()
      setActive(options.length - 1)
    }
  }

  const apply = () => {
    const names = [...selected].sort()
    api.log(`Apply: ${names.join(', ') || 'nothing selected'}`)
    const ok = names.length === target.length && target.every((t) => selected.includes(t))
    if (ok) {
      set('success', `Applied: ${names.join(', ')}`)
      api.succeed(`applied ${names.join(', ')}`)
    } else {
      set('error', names.length === 0 ? 'Nothing selected' : `Applied set does not match: ${names.join(', ')}`)
      api.fail(`applied ${names.join(', ') || 'nothing'}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Choose exactly these options in the dropdown, then press Apply: {target.map((t, i) => (
          <span key={t}>{i > 0 && ', '}<Target>{t}</Target></span>
        ))}.
      </Task>
      <div ref={rootRef} className="relative max-w-sm" onKeyDown={onKeyDown}>
        <label id="c54-label" htmlFor="c54-combobox" className="mb-1.5 block text-sm font-medium">Animals</label>
        <button
          type="button"
          id="c54-combobox"
          data-testid="c54-combobox"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="c54-listbox"
          aria-labelledby="c54-label"
          aria-activedescendant={open && active >= 0 ? `c54-option-${slug(options[active])}` : undefined}
          disabled={locked}
          onClick={(e) => {
            if (e.detail === 0 && open && active >= 0) toggle(options[active])
            else setOpenState(!open)
          }}
          className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <span className={cn(selected.length === 0 && 'text-muted-foreground')}>
            {selected.length === 0 ? 'Select options' : `${selected.length} selected`}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </button>
        {open && (
          <div
            id="c54-listbox"
            data-testid="c54-listbox"
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby="c54-label"
            className="mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {options.map((name, i) => {
              const on = selected.includes(name)
              return (
                <div
                  key={name}
                  id={`c54-option-${slug(name)}`}
                  data-testid={`c54-option-${slug(name)}`}
                  role="option"
                  aria-selected={on}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => toggle(name)}
                  className={cn(
                    'flex h-8 cursor-default items-center justify-between rounded-sm px-2 text-sm select-none hover:bg-muted',
                    i === active && 'bg-muted',
                  )}
                >
                  {name}
                  {on && <Check className="size-4" aria-hidden />}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div id="c54-chips" data-testid="c54-chips" role="list" aria-label="Selected options" className="flex min-h-7 flex-wrap gap-1.5">
        {selected.length === 0 && <span className="text-sm text-muted-foreground">No options selected</span>}
        {selected.map((name) => (
          <span key={name} role="listitem" data-testid={`c54-chip-${slug(name)}`} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
            {name}
          </span>
        ))}
      </div>
      <div>
        <Button id="c54-apply" data-testid="c54-apply" onClick={apply} disabled={locked}>Apply</Button>
      </div>
      <Feedback state={fb} id="c54-feedback" />
    </div>
  )
}
