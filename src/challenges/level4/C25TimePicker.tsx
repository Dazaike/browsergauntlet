import { useMemo, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { pad2 } from '@/lib/utils'
import { nativeSelect, panel, useAlive } from './shared'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const PERIODS = ['AM', 'PM'] as const
type Period = (typeof PERIODS)[number]

export default function C25TimePicker({ api }: ChallengeProps) {
  const alive = useAlive()
  const target = useMemo(() => {
    const r = api.rng('target')
    return { hour: r.int(1, 12), minute: r.int(0, 59), period: r.pick(PERIODS) as Period }
  }, [api])

  const [hour, setHour] = useState('')
  const [minute, setMinute] = useState('')
  const [period, setPeriod] = useState<Period | ''>('')
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const label = (h: number, m: number, p: string) => `${h}:${pad2(m)} ${p}`
  const complete = hour !== '' && minute !== '' && period !== ''
  const current = complete ? label(Number(hour), Number(minute), period) : '--:-- --'
  const h24 = complete ? ((Number(hour) % 12) + (period === 'PM' ? 12 : 0)) * 60 + Number(minute) : -1

  const confirm = async () => {
    if (busy) return
    if (!complete) {
      set('error', 'Choose hour, minute and AM/PM first')
      api.log('Confirm pressed with incomplete time')
      return
    }
    setBusy(true)
    api.log(`Confirmed time ${current}`)
    const ok = await api.request(() => current === label(target.hour, target.minute, target.period), 'confirm time')
    if (!alive.current) return
    setBusy(false)
    if (ok) {
      set('success', `Time ${current} accepted`)
      api.succeed(`Confirmed ${current}`)
    } else {
      set('error', `Wrong time: ${current}`)
      api.fail(`Confirmed ${current}, expected ${label(target.hour, target.minute, target.period)}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Set the time to <Target>{label(target.hour, target.minute, target.period)}</Target> (hour, minute, AM/PM) and press Confirm.
      </Task>
      <div className={panel}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Hour" htmlFor={`${api.id}-hour`} className="w-24">
              <select
                id={`${api.id}-hour`}
                data-testid={`${api.id}-hour`}
                className={nativeSelect}
                value={hour}
                onChange={(e) => {
                  setHour(e.target.value)
                  api.log(`Hour set to ${e.target.value || 'none'}`)
                }}
              >
                <option value="">--</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Minute" htmlFor={`${api.id}-minute`} className="w-24">
              <select
                id={`${api.id}-minute`}
                data-testid={`${api.id}-minute`}
                className={nativeSelect}
                value={minute}
                onChange={(e) => {
                  setMinute(e.target.value)
                  api.log(`Minute set to ${e.target.value === '' ? 'none' : pad2(Number(e.target.value))}`)
                }}
              >
                <option value="">--</option>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Period</legend>
              <div role="radiogroup" aria-label="AM or PM" className="flex gap-4">
                {PERIODS.map((p) => (
                  <label key={p} htmlFor={`${api.id}-${p.toLowerCase()}`} className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${api.id}-period`}
                      id={`${api.id}-${p.toLowerCase()}`}
                      data-testid={`${api.id}-${p.toLowerCase()}`}
                      value={p}
                      checked={period === p}
                      onChange={() => {
                        setPeriod(p)
                        api.log(`Period set to ${p}`)
                      }}
                      className="size-4 accent-primary"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid gap-1">
              <span className="text-sm font-medium">Selected time</span>
              <output id={`${api.id}-selected`} data-testid={`${api.id}-selected`} data-value={h24} className="font-mono text-sm">
                {current}
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
