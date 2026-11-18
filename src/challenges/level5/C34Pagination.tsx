import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import type { ChallengeProps } from '@/challenges/types'

const PER_PAGE = 10
const PAGES = 12

interface Row {
  id: string
  name: string
}

function pageWindow(current: number): (number | 'gap-l' | 'gap-r')[] {
  const out: (number | 'gap-l' | 'gap-r')[] = [1]
  if (current > 3) out.push('gap-l')
  for (let p = Math.max(2, current - 1); p <= Math.min(PAGES - 1, current + 1); p++) out.push(p)
  if (current < PAGES - 2) out.push('gap-r')
  out.push(PAGES)
  return out
}

export default function C34Pagination({ api }: ChallengeProps) {
  const data = useMemo(() => {
    const r = api.rng('data')
    const names = new Set<string>()
    const rows: Row[] = []
    while (rows.length < PAGES * PER_PAGE) {
      const name = `${r.word()}-${r.digits(3)}`
      if (names.has(name)) continue
      names.add(name)
      rows.push({ id: `rec-${rows.length + 1}`, name })
    }
    const t = api.rng('target')
    const targetPage = t.int(3, PAGES - 1)
    const targetRow = rows[(targetPage - 1) * PER_PAGE + t.int(0, PER_PAGE - 1)]
    return { rows, targetPage, targetRow }
  }, [api])

  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const { fb, set } = useFeedback()
  const alive = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const goTo = async (p: number) => {
    if (busy || p < 1 || p > PAGES || p === page) return
    setBusy(true)
    api.log(`Navigating to page ${p}`)
    const next = await api.request(() => p, `load page ${p}`)
    if (!alive.current) return
    setPage(next)
    setBusy(false)
    set('info', `Showing page ${next} of ${PAGES}.`)
  }

  const link = (p: number) => (e: MouseEvent) => {
    e.preventDefault()
    void goTo(p)
  }

  const pick = (row: Row) => {
    setSelected(row.id)
    api.log(`Selected ${row.name} on page ${page}`)
    if (row.id === data.targetRow.id) {
      set('success', `${row.name} selected.`)
      api.succeed(`${row.name} selected on page ${page}`)
    } else {
      set('error', `Wrong item: ${row.name}`)
      api.fail(`Selected ${row.name} on page ${page}`)
    }
  }

  const visible = data.rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const off = 'pointer-events-none opacity-50'

  return (
    <div className="grid gap-4">
      <Task>
        Go to page <Target>{data.targetPage}</Target> and select the item <Target>{data.targetRow.name}</Target>.
      </Task>
      <p id="c34-page-indicator" data-testid="c34-page-indicator" data-page={page} className="text-sm text-muted-foreground">
        Page {page} of {PAGES} · {data.rows.length} items
      </p>
      <ul
        id="c34-list"
        data-testid="c34-list"
        role="listbox"
        aria-label={`Items on page ${page}`}
        aria-busy={busy}
        className={cn('divide-y divide-border rounded-lg border border-border bg-card', busy && 'opacity-60')}
      >
        {visible.map((row) => (
          <li
            key={row.id}
            id={`c34-item-${row.id}`}
            data-testid={`c34-item-${row.id}`}
            role="option"
            aria-selected={selected === row.id}
            tabIndex={0}
            onClick={() => pick(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick(row)
              }
            }}
            className={cn('flex h-10 cursor-pointer items-center justify-between px-3 text-sm outline-none hover:bg-muted focus-visible:bg-muted aria-selected:bg-muted aria-selected:font-medium', busy && 'pointer-events-none')}
          >
            <span>{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.id}</span>
          </li>
        ))}
      </ul>
      <Pagination>
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationPrevious id="c34-prev" data-testid="c34-prev" href="#" aria-disabled={page === 1 || busy} tabIndex={page === 1 ? -1 : 0} className={cn(page === 1 && off)} onClick={link(page - 1)} />
          </PaginationItem>
          {pageWindow(page).map((p) =>
            typeof p === 'number' ? (
              <PaginationItem key={p}>
                <PaginationLink id={`c34-page-${p}`} data-testid={`c34-page-${p}`} href="#" aria-label={`Go to page ${p}`} isActive={p === page} onClick={link(p)}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationEllipsis />
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext id="c34-next" data-testid="c34-next" href="#" aria-disabled={page === PAGES || busy} tabIndex={page === PAGES ? -1 : 0} className={cn(page === PAGES && off)} onClick={link(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <Feedback state={fb} id="c34-feedback" />
    </div>
  )
}
