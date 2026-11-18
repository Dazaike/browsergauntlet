import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ITEMS = [
  'Ada', 'Bash', 'C', 'C#', 'C++', 'Clojure', 'COBOL', 'Crystal', 'Dart', 'Elixir',
  'Elm', 'Erlang', 'F#', 'Fortran', 'Go', 'Groovy', 'Haskell', 'Java', 'JavaScript', 'Julia',
  'Kotlin', 'Lisp', 'Lua', 'MATLAB', 'Nim', 'Objective-C', 'OCaml', 'Pascal', 'Perl', 'PHP',
  'Prolog', 'Python', 'R', 'Ruby', 'Rust', 'Scala', 'Scheme', 'Swift', 'TypeScript', 'Zig',
]

const slug = (s: string) => s.toLowerCase().replace(/\+/g, 'p').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function filter(query: string): string[] {
  const q = query.trim().toLowerCase()
  return q === '' ? ITEMS : ITEMS.filter((i) => i.toLowerCase().includes(q))
}

export default function C20Autocomplete({ api, status }: ChallengeProps) {
  // Multi-character targets so there is something to type and narrow down.
  const [target] = useState(() => api.rng('target').pick(ITEMS.filter((i) => i.length >= 4)))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()
  const debounce = useRef<number | undefined>(undefined)
  const mounted = useRef(true)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = `${api.id}-listbox`
  const uid = useId()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(debounce.current)
    }
  }, [])

  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const optionId = (item: string) => `${api.id}-option-${slug(item)}`

  const runFilter = (q: string) => {
    window.clearTimeout(debounce.current)
    setLoading(true)
    debounce.current = window.setTimeout(() => {
      setResults(filter(q))
      setActive(-1)
      setLoading(false)
    }, api.delay(150))
  }

  const onInput = (value: string) => {
    setQuery(value)
    setSelected(null)
    setOpen(true)
    runFilter(value)
  }

  const select = (item: string) => {
    window.clearTimeout(debounce.current)
    setLoading(false)
    setSelected(item)
    setQuery(item)
    setOpen(false)
    setActive(-1)
    api.log(`Selected suggestion ${item}`)
    // Picking a suggestion is never judged; only the committed value (Submit) is.
    set('info', `Selected ${item}. Press Submit to commit.`)
  }

  const submit = async () => {
    if (busy || status === 'passed') return
    const value = selected
    const text = query
    if (value === null && text.trim() === '') {
      api.log('Submit pressed with nothing entered')
      set('info', 'Type in the box and choose a suggestion first.')
      return
    }
    api.log(value ? `Submitted selection ${value}` : `Submitted free text "${text}"`)
    setBusy(true)
    const ok = await api.request(() => value === target, 'commit selection')
    if (!mounted.current) return
    setBusy(false)
    if (ok) {
      set('success', `Committed ${value}`)
      api.succeed(value ?? '')
    } else if (value === null) {
      set('error', 'Free text is not a selected suggestion')
      api.fail(`Free text submitted: "${text}"`)
    } else {
      set('error', `Wrong value committed: ${value}`)
      api.fail(`Committed ${value}`)
    }
  }

  /** Shows the list for the current query right away (arrow keys must not race the search debounce). */
  const openNow = () => {
    window.clearTimeout(debounce.current)
    const list = filter(query)
    setLoading(false)
    setResults(list)
    setOpen(true)
    return list
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!expanded) setActive(openNow().length > 0 ? 0 : -1)
        else setActive((a) => (a + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!expanded) setActive(openNow().length - 1)
        else setActive((a) => (a <= 0 ? results.length - 1 : a - 1))
        break
      case 'Home':
        if (expanded) {
          e.preventDefault()
          setActive(0)
        }
        break
      case 'End':
        if (expanded) {
          e.preventDefault()
          setActive(results.length - 1)
        }
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          setOpen(false)
          setActive(-1)
        }
        break
      case 'Enter':
        e.preventDefault()
        if (e.repeat) break
        if (expanded && active >= 0 && results[active]) select(results[active])
        else void submit()
        break
    }
  }

  const expanded = open && !loading && results.length > 0
  const activeItem = active >= 0 ? results[active] : undefined

  return (
    <div className="grid gap-4">
      <Task>
        Type in the combobox, choose the suggestion <Target>{target}</Target> and press Submit to commit it.
      </Task>
      <div className="grid max-w-md gap-1.5">
        <label htmlFor={`${api.id}-input`} className="text-sm font-medium">
          Language
        </label>
        <div className="relative">
          <input
            id={`${api.id}-input`}
            data-testid={`${api.id}-input`}
            data-value={selected ?? ''}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && activeItem ? optionId(activeItem) : undefined}
            aria-describedby={`${uid}-help`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Type to search languages"
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <ul
            ref={listRef}
            id={listId}
            data-testid={listId}
            role="listbox"
            aria-label="Suggestions"
            hidden={!expanded}
            className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {results.map((item, i) => (
              <li
                key={item}
                id={optionId(item)}
                data-testid={optionId(item)}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                className={cn('cursor-pointer rounded-sm px-2 py-1.5 text-sm', i === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p id={`${uid}-help`} className="text-xs text-muted-foreground">
          {loading ? 'Searching…' : open && results.length === 0 ? 'No suggestions' : 'Arrow keys + Enter or click to choose a suggestion.'}
        </p>
      </div>
      <p className="text-sm">
        Selected:{' '}
        <code id={`${api.id}-selected`} data-testid={`${api.id}-selected`} data-value={selected ?? ''} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {selected ?? 'none'}
        </code>
      </p>
      <div>
        <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} onClick={() => void submit()} disabled={busy}>
          Submit
        </Button>
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
