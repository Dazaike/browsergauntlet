import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Skeleton } from '@/components/ui/skeleton'

/** JSON for embedding inside an inline <script>: no raw "<" so "</script>" can never terminate it. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

function themeColors() {
  const cs = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    bg: read('--card', '#ffffff'),
    fg: read('--foreground', '#111111'),
    border: read('--border', '#dddddd'),
    muted: read('--muted-foreground', '#666666'),
    primary: read('--primary', '#111111'),
    primaryFg: read('--primary-foreground', '#ffffff'),
    input: read('--background', '#ffffff'),
  }
}

/** The iframe only forwards what was typed; the expected token is never embedded. */
function buildSrcdoc(challenge: string): string {
  const c = themeColors()
  const css = `
    :root{color-scheme:light dark}
    *{box-sizing:border-box}
    body{margin:0;padding:16px;font:14px/1.4 system-ui,sans-serif;background:${c.bg};color:${c.fg}}
    form{display:grid;gap:10px;max-width:360px}
    label{font-weight:500}
    input{height:36px;padding:0 10px;border:1px solid ${c.border};border-radius:6px;background:${c.input};color:${c.fg};font:inherit}
    button{height:36px;border:0;border-radius:6px;background:${c.primary};color:${c.primaryFg};font:inherit;font-weight:500;cursor:pointer}
    input:focus-visible,button:focus-visible{outline:2px solid ${c.muted};outline-offset:2px}
    #status{min-height:20px;color:${c.muted};font-size:13px;margin:0}
  `.replace(/</g, '')
  const script = `
    var challenge = ${safeJson(challenge)};
    var input = document.getElementById('token-input');
    var status = document.getElementById('status');
    var sent = 0;
    document.getElementById('verify-form').addEventListener('submit', function (e) {
      e.preventDefault();
      sent += 1;
      window.parent.postMessage({ source: 'bg-iframe', challenge: challenge, token: input.value }, '*');
      status.textContent = 'Token sent to parent (attempt ' + sent + ')';
    });
  `
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Token form</title><style>${css}</style></head><body>
<form id="verify-form" autocomplete="off">
  <label for="token-input">Token</label>
  <input id="token-input" name="token" type="text" spellcheck="false" autocapitalize="off" placeholder="Type the token" />
  <button id="verify-btn" type="submit">Verify</button>
  <p id="status" role="status" aria-live="polite">Waiting for input</p>
</form>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`
}

export default function C58Iframe({ api, status }: ChallengeProps) {
  const token = useMemo(() => api.rng('token').string(8), [api])
  const srcDoc = useMemo(() => buildSrcdoc(api.id), [api.id])
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameReady, setFrameReady] = useState(!api.settings.dynamic)
  const [parentStatus, setParentStatus] = useState('Waiting for a message from the iframe')
  const { fb, set } = useFeedback()
  const lockedRef = useRef(false)
  lockedRef.current = status === 'passed' || status === 'failed'

  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setFrameReady(true), api.delay(700))
    return () => clearTimeout(t)
  }, [api])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current
      if (!frame || e.source !== frame.contentWindow) return
      const d: unknown = e.data
      if (typeof d !== 'object' || d === null) return
      const msg = d as Record<string, unknown>
      if (msg.source !== 'bg-iframe' || msg.challenge !== api.id || typeof msg.token !== 'string') return
      if (lockedRef.current) return
      api.log(`Iframe message received (${msg.token.length} chars)`)
      const sent = msg.token.trim()
      if (sent === '') {
        // submitting an empty form is not a wrong token: no failed attempt
        setParentStatus('Received an empty token from iframe')
        set('info', 'The iframe sent an empty token. Type the token first.')
      } else if (sent === token) {
        setParentStatus('Received token from iframe: accepted')
        set('success', 'Token accepted')
        api.succeed('Iframe reported the correct token')
      } else {
        setParentStatus(`Received token from iframe: rejected (${sent.length} chars)`)
        set('error', 'Wrong token received from iframe')
        api.fail('Iframe reported a wrong token')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [api, token, set])

  return (
    <div className="grid gap-4">
      <Task>
        Switch into the embedded frame, type the token <Target>{token}</Target> into its input and press its <strong>Verify</strong> button.
      </Task>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {frameReady ? (
          <iframe
            ref={frameRef}
            id={`${api.id}-frame`}
            data-testid={`${api.id}-frame`}
            title="Token verification form"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={srcDoc}
            className="block h-[230px] w-full border-0"
          />
        ) : (
          <div className="grid h-[230px] gap-3 p-4" aria-busy="true">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-9 w-full max-w-sm" />
          </div>
        )}
      </div>

      <p id={`${api.id}-parent-status`} data-testid={`${api.id}-parent-status`} className="text-sm text-muted-foreground">
        {parentStatus}
      </p>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
