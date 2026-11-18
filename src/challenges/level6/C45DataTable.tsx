import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

type SortKey = 'id' | 'name' | 'dept' | 'status' | 'score' | 'salary' | 'joined'
type Action = 'Archive' | 'Delete' | 'Export' | 'Promote'

interface Row {
  id: string
  name: string
  dept: string
  status: string
  score: number
  salary: number
  joined: string
}

interface Spec {
  dept: string
  status: string
  sort: { key: 'score' | 'salary' | 'joined'; dir: 'asc' | 'desc'; label: string }
  count: number
  action: Action
}

const DEPTS = ['Eng', 'Ops', 'Sales', 'Design', 'Support']
const STATUSES = ['Active', 'Pending', 'Inactive']
const STATUS_FILTER = ['Active', 'Pending', 'Inactive', 'Archived', 'Promoted']
const ACTIONS: Action[] = ['Archive', 'Delete', 'Export', 'Promote']
const FIRST = ['Ana', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farid', 'Grace', 'Hugo', 'Iris', 'Jonas', 'Kira', 'Liam', 'Mina', 'Noah', 'Opal', 'Pavel', 'Quinn', 'Rosa', 'Sven', 'Tara']
const LAST = ['Adler', 'Brandt', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Gomez', 'Haddad', 'Ito', 'Jovanovic', 'Kaur', 'Lindgren', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quist', 'Rossi', 'Silva', 'Tanaka']
const SORTS: Spec['sort'][] = [
  { key: 'score', dir: 'desc', label: 'Score, highest first' },
  { key: 'salary', dir: 'desc', label: 'Salary, highest first' },
  { key: 'joined', dir: 'asc', label: 'Joined, oldest first' },
]
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'dept', label: 'Department' },
  { key: 'status', label: 'Status' },
  { key: 'score', label: 'Score', numeric: true },
  { key: 'salary', label: 'Salary', numeric: true },
  { key: 'joined', label: 'Joined' },
]
const SELECT_CLS = 'h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

function compare(a: Row, b: Row, key: SortKey): number {
  const x = a[key]
  const y = b[key]
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
}

/** Stable in both directions: rows with equal keys always keep ascending ID order. */
function sortRows(rows: Row[], key: SortKey, dir: 'asc' | 'desc'): Row[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows.slice().sort((a, b) => sign * compare(a, b, key) || a.id.localeCompare(b.id))
}

function build(api: ChallengeProps['api']): { rows: Row[]; spec: Spec; targetIds: string[] } {
  const rng = api.rng('data')
  const spec: Spec = {
    dept: rng.pick(DEPTS),
    status: rng.pick(STATUSES),
    sort: rng.pick(SORTS),
    count: rng.int(2, 4),
    action: rng.pick(ACTIONS),
  }
  const combos: [string, string][] = []
  for (let i = 0; i < 7; i++) combos.push([spec.dept, spec.status])
  while (combos.length < 40) combos.push([rng.pick(DEPTS), rng.pick(STATUSES)])
  const shuffled = rng.shuffle(combos)
  const scores = rng.sample(Array.from({ length: 60 }, (_, i) => 40 + i), 40)
  const salaries = rng.sample(Array.from({ length: 120 }, (_, i) => i), 40)
  const days = rng.sample(Array.from({ length: 3000 }, (_, i) => i), 40)
  const names = new Set<string>()
  while (names.size < 40) names.add(`${rng.pick(FIRST)} ${rng.pick(LAST)}`)
  const nameList = Array.from(names)
  const rows: Row[] = shuffled.map(([dept, status], i) => ({
    id: `E-${1001 + i}`,
    name: nameList[i],
    dept,
    status,
    score: scores[i],
    salary: 42000 + salaries[i] * 500,
    joined: new Date(Date.UTC(2018, 0, 1) + days[i] * 86400000).toISOString().slice(0, 10),
  }))
  const matching = rows.filter((r) => r.dept === spec.dept && r.status === spec.status)
  const targetIds = sortRows(matching, spec.sort.key, spec.sort.dir).slice(0, spec.count).map((r) => r.id)
  return { rows, spec, targetIds }
}

export default function C45DataTable({ api }: ChallengeProps) {
  const [{ rows: initialRows, spec, targetIds }] = useState(() => build(api))
  const [rows, setRows] = useState<Row[]>(() => (api.settings.dynamic ? [] : initialRows))
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [exported, setExported] = useState('')
  const { fb, set } = useFeedback()
  const mounted = useRef(true)
  const searchLogTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(searchLogTimer.current)
    }
  }, [])

  // Stress mode: rows arrive late (never while the user could have a stale target).
  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setRows(initialRows), api.delay(700))
    return () => clearTimeout(t)
  }, [api, initialRows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) &&
        (!statusFilter || r.status === statusFilter) &&
        (!deptFilter || r.dept === deptFilter),
    )
    return sort ? sortRows(filtered, sort.key, sort.dir) : filtered
  }, [rows, sort, search, statusFilter, deptFilter])

  const selectedVisible = visible.filter((r) => selected.has(r.id)).length
  const allVisible = visible.length > 0 && selectedVisible === visible.length
  const hidden = selected.size - selectedVisible

  const toggleSort = (key: SortKey) => {
    const dir = sort && sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc'
    setSort({ key, dir })
    api.log(`Sorted by ${key} ${dir === 'asc' ? 'ascending' : 'descending'}`)
  }

  const toggleRow = (r: Row, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(r.id)
      else next.delete(r.id)
      return next
    })
    api.log(`${checked ? 'Selected' : 'Deselected'} row ${r.id}`)
  }

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of visible) {
        if (checked) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
    api.log(`${checked ? 'Selected' : 'Deselected'} all ${visible.length} filtered rows`)
  }

  const apply = async () => {
    if (!pending || busy || selected.size === 0) return
    const action = pending
    const ids = Array.from(selected).sort()
    setBusy(true)
    api.log(`Applying ${action} to ${ids.length} rows: ${ids.join(', ')}`)
    await api.request(() => null, `bulk ${action.toLowerCase()}`)
    if (!mounted.current) return
    setBusy(false)
    setPending(null)
    const expected = [...targetIds].sort()
    const sameSet = ids.length === expected.length && ids.every((id, i) => id === expected[i])
    if (action !== spec.action) {
      set('error', `Wrong action: ${action} was not applied`)
      api.fail(`Wrong bulk action: ${action}`)
      return
    }
    if (!sameSet) {
      set('error', `Wrong rows: ${action} was not applied to ${ids.length} selected rows`)
      api.fail(`${action} applied to the wrong rows (${ids.join(', ')})`)
      return
    }
    if (action === 'Archive' || action === 'Promote') {
      const status = action === 'Archive' ? 'Archived' : 'Promoted'
      setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, status } : r)))
    } else if (action === 'Delete') {
      setRows((prev) => prev.filter((r) => !selected.has(r.id)))
    } else {
      setExported(['id,name,department,status,score', ...rows.filter((r) => selected.has(r.id)).map((r) => `${r.id},${r.name},${r.dept},${r.status},${r.score}`)].join('\n'))
    }
    setSelected(new Set())
    set('success', `${action} applied to ${ids.length} rows: ${ids.join(', ')}`)
    api.succeed(`${action} on ${ids.join(', ')}`)
  }

  return (
    <div className="grid gap-4">
      <Task>
        Filter the table to department <Target>{spec.dept}</Target> and status <Target>{spec.status}</Target>. Sort by <Target>{spec.sort.label}</Target>. Select the top <Target>{String(spec.count)}</Target> rows of the result, then run{' '}
        <Target>{spec.action}</Target> on them and press Apply.
      </Task>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="grid gap-1.5">
          <label htmlFor="c45-search" className="text-xs font-medium text-muted-foreground">Search name or ID</label>
          <Input
            id="c45-search"
            data-testid="c45-search"
            value={search}
            placeholder="Search…"
            onChange={(e) => {
              setSearch(e.target.value)
              clearTimeout(searchLogTimer.current)
              const v = e.target.value
              searchLogTimer.current = setTimeout(() => api.log(`Search text set to "${v}"`), 400)
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="c45-status" className="text-xs font-medium text-muted-foreground">Status</label>
          <select id="c45-status" data-testid="c45-status" className={SELECT_CLS} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); api.log(`Status filter: ${e.target.value || 'all'}`) }}>
            <option value="">All statuses</option>
            {STATUS_FILTER.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="c45-department" className="text-xs font-medium text-muted-foreground">Department</label>
          <select id="c45-department" data-testid="c45-department" className={SELECT_CLS} value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); api.log(`Department filter: ${e.target.value || 'all'}`) }}>
            <option value="">All departments</option>
            {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-card p-3" role="toolbar" aria-label="Bulk actions">
        <div className="flex flex-wrap items-center gap-2">
          <span id="c45-selected-count" data-testid="c45-selected-count" data-count={selected.size} className="mr-2 text-sm font-medium tabular-nums">
            {selected.size} selected{hidden > 0 && <span className="font-normal text-muted-foreground"> ({hidden} hidden by filters)</span>}
          </span>
          {ACTIONS.map((a) => (
            <Button
              key={a}
              id={`c45-action-${a.toLowerCase()}`}
              data-testid={`c45-action-${a.toLowerCase()}`}
              variant={a === 'Delete' ? 'destructive' : 'outline'}
              size="sm"
              aria-pressed={pending === a}
              disabled={selected.size === 0 || busy}
              onClick={() => {
                setPending(a)
                api.log(`Bulk action chosen: ${a}`)
              }}
            >
              {a}
            </Button>
          ))}
          <Button id="c45-clear" data-testid="c45-clear" variant="ghost" size="sm" disabled={selected.size === 0 || busy} onClick={() => { setSelected(new Set()); setPending(null); api.log('Selection cleared') }}>
            Clear selection
          </Button>
        </div>
        {pending && selected.size > 0 && (
          <div id="c45-confirm" data-testid="c45-confirm" role="group" aria-label="Confirm bulk action" className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span>
              Confirm <strong>{pending}</strong> on <strong>{selected.size}</strong> selected {selected.size === 1 ? 'row' : 'rows'}?
            </span>
            <Button id="c45-apply" data-testid="c45-apply" size="sm" disabled={busy} onClick={apply}>{busy ? 'Applying…' : 'Apply'}</Button>
            <Button id="c45-cancel" data-testid="c45-cancel" variant="ghost" size="sm" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table id="c45-table" data-testid="c45-table" data-row-count={visible.length} aria-label="Employees">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  id="c45-select-all"
                  data-testid="c45-select-all"
                  aria-label="Select all filtered rows"
                  className="size-4 accent-primary"
                  disabled={visible.length === 0}
                  checked={allVisible}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedVisible > 0 && !allVisible
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              {COLUMNS.map((c) => {
                const active = sort?.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <TableHead key={c.key} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(c.numeric && 'text-right')}>
                    <button id={`c45-sort-${c.key}`} data-testid={`c45-sort-${c.key}`} type="button" onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 rounded-sm font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50', !active && 'text-muted-foreground')}>
                      {c.label}
                      <Icon className="size-3.5" aria-hidden />
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id} id={`c45-row-${r.id}`} data-testid={`c45-row-${r.id}`} data-id={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    id={`c45-check-${r.id}`}
                    data-testid={`c45-check-${r.id}`}
                    aria-label={`Select ${r.name} (${r.id})`}
                    className="size-4 accent-primary"
                    checked={selected.has(r.id)}
                    onChange={(e) => toggleRow(r, e.target.checked)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{r.id}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.dept}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-right tabular-nums">{r.score}</TableCell>
                <TableCell className="text-right tabular-nums">${r.salary.toLocaleString('en-US')}</TableCell>
                <TableCell className="tabular-nums">{r.joined}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="py-6 text-center text-muted-foreground">
                  {rows.length === 0 ? 'Loading rows…' : 'No rows match the current filters.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p id="c45-showing" className="border-t border-border px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
          Showing {visible.length} of {rows.length} rows
        </p>
      </div>

      {exported && (
        <pre id="c45-export-output" data-testid="c45-export-output" className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">{exported}</pre>
      )}
      <Feedback id="c45-feedback" state={fb} />
    </div>
  )
}
