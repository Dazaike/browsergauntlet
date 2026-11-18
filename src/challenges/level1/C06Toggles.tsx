import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const SETTINGS = ['Wi-Fi', 'Bluetooth', 'Airplane mode', 'Location', 'Dark mode', 'Auto-update', 'Notifications', 'Hotspot', 'Sync', 'Battery saver']

interface Row {
  name: string
  slug: string
  initial: boolean
  /** requested state, or null = leave unchanged */
  want: boolean | null
}

function Names({ names }: { names: string[] }) {
  return (
    <>
      {names.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && ', '}
          <Target>{n}</Target>
        </Fragment>
      ))}
    </>
  )
}

export default function C06Toggles({ api, status }: ChallengeProps) {
  const [rows] = useState<Row[]>(() => {
    const rng = api.rng('switches')
    const picked = rng.sample(SETTINGS, 6)
    const initial = picked.map(() => rng.bool())
    const requested = rng.sample([0, 1, 2, 3, 4, 5], rng.int(3, 4))
    return picked.map((name, i) => {
      const k = requested.indexOf(i)
      // first two requests always differ from the initial state, third always equals it
      const want = k < 0 ? null : k < 2 ? !initial[i] : k === 2 ? initial[i] : rng.bool()
      return { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), initial: initial[i], want }
    })
  })
  const [state, setState] = useState<boolean[]>(() => rows.map((r) => r.initial))
  const [done, setDone] = useState(false)
  const { fb, set } = useFeedback()

  const requestedOn = rows.filter((r) => r.want === true).map((r) => r.name)
  const requestedOff = rows.filter((r) => r.want === false).map((r) => r.name)

  const flip = (i: number, on: boolean) => {
    setState((s) => s.map((v, j) => (j === i ? on : v)))
    api.log(`${rows[i].name} switched ${on ? 'on' : 'off'}`)
  }

  const submit = () => {
    if (done || status === 'passed') return
    const wrong = rows.filter((r, i) => state[i] !== (r.want ?? r.initial)).map((r) => r.name)
    api.log(`Submitted switches (${wrong.length} wrong)`)
    if (wrong.length === 0) {
      setDone(true)
      set('success', 'All switches match')
      api.succeed('All switches correct')
    } else {
      set('error', `${wrong.length} switch${wrong.length === 1 ? ' is' : 'es are'} in the wrong state`)
      api.fail(`Wrong state: ${wrong.join(', ')}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        {requestedOn.length > 0 && (
          <>
            Turn <strong>ON</strong>: <Names names={requestedOn} />.{' '}
          </>
        )}
        {requestedOff.length > 0 && (
          <>
            Turn <strong>OFF</strong>: <Names names={requestedOff} />.{' '}
          </>
        )}
        Leave the other switches unchanged, then submit.
      </Task>
      <div role="group" aria-label="Switches" className="grid max-w-md gap-1 rounded-lg border border-border p-3">
        {rows.map((r, i) => (
          <div key={r.slug} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
            <label htmlFor={`${api.id}-switch-${r.slug}`} className="flex-1 cursor-pointer text-sm">
              {r.name}
            </label>
            <span id={`${api.id}-state-${r.slug}`} className="w-8 text-right text-xs text-muted-foreground">
              {state[i] ? 'On' : 'Off'}
            </span>
            <Switch
              id={`${api.id}-switch-${r.slug}`}
              data-testid={`${api.id}-switch-${r.slug}`}
              checked={state[i]}
              disabled={done}
              onCheckedChange={(v) => flip(i, v)}
            />
          </div>
        ))}
      </div>
      <div>
        <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} type="button" disabled={done} onClick={submit}>
          Submit
        </Button>
      </div>
      <Feedback id={`${api.id}-feedback`} state={fb} />
    </div>
  )
}
