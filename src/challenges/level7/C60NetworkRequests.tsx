import { useRef, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Task, useFeedback } from '@/challenges/kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtMs } from '@/lib/utils'

type ReqState = 'pending' | 'resolved'

interface Req {
  n: number
  state: ReqState
  ms?: number
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export default function C60NetworkRequests({ api, status }: ChallengeProps) {
  const [reqs, setReqs] = useState<Req[]>([])
  const [code, setCode] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const counter = useRef(0)
  const inFlight = useRef(false)
  const { fb, set } = useFeedback()
  const locked = status === 'passed' || status === 'failed'

  const latest = reqs[reqs.length - 1]
  const state: 'idle' | ReqState = latest ? latest.state : 'idle'
  const pending = state === 'pending'

  const fetchCode = () => {
    if (pending || inFlight.current || locked) return
    inFlight.current = true
    const n = ++counter.current
    const started = performance.now()
    setCode(null)
    setValue('')
    setReqs((r) => [...r, { n, state: 'pending' }])
    set('info', `Request req-${n} sent`)
    api.log(`Fetch clicked (req-${n})`)
    void api
      .request(() => {
        const r = api.rng(`fetch-${n}`)
        return `REQ-${r.string(4, CODE_ALPHABET)}-${r.digits(2)}`
      }, `fetch req-${n}`)
      .then((c) => {
        inFlight.current = false
        const ms = performance.now() - started
        setCode(c)
        setReqs((r) => r.map((q) => (q.n === n ? { ...q, state: 'resolved', ms } : q)))
        set('info', `Response for req-${n} received`)
      })
  }

  // Only reachable once a response has arrived: the form and its controls are disabled until then.
  const verify = (current: string) => {
    if (locked) return
    api.log('Verify submitted')
    if (value.trim() === current) {
      set('success', 'Reference code verified')
      api.succeed(`Verified ${current}`)
    } else {
      set('error', 'Wrong reference code')
      api.fail('Wrong reference code')
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Press <strong>Fetch</strong>, wait for the simulated request to resolve, then type the reference code shown in the response into the verify field. If you fetch again, the code changes: verify the latest one.
      </Task>

      <div className="flex flex-wrap items-center gap-2">
        <Button id={`${api.id}-fetch`} data-testid={`${api.id}-fetch`} onClick={fetchCode} disabled={pending}>
          {pending ? 'Fetching…' : latest ? 'Fetch again' : 'Fetch'}
        </Button>
        <Badge variant="outline" data-testid={`${api.id}-state-badge`}>
          {state}
        </Badge>
      </div>

      <div
        id={`${api.id}-response`}
        data-testid={`${api.id}-response`}
        data-state={state}
        data-request-id={latest ? `req-${latest.n}` : ''}
        aria-busy={pending}
        className="grid gap-2 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Response</span>
          <span id={`${api.id}-request-id`} data-testid={`${api.id}-request-id`} className="font-mono">
            {latest ? `req-${latest.n}` : 'no request yet'}
          </span>
        </div>
        {state === 'idle' && <p className="text-sm text-muted-foreground">Nothing fetched yet.</p>}
        {pending && (
          <div className="grid gap-2" data-testid={`${api.id}-skeleton`}>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        )}
        {state === 'resolved' && code !== null && (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Reference code</p>
            <code id={`${api.id}-code`} data-testid={`${api.id}-code`} className="w-fit rounded bg-muted px-2 py-1 font-mono text-lg font-medium">
              {code}
            </code>
          </div>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (code !== null) verify(code)
        }}
      >
        <Field label="Reference code" htmlFor={`${api.id}-verify-input`} className="min-w-0 flex-1 basis-48">
          <Input
            id={`${api.id}-verify-input`}
            data-testid={`${api.id}-verify-input`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={code === null}
            autoComplete="off"
            spellCheck={false}
            placeholder={code === null ? 'Waiting for response…' : 'REQ-XXXX-00'}
          />
        </Field>
        <Button type="submit" id={`${api.id}-verify`} data-testid={`${api.id}-verify`} disabled={code === null}>
          Verify
        </Button>
      </form>

      <div className="grid gap-1.5">
        <p className="text-sm font-medium">Request timeline</p>
        <ol id={`${api.id}-timeline`} data-testid={`${api.id}-timeline`} aria-label="Request timeline" className="grid gap-1 text-xs">
          {reqs.length === 0 && <li className="text-muted-foreground">No requests yet.</li>}
          {reqs.map((r) => (
            <li key={r.n} data-request-id={`req-${r.n}`} data-state={r.state} className="flex items-center justify-between rounded border border-border px-2 py-1">
              <span className="font-mono">req-{r.n}</span>
              <span className="text-muted-foreground">{r.state === 'resolved' ? `resolved in ${fmtMs(r.ms)}` : 'pending…'}</span>
            </li>
          ))}
        </ol>
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
