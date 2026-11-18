import { useCallback, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Instruction banner. Put every target value inside <Target> so tools can read them. */
export function Task({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-testid="task" className={cn('rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed', className)}>
      {children}
    </div>
  )
}

/** A target value the user must act on. data-testid="task-target" (one element per value, in order). */
export function Target({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code data-testid="task-target" className={cn('rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground', className)}>
      {children}
    </code>
  )
}

export interface FeedbackState {
  type: 'idle' | 'success' | 'error' | 'info'
  text: string
}

export function useFeedback(initial: FeedbackState = { type: 'idle', text: '' }) {
  const [fb, setFb] = useState<FeedbackState>(initial)
  const set = useCallback((type: FeedbackState['type'], text: string) => setFb({ type, text }), [])
  const clear = useCallback(() => setFb({ type: 'idle', text: '' }), [])
  return { fb, set, clear }
}

/** Live-region feedback line. Always rendered (empty when idle) so layout and aria-live are stable. */
export function Feedback({ state, id }: { state: FeedbackState; id?: string }) {
  const Icon = state.type === 'success' ? CheckCircle2 : state.type === 'error' ? CircleAlert : Info
  return (
    <p
      id={id}
      data-testid="feedback"
      data-state={state.type}
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-6 items-center gap-1.5 text-sm',
        state.type === 'success' && 'text-emerald-500',
        state.type === 'error' && 'text-red-500',
        state.type === 'info' && 'text-muted-foreground',
      )}
    >
      {state.type !== 'idle' && <Icon className="size-4 shrink-0" aria-hidden />}
      {state.text}
    </p>
  )
}

/** Small labelled field wrapper. */
export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
