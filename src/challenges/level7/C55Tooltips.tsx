import { useState } from 'react'
import { Info } from 'lucide-react'
import { Feedback, Task, Target, useFeedback, Field } from '@/challenges/kit'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'

const TOPICS = ['Billing', 'Account', 'Shipping', 'Security']
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'

interface InfoRowProps {
  api: ChallengeApi
  topic: string
  code: string
  disabled: boolean
}

function InfoRow({ api, topic, code, disabled }: InfoRowProps) {
  const key = topic.toLowerCase()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const label = `${topic} info`

  const copy = async () => {
    api.log(`Copy pressed in ${label} tooltip`)
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-sm">{topic}</span>
      <HoverCard
        openDelay={api.delay(120)}
        closeDelay={200}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) api.log(`${label} tooltip opened`)
          else setCopied(false)
        }}
      >
        <HoverCardTrigger asChild>
          <button
            type="button"
            id={`c55-info-${key}`}
            data-testid={`c55-info-${key}`}
            aria-label={label}
            aria-describedby={open ? `c55-tooltip-${key}` : undefined}
            disabled={disabled}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Info className="size-4" aria-hidden />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          id={`c55-tooltip-${key}`}
          data-testid={`c55-tooltip-${key}`}
          role="tooltip"
          className="flex w-56 flex-col gap-2 p-3"
        >
          <span className="text-xs text-muted-foreground">{label} code</span>
          <div className="flex items-center justify-between gap-2">
            <code id={`c55-code-${key}`} data-testid={`c55-code-${key}`} className="rounded bg-muted px-2 py-1 font-mono text-sm">{code}</code>
            <Button type="button" size="xs" variant="outline" id={`c55-copy-${key}`} data-testid={`c55-copy-${key}`} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </HoverCardContent>
      </HoverCard>
    </li>
  )
}

export default function C55Tooltips({ api, status }: ChallengeProps) {
  const [plan] = useState(() => {
    const r = api.rng('plan')
    const topics = r.shuffle(TOPICS)
    const codes: string[] = []
    while (codes.length < topics.length) {
      const c = `${r.string(1, LETTERS)}${r.digits(1)}-${r.digits(2)}${r.string(1, LETTERS)}`
      if (!codes.includes(c)) codes.push(c)
    }
    return { topics, codes, target: r.int(0, topics.length - 1) }
  })
  const [answer, setAnswer] = useState('')
  const { fb, set } = useFeedback()
  const locked = status === 'passed' || status === 'failed'
  const targetTopic = plan.topics[plan.target]

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    const typed = answer.trim()
    api.log(`Verify submitted for ${targetTopic} info`)
    if (typed === '') {
      set('error', 'Enter the code first')
      return
    }
    if (typed === plan.codes[plan.target]) {
      set('success', 'Code accepted')
      api.succeed('code matched')
    } else {
      set('error', 'Code does not match the tooltip')
      api.fail('wrong code')
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Hover or keyboard-focus the <Target>{targetTopic} info</Target> icon, read the code in its tooltip, then enter it below and press Verify.
      </Task>
      <ul className="grid max-w-md gap-2" aria-label="Info icons">
        {plan.topics.map((topic, i) => (
          <InfoRow key={topic} api={api} topic={topic} code={plan.codes[i]} disabled={locked} />
        ))}
      </ul>
      <form onSubmit={verify} className="grid max-w-md gap-3">
        <Field label="Code" htmlFor="c55-input">
          <Input id="c55-input" data-testid="c55-input" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" spellCheck={false} disabled={locked} />
        </Field>
        <div>
          <Button type="submit" id="c55-verify" data-testid="c55-verify" disabled={locked}>Verify</Button>
        </div>
      </form>
      <Feedback state={fb} id="c55-feedback" />
    </div>
  )
}
