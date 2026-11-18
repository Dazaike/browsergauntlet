import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const LABELS = ['Undo', 'Review', 'Restore', 'Retry', 'Open report', 'Acknowledge']
const DURATION = 6000

type Phase = 'idle' | 'pending' | 'visible' | 'expired' | 'done'

interface ToastState {
  done: boolean
  id: string | number
}

export default function C32ToastNotifications({ api }: ChallengeProps) {
  const [spec] = useState(() => {
    const r = api.rng('toast')
    return { label: r.pick(LABELS), ref: r.digits(4) }
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const { fb, set } = useFeedback()
  const current = useRef<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (current.current) {
        current.current.done = true
        toast.dismiss(current.current.id)
      }
    },
    [],
  )

  const show = () => {
    const state: ToastState = { done: false, id: 0 }
    current.current = state
    const settle = (reason: string) => {
      if (state.done) return
      state.done = true
      setPhase('expired')
      set('error', `The toast ${reason} without the action being clicked. Trigger it again to retry.`)
      api.log(`Toast ${reason}`)
      api.fail(reason === 'expired' ? 'toast expired' : 'toast dismissed without action')
    }
    state.id = toast(`Report #${spec.ref} is ready`, {
      description: `Click "${spec.label}" within ${DURATION / 1000} seconds.`,
      duration: DURATION,
      action: (
        <button
          type="button"
          id="c32-toast-action"
          data-testid="c32-toast-action"
          data-button
          data-action
          onClick={() => {
            if (state.done) return
            state.done = true
            setPhase('done')
            set('success', `Toast action "${spec.label}" clicked.`)
            api.log(`Toast action "${spec.label}" clicked`)
            api.succeed('Toast action clicked before expiry')
            toast.dismiss(state.id)
          }}
        >
          {spec.label}
        </button>
      ),
      onAutoClose: () => settle('expired'),
      onDismiss: () => settle('dismissed'),
    })
    setPhase('visible')
    set('info', 'Toast is visible.')
    api.log('Toast shown')
  }

  const trigger = () => {
    if (phase === 'pending' || phase === 'visible') return
    setPhase('pending')
    set('info', 'Preparing notification...')
    api.log('Notification requested')
    timer.current = window.setTimeout(show, api.delay(0))
  }

  return (
    <div className="grid gap-4">
      <Task>
        Press <b>Trigger notification</b>, then click the <Target>{spec.label}</Target> button inside the toast before it disappears ({DURATION / 1000} seconds).
      </Task>
      <div className="flex flex-wrap items-center gap-3">
        <Button id="c32-trigger" data-testid="c32-trigger" disabled={phase === 'pending' || phase === 'visible' || phase === 'done'} onClick={trigger}>
          Trigger notification
        </Button>
        <span id="c32-status" data-testid="c32-status" data-phase={phase} className="text-sm text-muted-foreground">
          Toast: {phase === 'idle' ? 'not triggered' : phase === 'pending' ? 'preparing' : phase === 'visible' ? 'visible' : phase === 'done' ? 'action clicked' : 'expired or dismissed'}
        </span>
      </div>
      <Feedback state={fb} id="c32-feedback" />
    </div>
  )
}
