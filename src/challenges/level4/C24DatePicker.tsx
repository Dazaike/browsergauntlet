import { useMemo, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { pad2 } from '@/lib/utils'
import { MONTHS, panel, useAlive } from './shared'

// Fixed anchor so targets never depend on the real clock.
const ANCHOR_YEAR = 2026
const ANCHOR_MONTH = 0 // January
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const human = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

export default function C24DatePicker({ api }: ChallengeProps) {
  const alive = useAlive()
  const target = useMemo(() => {
    const r = api.rng('target')
    const offset = r.int(2, 18) * (r.bool() ? 1 : -1)
    return new Date(ANCHOR_YEAR, ANCHOR_MONTH + offset, r.int(1, 28))
  }, [api])

  const [month, setMonth] = useState(() => new Date(ANCHOR_YEAR, ANCHOR_MONTH, 1))
  const [selected, setSelected] = useState<Date | undefined>()
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const confirm = async () => {
    if (busy) return
    if (!selected) {
      set('error', 'No date selected')
      api.log('Confirm pressed with no date')
      return
    }
    setBusy(true)
    const value = iso(selected)
    api.log(`Confirmed date ${value}`)
    const ok = await api.request(() => value === iso(target), 'confirm date')
    if (!alive.current) return
    setBusy(false)
    if (ok) {
      set('success', `Date ${value} accepted`)
      api.succeed(`Confirmed ${value}`)
    } else {
      set('error', `Wrong date: ${value}`)
      api.fail(`Confirmed ${value}, expected ${iso(target)}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Select <Target>{human(target)}</Target> in the calendar, then press Confirm. The calendar opens on January 2026.
      </Task>
      <div className={panel}>
        <div className="flex flex-wrap items-start gap-6">
          <div id={`${api.id}-calendar`} data-testid={`${api.id}-calendar`} className="max-w-full overflow-x-auto rounded-md border border-border">
            <Calendar
              mode="single"
              required
              captionLayout="dropdown"
              month={month}
              onMonthChange={(m) => {
                setMonth(m)
                api.log(`Calendar moved to ${MONTHS[m.getMonth()]} ${m.getFullYear()}`)
              }}
              startMonth={new Date(2024, 0, 1)}
              endMonth={new Date(2028, 11, 31)}
              selected={selected}
              onSelect={(d) => {
                if (!d) return
                setSelected(d)
                set('info', `Selected ${iso(d)}`)
                api.log(`Selected date ${iso(d)}`)
              }}
            />
          </div>
          <div className="grid min-w-48 gap-3">
            <div className="grid gap-1">
              <span className="text-sm font-medium">Selected date</span>
              <output id={`${api.id}-selected`} data-testid={`${api.id}-selected`} data-value={selected ? iso(selected) : ''} className="font-mono text-sm">
                {selected ? iso(selected) : 'none'}
              </output>
            </div>
            <Button id={`${api.id}-confirm`} data-testid={`${api.id}-confirm`} onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
