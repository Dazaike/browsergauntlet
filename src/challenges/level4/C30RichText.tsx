import { useMemo, useRef, useState } from 'react'
import { Bold, Heading1, Heading2, List } from 'lucide-react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { capWords, panel, useAlive } from './shared'

const norm = (s: string | null) => (s ?? '').replace(/[\u00a0\s]+/g, ' ').trim()

/** Indented outline of the editor DOM for the live inspector. */
function outline(node: Node, depth = 0): string[] {
  const lines: string[] = []
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = norm(n.textContent)
      if (t) lines.push(`${'  '.repeat(depth)}"${t}"`)
    } else if (n instanceof HTMLElement) {
      lines.push(`${'  '.repeat(depth)}<${n.tagName.toLowerCase()}>`)
      lines.push(...outline(n, depth + 1))
    }
  })
  return lines
}

interface Spec {
  level: 1 | 2
  heading: string
  bold: string
  items: string[]
}

function problems(root: HTMLElement, spec: Spec): string[] {
  const out: string[] = []
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  const tag = `h${spec.level}`
  if (headings.length !== 1) out.push(`Expected exactly one heading, found ${headings.length}`)
  else if (headings[0].tagName.toLowerCase() !== tag) out.push(`Heading must be ${tag.toUpperCase()}, found ${headings[0].tagName}`)
  else if (norm(headings[0].textContent) !== spec.heading) out.push(`Heading text is "${norm(headings[0].textContent)}"`)

  const bolds = [...root.querySelectorAll('b,strong')]
  if (!bolds.length) out.push('No bold text found')
  else {
    if (bolds.some((b) => norm(b.textContent) !== spec.bold)) out.push(`Bold text must be only "${spec.bold}"`)
    if (!bolds.some((b) => norm(b.textContent) === spec.bold && !b.closest('h1,h2,h3,h4,h5,h6,li'))) out.push(`"${spec.bold}" must be bold in a normal paragraph line`)
  }

  const uls = [...root.querySelectorAll('ul')]
  if (root.querySelector('ol')) out.push('Numbered lists are not allowed')
  if (uls.length !== 1) out.push(`Expected exactly one bullet list, found ${uls.length}`)
  else {
    const lis = [...uls[0].querySelectorAll(':scope > li')]
    const texts = lis.map((li) => norm(li.textContent))
    if (texts.length !== spec.items.length || texts.some((t, i) => t !== spec.items[i])) out.push(`List items are [${texts.join(', ')}]`)
  }
  return out
}

export default function C30RichText({ api }: ChallengeProps) {
  const alive = useAlive()
  const spec = useMemo<Spec>(() => {
    const r = api.rng('target')
    const words = r.sample(['apple', 'river', 'stone', 'cloud', 'maple', 'ember', 'quartz', 'lunar', 'delta', 'frost'], 4)
    return { level: r.pick([1, 2] as const), heading: capWords(r.phrase(2)), bold: words[0], items: words.slice(1) }
  }, [api])

  const editorRef = useRef<HTMLDivElement>(null)
  const [inspect, setInspect] = useState({ outline: '(empty)', html: '' })
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const refresh = () => {
    const el = editorRef.current
    if (!el) return
    setInspect({ outline: outline(el).join('\n') || '(empty)', html: el.innerHTML })
  }

  const ensureSelection = () => {
    const el = editorRef.current
    if (!el) return false
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    return true
  }

  const run = (label: string, cmd: string, arg?: string) => {
    if (!ensureSelection()) return
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand('defaultParagraphSeparator', false, 'p')
    if (cmd === 'formatBlock' && arg) {
      const current = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, '')
      document.execCommand('formatBlock', false, current === arg ? 'p' : arg)
    } else {
      document.execCommand(cmd, false, arg)
    }
    api.log(`Applied ${label}`)
    refresh()
  }

  const submit = async () => {
    const el = editorRef.current
    if (busy || !el) return
    setBusy(true)
    api.log('Submitted editor content')
    const snapshot = problems(el, spec)
    const found = await api.request(() => snapshot, 'submit editor')
    if (!alive.current) return
    setBusy(false)
    if (found.length) {
      set('error', found.join('. '))
      api.fail(found.join('; '))
    } else {
      set('success', 'Editor structure accepted')
      api.succeed('Editor DOM matched the requirements')
    }
  }

  const tools = [
    { id: 'h1', label: 'Heading 1', icon: Heading1, cmd: 'formatBlock', arg: 'h1' },
    { id: 'h2', label: 'Heading 2', icon: Heading2, cmd: 'formatBlock', arg: 'h2' },
    { id: 'bold', label: 'Bold', icon: Bold, cmd: 'bold', arg: undefined },
    { id: 'ul', label: 'Bullet list', icon: List, cmd: 'insertUnorderedList', arg: undefined },
  ]

  return (
    <div className="grid gap-4">
      <Task>
        In the editor create: a Heading {spec.level} (<Target>{`H${spec.level}`}</Target>) with the exact text <Target>{spec.heading}</Target>; a line of normal
        text containing the word <Target>{spec.bold}</Target> in bold (and nothing else bold); and a bullet list with exactly 3 items, in order:{' '}
        {spec.items.map((it, i) => (
          <span key={it}>
            {i > 0 && ', '}
            <Target>{it}</Target>
          </span>
        ))}
        . Then submit.
      </Task>

      <div className={panel}>
        <div className="grid gap-3">
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                size="sm"
                id={`${api.id}-${t.id}`}
                data-testid={`${api.id}-${t.id}`}
                aria-label={t.label}
                title={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(t.label, t.cmd, t.arg)}
              >
                <t.icon aria-hidden /> {t.label}
              </Button>
            ))}
          </div>
          <div
            ref={editorRef}
            id={`${api.id}-editor`}
            data-testid={`${api.id}-editor`}
            role="textbox"
            aria-multiline="true"
            aria-label="Rich text editor"
            contentEditable
            suppressContentEditableWarning
            tabIndex={0}
            className="min-h-40 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_h1]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-1 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-0.5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6"
            onInput={refresh}
            onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
            onBlur={() => api.log('Editor content changed')}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                run('Bold (Ctrl+B)', 'bold')
              }
            }}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Live structure inspector</span>
        <pre id={`${api.id}-inspector`} data-testid={`${api.id}-inspector`} aria-live="off" className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
          {inspect.outline}
        </pre>
        <pre id={`${api.id}-html`} data-testid={`${api.id}-html`} aria-live="off" className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
          {inspect.html || '(empty)'}
        </pre>
      </div>

      <div>
        <Button type="button" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} onClick={() => void submit()} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
