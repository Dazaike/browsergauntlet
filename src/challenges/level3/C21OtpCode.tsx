import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'

const LEN = 6

export default function C21OtpCode({ api, status }: ChallengeProps) {
  const [code] = useState(() => api.rng('code').digits(LEN))
  const [digits, setDigits] = useState<string[]>(() => Array<string>(LEN).fill(''))
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const mounted = useRef(true)
  const fieldLog = useRef<number | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(fieldLog.current)
    }
  }, [])

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(LEN - 1, i))]
    el?.focus()
    el?.select()
  }

  const logSoon = (next: string[]) => {
    window.clearTimeout(fieldLog.current)
    fieldLog.current = window.setTimeout(() => api.log(`OTP boxes filled: ${next.filter(Boolean).length}/${LEN}`), 400)
  }

  /** Write `chars` into consecutive boxes starting at `from`; focus the box after the last one written. */
  const distribute = (from: number, chars: string) => {
    if (chars.length === 0) return
    const next = digits.slice()
    let i = from
    for (const ch of chars) {
      if (i >= LEN) break
      next[i++] = ch
    }
    setDigits(next)
    logSoon(next)
    focusAt(i)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      distribute(i, e.key)
      return
    }
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault()
        const next = digits.slice()
        if (next[i] !== '') {
          next[i] = ''
          setDigits(next)
        } else if (i > 0) {
          next[i - 1] = ''
          setDigits(next)
          focusAt(i - 1)
        }
        logSoon(next)
        break
      }
      case 'Delete': {
        e.preventDefault()
        const next = digits.slice()
        next[i] = ''
        setDigits(next)
        logSoon(next)
        break
      }
      case 'ArrowLeft':
        e.preventDefault()
        focusAt(i - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusAt(i + 1)
        break
      case 'Enter':
        e.preventDefault()
        if (!e.repeat) void verify()
        break
      default:
        // Block letters and other printable characters; Tab and friends pass through.
        if (e.key.length === 1) e.preventDefault()
    }
  }

  // Mobile keyboards, autofill and programmatic fills reach us via change events only.
  const onChange = (e: ChangeEvent<HTMLInputElement>, i: number) => {
    const chars = e.target.value.replace(/\D/g, '')
    if (chars === '') {
      const next = digits.slice()
      next[i] = ''
      setDigits(next)
      logSoon(next)
    } else {
      distribute(chars.length >= LEN ? 0 : i, chars)
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault()
    const chars = e.clipboardData.getData('text').replace(/\D/g, '')
    api.log(`Pasted ${chars.length} digits`)
    distribute(chars.length >= LEN ? 0 : i, chars.slice(0, LEN))
  }

  const verify = async () => {
    if (busy || status === 'passed') return
    const entered = digits.join('')
    api.log(`Verify pressed with ${entered.length}/${LEN} digits`)
    setBusy(true)
    const ok = await api.request(() => entered === code, 'verify code')
    if (!mounted.current) return
    setBusy(false)
    if (ok) {
      set('success', 'Code verified')
      api.succeed(entered)
    } else {
      set('error', entered.length < LEN ? 'Code is incomplete' : 'Code does not match')
      api.fail(entered.length < LEN ? `Incomplete code (${entered.length}/${LEN})` : 'Wrong code')
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Enter the code <Target>{code}</Target> into the six boxes, one digit per box, then press Verify.
      </Task>
      <div role="group" aria-label="Verification code" className="flex flex-wrap gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`${api.id}-digit-${i + 1}`}
            data-testid={`${api.id}-digit-${i + 1}`}
            aria-label={`Digit ${i + 1} of ${LEN}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            value={d}
            onChange={(e) => onChange(e, i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            onFocus={(e) => e.currentTarget.select()}
            className="size-11 rounded-md border border-input bg-transparent text-center font-mono text-lg shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        ))}
      </div>
      <div>
        <Button id={`${api.id}-verify`} data-testid={`${api.id}-verify`} onClick={() => void verify()} disabled={busy}>
          Verify
        </Button>
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
