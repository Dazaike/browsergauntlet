import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileJson, XCircle } from 'lucide-react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { panel, useAlive } from './shared'

const MAX_BYTES = 20 * 1024

interface CheckResult {
  key: string
  label: string
  ok: boolean
  detail: string
}

function evaluate(file: File, text: string, token: string): CheckResult[] {
  const results: CheckResult[] = []
  const typeOk = /\.json$/i.test(file.name) && file.type === 'application/json'
  results.push({ key: 'type', label: 'Type is .json / application/json', ok: typeOk, detail: `${file.name} (${file.type || 'no MIME type'})` })
  const sizeOk = file.size > 0 && file.size <= MAX_BYTES
  results.push({ key: 'size', label: 'Size is 1 byte to 20 KB', ok: sizeOk, detail: `${file.size} bytes` })

  let parsed: unknown
  let parseOk = true
  try {
    parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) parseOk = false
  } catch {
    parseOk = false
  }
  results.push({ key: 'parse', label: 'Contents parse as a JSON object', ok: parseOk, detail: parseOk ? 'Valid JSON object' : file.size > MAX_BYTES ? 'Not read: file is too large' : 'Not a valid JSON object' })

  const obj = (parseOk ? parsed : {}) as Record<string, unknown>
  const tokenOk = obj.token === token
  results.push({ key: 'token', label: '"token" matches the required token', ok: tokenOk, detail: typeof obj.token === 'string' ? `token = "${obj.token}"` : 'token missing or not a string' })
  const itemsOk = Array.isArray(obj.items) && obj.items.length >= 2
  results.push({ key: 'items', label: '"items" is an array with at least 2 entries', ok: itemsOk, detail: Array.isArray(obj.items) ? `${obj.items.length} item(s)` : 'items missing or not an array' })
  return results
}

export default function C29FileUpload({ api }: ChallengeProps) {
  const alive = useAlive()
  const token = useMemo(() => api.rng('token').string(10), [api])
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const { fb, set } = useFeedback()

  const choose = (f: File) => {
    setFile(f)
    setResults(null)
    set('info', `Selected ${f.name} (${f.size} bytes). Press Validate upload.`)
    api.log(`File selected: ${f.name} (${f.size} bytes, ${f.type || 'no MIME type'})`)
  }

  const downloadSample = () => {
    const body = JSON.stringify({ token, items: [{ id: 1, name: 'alpha' }, { id: 2, name: 'beta' }, { id: 3, name: 'gamma' }] }, null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    api.log('Downloaded sample.json')
  }

  const validate = async () => {
    if (busy) return
    if (!file) {
      set('error', 'No file selected')
      api.log('Validate pressed with no file')
      return
    }
    setBusy(true)
    api.log(`Validating ${file.name}`)
    let text = ''
    if (file.size > 0 && file.size <= MAX_BYTES) {
      try {
        text = await file.text()
      } catch {
        text = ''
      }
    }
    const res = await api.request(() => evaluate(file, text, token), 'validate upload')
    if (!alive.current) return
    setBusy(false)
    setResults(res)
    const failed = res.filter((r) => !r.ok)
    if (failed.length) {
      set('error', `Failed checks: ${failed.map((r) => r.key).join(', ')}`)
      api.fail(`Upload rejected: ${failed.map((r) => r.key).join(', ')}`)
    } else {
      set('success', 'All checks passed')
      api.succeed(`Validated ${file.name}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Upload a <Target>.json</Target> file (MIME <code>application/json</code>, at most 20 KB) whose parsed content is an object with{' '}
        <code>token</code> equal to <Target>{token}</Target> and an <code>items</code> array with at least 2 entries. Then press Validate upload.
      </Task>

      <div className={cn(panel, 'grid gap-4')}>
        <div
          id={`${api.id}-dropzone`}
          data-testid={`${api.id}-dropzone`}
          data-dragging={dragging}
          className={cn('grid gap-3 rounded-md border border-dashed p-4', dragging ? 'border-primary bg-primary/5' : 'border-border')}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (!f) return
            choose(f)
          }}
        >
          <label htmlFor={`${api.id}-file`} className="flex items-center gap-2 text-sm font-medium">
            <FileJson className="size-4" aria-hidden /> Drop a file here or choose one
          </label>
          <input
            ref={inputRef}
            id={`${api.id}-file`}
            data-testid={`${api.id}-file`}
            type="file"
            accept=".json,application/json"
            className="w-full min-w-0 cursor-pointer rounded-md border border-input bg-background text-sm file:mr-3 file:h-9 file:cursor-pointer file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              // reset so choosing the same file again fires onChange; the File object stays valid
              e.target.value = ''
              if (f) choose(f)
            }}
          />
          <p id={`${api.id}-file-info`} data-testid={`${api.id}-file-info`} className="font-mono text-xs text-muted-foreground">
            {file ? `${file.name} · ${file.size} bytes · ${file.type || 'no MIME type'}` : 'No file selected'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" id={`${api.id}-submit`} data-testid={`${api.id}-submit`} onClick={() => void validate()} disabled={busy}>
            {busy ? 'Validating…' : 'Validate upload'}
          </Button>
          <Button type="button" variant="outline" id={`${api.id}-sample`} data-testid={`${api.id}-sample`} onClick={downloadSample}>
            <Download aria-hidden /> Download sample file
          </Button>
        </div>

        {results && (
          <ul id={`${api.id}-results`} data-testid={`${api.id}-results`} aria-label="Validation checks" className="grid gap-1.5 text-sm">
            {results.map((r) => (
              <li key={r.key} data-testid={`${api.id}-check-${r.key}`} data-ok={r.ok} className="flex items-start gap-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-label="passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-label="failed" />}
                <span className="min-w-0">
                  {r.label}
                  <span className="block break-all font-mono text-xs text-muted-foreground">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
