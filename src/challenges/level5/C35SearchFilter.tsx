import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const CATEGORIES = ['Hardware', 'Software', 'Services', 'Media', 'Office', 'Outdoor']
const STATUSES = ['Active', 'Archived', 'Draft', 'Pending']
const FRAGS = ['qz', 'xq', 'jx', 'vq', 'kz', 'wj']

interface Item {
  id: string
  name: string
  category: string
  status: string
}

/** 60 items. Exactly one has (target category, target status, name containing frag); the frag never occurs in any other name by accident. */
function build(api: ChallengeProps['api']) {
  const r = api.rng('data')
  const category = r.pick(CATEGORIES)
  const status = r.pick(STATUSES)
  const frag = r.pick(FRAGS)
  const used = new Set<string>()
  const name = (withFrag: boolean) => {
    for (;;) {
      const n = withFrag ? `${r.word()}-${frag}${r.digits(2)}` : `${r.word()}-${r.digits(3)}`
      if (!used.has(n)) {
        used.add(n)
        return n
      }
    }
  }
  const otherCat = () => r.pick(CATEGORIES.filter((c) => c !== category))
  const otherStat = () => r.pick(STATUSES.filter((s) => s !== status))
  const draft: Omit<Item, 'id'>[] = [{ name: name(true), category, status }]
  // frag decoys: differ in category only, or status only, or both
  for (let i = 0; i < 2; i++) draft.push({ name: name(true), category: otherCat(), status })
  for (let i = 0; i < 2; i++) draft.push({ name: name(true), category, status: otherStat() })
  draft.push({ name: name(true), category: otherCat(), status: otherStat() })
  // same category+status without frag
  for (let i = 0; i < 3; i++) draft.push({ name: name(false), category, status })
  while (draft.length < 60) draft.push({ name: name(false), category: r.pick(CATEGORIES), status: r.pick(STATUSES) })
  const items: Item[] = r.shuffle(draft).map((d, i) => ({ ...d, id: `item-${i + 1}` }))
  const target = items.find((it) => it.category === category && it.status === status && it.name.includes(frag))!
  return { items, target, category, status, frag }
}

export default function C35SearchFilter({ api }: ChallengeProps) {
  const data = useMemo(() => build(api), [api])
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const { fb, set } = useFeedback()

  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(query.trim().toLowerCase())
      if (query.trim()) api.log(`Search "${query.trim()}"`)
    }, api.delay(200))
    return () => clearTimeout(t)
  }, [query, api])

  const results = data.items.filter(
    (it) => (!applied || it.name.toLowerCase().includes(applied)) && (!category || it.category === category) && (!status || it.status === status),
  )

  const pick = (it: Item) => {
    setPicked(it.id)
    api.log(`Selected ${it.name} (${it.category}, ${it.status})`)
    if (it.id === data.target.id) {
      set('success', `${it.name} selected.`)
      api.succeed(`${it.name} selected`)
    } else {
      set('error', `Wrong item: ${it.name} (${it.category}, ${it.status})`)
      api.fail(`Selected ${it.name}`)
    }
  }

  const selectCls = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

  return (
    <div className="grid gap-4">
      <Task>
        Find the <Target>{data.status}</Target> <Target>{data.category}</Target> item whose name contains <Target>{data.frag}</Target>, then click it.
      </Task>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Search name" htmlFor="c35-search">
          <Input id="c35-search" data-testid="c35-search" type="search" value={query} autoComplete="off" placeholder="Type to search" onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="c35-category">
          <select
            id="c35-category"
            data-testid="c35-category"
            className={selectCls}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              api.log(`Category filter: ${e.target.value || 'All'}`)
            }}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="c35-status">
          <select
            id="c35-status"
            data-testid="c35-status"
            className={selectCls}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              api.log(`Status filter: ${e.target.value || 'All'}`)
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <p id="c35-count" data-testid="c35-count" data-count={results.length} role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {results.length} of {data.items.length} items
      </p>
      <ul id="c35-results" data-testid="c35-results" aria-label="Results" className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No items match.</li>}
        {results.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              id={`c35-${it.id}`}
              data-testid={`c35-${it.id}`}
              data-selected={picked === it.id}
              onClick={() => pick(it)}
              className={cn('flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted', picked === it.id && 'bg-muted')}
            >
              <span className="font-medium">{it.name}</span>
              <span className="flex gap-1.5">
                <Badge variant="outline">{it.category}</Badge>
                <Badge variant="secondary">{it.status}</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Feedback state={fb} id="c35-feedback" />
    </div>
  )
}
