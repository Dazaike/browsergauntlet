import { useEffect, useRef, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'

const TAG = 'bg-shadow-widget'
const MIN = 0
const MAX = 99

const STYLE = `
  :host{display:block;max-width:360px;font:14px/1.4 system-ui,sans-serif;color:var(--foreground);color-scheme:light dark}
  *{box-sizing:border-box}
  .box{display:grid;gap:12px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--card)}
  label{font-weight:500}
  .row{display:flex;gap:8px;align-items:center}
  button,input{height:40px;border-radius:6px;border:1px solid var(--border);background:var(--background);color:var(--foreground);font:inherit}
  button{min-width:40px;padding:0 12px;cursor:pointer}
  button:hover{background:var(--muted)}
  input{width:80px;text-align:center;padding:0 8px}
  #apply{width:100%;background:var(--primary);color:var(--primary-foreground);border-color:transparent;font-weight:500}
  #apply:hover{opacity:.9}
  button:focus-visible,input:focus-visible{outline:2px solid var(--muted-foreground);outline-offset:2px}
  .hint{margin:0;font-size:12px;color:var(--muted-foreground)}
`

/** Registered once per page load; guarded so HMR / remounts never throw. */
function defineWidget() {
  if (customElements.get(TAG)) return
  customElements.define(
    TAG,
    class extends HTMLElement {
      private built = false

      connectedCallback() {
        if (this.built) return
        this.built = true
        const root = this.attachShadow({ mode: 'open' })
        root.innerHTML = `
          <style>${STYLE}</style>
          <div class="box" part="box">
            <label for="stepper-input">Quantity</label>
            <div class="row">
              <button id="dec" type="button" aria-label="Decrease">−</button>
              <input id="stepper-input" type="number" inputmode="numeric" min="${MIN}" max="${MAX}" step="1" value="${this.getAttribute('initial') ?? '0'}" aria-label="Value" />
              <button id="inc" type="button" aria-label="Increase">+</button>
            </div>
            <button id="apply" type="button">Apply</button>
            <p class="hint" id="hint" role="status">Range ${MIN}–${MAX}</p>
          </div>`
        const input = root.getElementById('stepper-input') as HTMLInputElement
        const hint = root.getElementById('hint') as HTMLElement
        const step = (d: number) => {
          const cur = input.valueAsNumber
          const next = Math.min(MAX, Math.max(MIN, (Number.isFinite(cur) ? cur : 0) + d))
          input.value = String(next)
          hint.textContent = `Value ${next}`
        }
        const apply = () => {
          const value = input.valueAsNumber
          hint.textContent = Number.isFinite(value) ? `Applied ${value}` : 'Enter a number'
          this.dispatchEvent(new CustomEvent('apply', { detail: { value }, bubbles: true, composed: true }))
        }
        root.getElementById('dec')!.addEventListener('click', () => step(-1))
        root.getElementById('inc')!.addEventListener('click', () => step(1))
        root.getElementById('apply')!.addEventListener('click', apply)
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') apply()
        })
      }
    },
  )
}

export default function C59ShadowDom({ api, status }: ChallengeProps) {
  const [target] = useState(() => api.rng('target').int(11, 94))
  const hostRef = useRef<HTMLDivElement>(null)
  const [applied, setApplied] = useState<string>('—')
  const { fb, set } = useFeedback()
  const lockedRef = useRef(false)
  lockedRef.current = status === 'passed' || status === 'failed'

  useEffect(() => {
    const holder = hostRef.current
    if (!holder) return
    defineWidget()
    const widget = document.createElement(TAG)
    widget.id = `${api.id}-widget`
    widget.setAttribute('data-testid', `${api.id}-widget`)
    widget.setAttribute('initial', '0')
    const onApply = (e: Event) => {
      if (!(e instanceof CustomEvent) || lockedRef.current) return
      const value = (e.detail as { value?: unknown } | null)?.value
      api.log(`Shadow widget applied ${String(value)}`)
      if (typeof value === 'number' && Number.isFinite(value)) {
        setApplied(String(value))
        if (value === target) {
          set('success', `Value ${value} accepted`)
          api.succeed(`Applied ${value}`)
        } else {
          set('error', `Wrong value: ${value}`)
          api.fail(`Applied ${value}, expected ${target}`)
        }
      } else {
        // an empty/invalid input is not a wrong answer: the widget already says "Enter a number"
        setApplied('invalid')
        set('info', 'No numeric value applied. Enter a number first.')
      }
    }
    widget.addEventListener('apply', onApply)
    holder.appendChild(widget)
    return () => {
      widget.removeEventListener('apply', onApply)
      widget.remove()
    }
  }, [api, target, set])

  return (
    <div className="grid gap-4">
      <Task>
        Inside the shadow component below, set the stepper to <Target>{target}</Target> and press <strong>Apply</strong>.
      </Task>

      <div ref={hostRef} />

      <p className="text-sm text-muted-foreground">
        Last applied value:{' '}
        <span id={`${api.id}-applied`} data-testid={`${api.id}-applied`} className="font-mono text-foreground">
          {applied}
        </span>
      </p>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
