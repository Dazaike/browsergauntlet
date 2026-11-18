import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function C19TypingAccuracy({ api, status }: ChallengeProps) {
  const [phrase] = useState(() => api.rng('phrase').phrase(5))
  const [text, setText] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)
  const typingLog = useRef<number | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(typingLog.current)
    }
  }, [])

  useEffect(() => {
    if (startedAt === null) return
    const t = window.setInterval(() => setNow(performance.now()), 500)
    return () => window.clearInterval(t)
  }, [startedAt])

  const onChange = (value: string) => {
    if (startedAt === null && value.length > 0) {
      const t = performance.now()
      setStartedAt(t)
      setNow(t)
    }
    setText(value)
    setNow(performance.now())
    window.clearTimeout(typingLog.current)
    typingLog.current = window.setTimeout(() => api.log(`Typed ${value.length} characters`), 400)
  }

  const blocked = (e: ClipboardEvent | DragEvent, what: string) => {
    e.preventDefault()
    api.log(`${what} blocked`)
    set('info', `${what} is blocked. Type the phrase by hand.`)
  }

  const submit = async () => {
    if (busy || status === 'passed') return
    const typed = text
    api.log(`Submitted ${typed.length} characters`)
    setBusy(true)
    const ok = await api.request(() => typed === phrase, 'check phrase')
    if (!mounted.current) return
    setBusy(false)
    if (ok) {
      set('success', 'Phrase matches exactly')
      api.succeed(phrase)
    } else {
      set('error', typed.length === 0 ? 'Nothing typed' : 'Typed text does not match the phrase')
      api.fail(typed.length === 0 ? 'Empty submission' : 'Typed text differs from phrase')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault()
      void submit()
    }
  }

  let correct = 0
  for (let i = 0; i < text.length; i++) if (text[i] === phrase[i]) correct++
  const accuracy = text.length === 0 ? 100 : Math.round((correct / text.length) * 100)
  const minutes = startedAt === null ? 0 : Math.max(now - startedAt, 1) / 60000
  const wpm = minutes === 0 ? 0 : Math.round(correct / 5 / minutes)
  const extra = text.length > phrase.length ? text.slice(phrase.length) : ''

  return (
    <div className="grid gap-4">
      <Task>
        Type the phrase <Target>{phrase}</Target> exactly, then press Enter or Submit.
      </Task>
      <div
        id={`${api.id}-overlay`}
        data-testid={`${api.id}-overlay`}
        aria-label="Phrase with typing progress"
        className="rounded-lg border border-border bg-card p-4 font-mono text-lg leading-relaxed break-words select-none"
      >
        {phrase.split('').map((ch, i) => {
          const state = i >= text.length ? 'pending' : text[i] === ch ? 'correct' : 'wrong'
          return (
            <span
              key={i}
              data-state={state}
              className={cn(
                'whitespace-pre',
                state === 'pending' && 'text-muted-foreground',
                state === 'correct' && 'text-emerald-500',
                state === 'wrong' && 'rounded-sm bg-red-500/20 text-red-500',
                i === text.length && 'border-l-2 border-foreground',
              )}
            >
              {ch}
            </span>
          )
        })}
        {extra && (
          <span data-state="wrong" className="whitespace-pre rounded-sm bg-red-500/20 text-red-500">
            {extra}
          </span>
        )}
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${api.id}-input`} className="text-sm font-medium">
          Your typing
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`${api.id}-input`}
            data-testid={`${api.id}-input`}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => blocked(e, 'Paste')}
            onDrop={(e) => blocked(e, 'Drop')}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Start typing the phrase"
            className="min-w-48 flex-1 font-mono"
          />
          <Button id={`${api.id}-submit`} data-testid={`${api.id}-submit`} onClick={() => void submit()} disabled={busy}>
            Submit
          </Button>
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Accuracy</dt>
          <dd id={`${api.id}-accuracy`} data-testid={`${api.id}-accuracy`} data-value={accuracy}>
            {accuracy}%
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Speed</dt>
          <dd id={`${api.id}-wpm`} data-testid={`${api.id}-wpm`} data-value={wpm}>
            {wpm} WPM
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Typed</dt>
          <dd id={`${api.id}-progress`} data-testid={`${api.id}-progress`}>
            {text.length}/{phrase.length}
          </dd>
        </div>
      </dl>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
