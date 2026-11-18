import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Inbox, Paperclip, Pencil, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

interface Contact {
  slug: string
  name: string
  email: string
}

interface Mail {
  id: string
  folder: 'inbox' | 'sent'
  from: string
  to: string[]
  subject: string
  body: string
  attachments: string[]
  time: string
}

const CONTACTS: Contact[] = [
  { slug: 'priya-nair', name: 'Priya Nair', email: 'priya.nair@example.test' },
  { slug: 'marcus-webb', name: 'Marcus Webb', email: 'marcus.webb@example.test' },
  { slug: 'lena-fischer', name: 'Lena Fischer', email: 'lena.fischer@example.test' },
  { slug: 'tomas-ruiz', name: 'Tomas Ruiz', email: 'tomas.ruiz@example.test' },
  { slug: 'amara-okoye', name: 'Amara Okoye', email: 'amara.okoye@example.test' },
  { slug: 'hiro-sato', name: 'Hiro Sato', email: 'hiro.sato@example.test' },
  { slug: 'sofia-conti', name: 'Sofia Conti', email: 'sofia.conti@example.test' },
  { slug: 'daniel-kim', name: 'Daniel Kim', email: 'daniel.kim@example.test' },
  { slug: 'nora-lund', name: 'Nora Lund', email: 'nora.lund@example.test' },
  { slug: 'victor-adeyemi', name: 'Victor Adeyemi', email: 'victor.adeyemi@example.test' },
  { slug: 'yara-haddad', name: 'Yara Haddad', email: 'yara.haddad@example.test' },
  { slug: 'oscar-brandt', name: 'Oscar Brandt', email: 'oscar.brandt@example.test' },
]

const SAMPLE_FILES = ['quarterly-report.pdf', 'budget-2026.xlsx', 'meeting-notes.txt', 'site-photo.png', 'contract-draft.docx', 'roadmap.pptx', 'export-data.csv']

const INBOX: Mail[] = [
  { id: 'in-1', folder: 'inbox', from: 'Priya Nair', to: ['you@example.test'], subject: 'Welcome to the team', body: 'Glad to have you on board. Let me know if you need anything during your first week.', attachments: [], time: '09:14' },
  { id: 'in-2', folder: 'inbox', from: 'Marcus Webb', to: ['you@example.test'], subject: 'Invoice 4471 attached', body: 'Please find the invoice for last month. Payment terms are 30 days.', attachments: ['invoice-4471.pdf'], time: '08:02' },
  { id: 'in-3', folder: 'inbox', from: 'Lena Fischer', to: ['you@example.test'], subject: 'Lunch on Thursday?', body: 'A few of us are heading to the new place on the corner. Join us if you can.', attachments: [], time: 'Yesterday' },
  { id: 'in-4', folder: 'inbox', from: 'Hiro Sato', to: ['you@example.test'], subject: 'Build pipeline notes', body: 'The nightly build is green again after the cache fix. Details are in the wiki.', attachments: [], time: 'Yesterday' },
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function C47EmailInterface({ api }: ChallengeProps) {
  const [spec] = useState(() => {
    const rng = api.rng('spec')
    const recipients = rng.sample(CONTACTS, 2)
    const [w1, w2, w3, keyword] = rng.sample(['amber', 'anchor', 'beacon', 'canyon', 'delta', 'ember', 'falcon', 'harbor', 'island', 'lantern', 'meadow', 'nebula', 'orbit', 'summit', 'tundra'], 4)
    return { recipients, subject: cap(`${w1} ${w2} ${w3}`), keyword, file: rng.pick(SAMPLE_FILES) }
  })
  const [mails, setMails] = useState<Mail[]>(INBOX)
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox')
  const [openId, setOpenId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [book, setBook] = useState(CONTACTS)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)
  const composingRef = useRef(false)
  composingRef.current = composing
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      Object.values(pending).forEach(clearTimeout)
    }
  }, [])

  // Stress mode: the address book is re-ordered once, shortly after load (never while the composer is open, so no control moves under the pointer).
  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setBook((b) => (composingRef.current ? b : api.rng('book').shuffle(b))), api.delay(900))
    return () => clearTimeout(t)
  }, [api])

  const debouncedLog = (key: string, text: string) => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => api.log(text), 400)
  }

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return book.filter((c) => !to.includes(c.slug) && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))).slice(0, 6)
  }, [book, to, query])
  const activeIdx = Math.min(active, Math.max(suggestions.length - 1, 0))

  const addRecipient = (c: Contact) => {
    if (to.includes(c.slug)) return
    setTo((t) => [...t, c.slug])
    setQuery('')
    setActive(0)
    setListOpen(false)
    api.log(`Added recipient ${c.name}`)
  }

  const removeRecipient = (c: Contact) => {
    setTo((t) => t.filter((s) => s !== c.slug))
    api.log(`Removed recipient ${c.name}`)
  }

  const addFile = (name: string, source: string) => {
    setFiles((f) => (f.includes(name) ? f : [...f, name]))
    api.log(`Attached ${name} (${source})`)
  }

  const reset = () => {
    setTo([])
    setQuery('')
    setSubject('')
    setBody('')
    setFiles([])
    setListOpen(false)
  }

  const openCompose = () => {
    setComposing(true)
    setOpenId(null)
    api.log('Opened composer')
  }

  const send = async () => {
    if (sending) return
    const sent = { to: [...to], subject: subject.trim(), body, files: [...files] }
    api.log(`Send pressed (${sent.to.length} recipients, ${sent.files.length} attachments)`)
    const want = spec.recipients.map((c) => c.slug).sort()
    const have = [...sent.to].sort()
    const problems: string[] = []
    if (have.length !== want.length || have.some((s, i) => s !== want[i])) problems.push('recipients')
    if (sent.subject !== spec.subject) problems.push('subject')
    if (!sent.body.toLowerCase().includes(spec.keyword.toLowerCase())) problems.push('body keyword')
    if (!sent.files.includes(spec.file)) problems.push('attachment')
    if (problems.length > 0) {
      set('error', `Message not sent. Check: ${problems.join(', ')}`)
      api.fail(`Sent message violates requirements: ${problems.join(', ')}`)
      return
    }
    setSending(true)
    set('info', 'Sending…')
    const mail = await api.request<Mail>(() => ({
      id: 'out-1',
      folder: 'sent',
      from: 'you@example.test',
      to: sent.to.map((s) => CONTACTS.find((c) => c.slug === s)!.email),
      subject: sent.subject,
      body: sent.body,
      attachments: sent.files,
      time: 'Just now',
    }), 'send mail')
    if (!mounted.current) return
    setSending(false)
    setMails((m) => [mail, ...m])
    reset()
    setComposing(false)
    setFolder('sent')
    setOpenId(mail.id)
    set('success', 'Message sent and moved to Sent')
    api.succeed('Message sent with all requirements')
  }

  const list = mails.filter((m) => m.folder === folder)
  const opened = mails.find((m) => m.id === openId)

  return (
    <div className="grid gap-4">
      <Task>
        Compose a new email to <Target>{spec.recipients[0].name}</Target> and <Target>{spec.recipients[1].name}</Target> (pick them from the address book) with the subject{' '}
        <Target>{spec.subject}</Target>. The body must contain the word <Target>{spec.keyword}</Target>. Attach <Target>{spec.file}</Target> and press Send.
      </Task>

      <div className="grid gap-3 md:grid-cols-[11rem_1fr]">
        <nav aria-label="Folders" className="flex flex-row gap-2 md:flex-col">
          <Button id="c47-compose" data-testid="c47-compose" onClick={openCompose} disabled={composing}>
            <Pencil /> Compose
          </Button>
          {(['inbox', 'sent'] as const).map((f) => (
            <Button
              key={f}
              id={`c47-folder-${f}`}
              data-testid={`c47-folder-${f}`}
              variant={folder === f ? 'secondary' : 'ghost'}
              className="justify-start"
              aria-current={folder === f ? 'page' : undefined}
              onClick={() => { setFolder(f); setOpenId(null); api.log(`Opened ${f} folder`) }}
            >
              {f === 'inbox' ? <Inbox /> : <Send />}
              {cap(f)}
              <span className="ml-auto text-xs text-muted-foreground" data-testid={`c47-count-${f}`}>{mails.filter((m) => m.folder === f).length}</span>
            </Button>
          ))}
        </nav>

        <div className="grid min-w-0 gap-3">
          {composing && (
            <section id="c47-composer" data-testid="c47-composer" aria-label="New message" className="grid gap-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">New message</h2>

              <div className="grid gap-1.5">
                <label htmlFor="c47-to-input" className="text-sm font-medium">To</label>
                <div
                  className="relative"
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setListOpen(false) }}
                >
                  <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 dark:bg-input/30">
                    {to.map((s) => {
                      const c = CONTACTS.find((x) => x.slug === s)!
                      return (
                        <span key={s} id={`c47-chip-${s}`} data-testid={`c47-chip-${s}`} data-email={c.email} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
                          {c.name}
                          <button type="button" id={`c47-chip-remove-${s}`} data-testid={`c47-chip-remove-${s}`} aria-label={`Remove ${c.name}`} className="rounded-full p-0.5 hover:bg-background" onClick={() => removeRecipient(c)}>
                            <X className="size-3" aria-hidden />
                          </button>
                        </span>
                      )
                    })}
                    <input
                      id="c47-to-input"
                      data-testid="c47-to-input"
                      role="combobox"
                      aria-expanded={listOpen && suggestions.length > 0}
                      aria-controls="c47-suggestions"
                      aria-autocomplete="list"
                      autoComplete="off"
                      placeholder={to.length === 0 ? 'Type a name or email…' : ''}
                      className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setListOpen(true); setActive(0) }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setListOpen(true); setActive((a) => Math.min(a + 1, suggestions.length - 1)) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
                        else if (e.key === 'Enter') { e.preventDefault(); const c = suggestions[activeIdx]; if (c && listOpen) addRecipient(c) }
                        else if (e.key === 'Escape') setListOpen(false)
                        else if (e.key === 'Backspace' && query === '' && to.length > 0) removeRecipient(CONTACTS.find((x) => x.slug === to[to.length - 1])!)
                      }}
                    />
                  </div>
                  {listOpen && suggestions.length > 0 && (
                    <ul id="c47-suggestions" data-testid="c47-suggestions" role="listbox" aria-label="Matching contacts" className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                      {suggestions.map((c, i) => (
                        <li
                          key={c.slug}
                          id={`c47-suggestion-${c.slug}`}
                          data-testid={`c47-suggestion-${c.slug}`}
                          role="option"
                          aria-selected={i === activeIdx}
                          className={cn('flex cursor-pointer flex-wrap items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm', i === activeIdx && 'bg-muted')}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addRecipient(c)}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div role="group" aria-label="Address book" id="c47-addressbook" data-testid="c47-addressbook" className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Address book</p>
                <div className="flex flex-wrap gap-1.5">
                  {book.map((c) => {
                    const added = to.includes(c.slug)
                    return (
                      <Button
                        key={c.slug}
                        id={`c47-contact-${c.slug}`}
                        data-testid={`c47-contact-${c.slug}`}
                        variant={added ? 'secondary' : 'outline'}
                        size="xs"
                        aria-pressed={added}
                        title={c.email}
                        onClick={() => (added ? removeRecipient(c) : addRecipient(c))}
                      >
                        {added && <Check />}
                        {c.name}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <Field label="Subject" htmlFor="c47-subject">
                <Input id="c47-subject" data-testid="c47-subject" value={subject} onChange={(e) => { setSubject(e.target.value); debouncedLog('subject', 'Subject edited') }} />
              </Field>

              <Field label="Message" htmlFor="c47-body">
                <Textarea id="c47-body" data-testid="c47-body" rows={5} value={body} onChange={(e) => { setBody(e.target.value); debouncedLog('body', 'Body edited') }} />
              </Field>

              <div className="grid gap-2">
                <p className="text-sm font-medium">Attachments</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor="c47-file" className="text-xs text-muted-foreground">Upload from device</label>
                    <input
                      id="c47-file"
                      data-testid="c47-file"
                      type="file"
                      multiple
                      className="max-w-full text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-sm"
                      onChange={(e) => {
                        for (const f of Array.from(e.target.files ?? [])) addFile(f.name, 'upload')
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>
                <div role="group" aria-label="Attach mock file" id="c47-samples" data-testid="c47-samples" className="grid gap-1.5">
                  <p className="text-xs text-muted-foreground">Or attach a mock file</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_FILES.map((name) => (
                      <Button key={name} id={`c47-sample-${name.replace(/\./g, "-")}`} data-testid={`c47-sample-${name.replace(/\./g, "-")}`} variant="outline" size="xs" onClick={() => addFile(name, 'mock')}>
                        <Paperclip /> {name}
                      </Button>
                    ))}
                  </div>
                </div>
                <ul id="c47-attachments" data-testid="c47-attachments" aria-label="Attached files" className="flex flex-wrap gap-1.5">
                  {files.map((name) => (
                    <li key={name} data-testid="c47-attachment" data-name={name} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
                      <Paperclip className="size-3" aria-hidden />
                      {name}
                      <button type="button" aria-label={`Remove attachment ${name}`} className="rounded-full p-0.5 hover:bg-background" onClick={() => { setFiles((f) => f.filter((x) => x !== name)); api.log(`Removed attachment ${name}`) }}>
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                  {files.length === 0 && <li className="text-xs text-muted-foreground">No attachments</li>}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button id="c47-send" data-testid="c47-send" disabled={sending} onClick={send}>
                  <Send /> {sending ? 'Sending…' : 'Send'}
                </Button>
                <Button id="c47-discard" data-testid="c47-discard" variant="ghost" disabled={sending} onClick={() => { reset(); setComposing(false); api.log('Discarded draft') }}>
                  Discard
                </Button>
              </div>
            </section>
          )}

          <Feedback id="c47-feedback" state={fb} />

          {opened ? (
            <article id="c47-detail" data-testid="c47-detail" data-message-id={opened.id} aria-label="Message detail" className="grid gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold" data-testid="c47-detail-subject">{opened.subject}</h2>
                <Button id="c47-detail-close" data-testid="c47-detail-close" variant="ghost" size="sm" onClick={() => setOpenId(null)}>Back to list</Button>
              </div>
              <dl className="grid gap-1 text-sm">
                <div className="flex gap-2"><dt className="w-12 text-muted-foreground">From</dt><dd data-testid="c47-detail-from">{opened.from}</dd></div>
                <div className="flex gap-2"><dt className="w-12 text-muted-foreground">To</dt><dd data-testid="c47-detail-to" className="min-w-0 break-words">{opened.to.join(', ')}</dd></div>
                <div className="flex gap-2"><dt className="w-12 text-muted-foreground">Time</dt><dd>{opened.time}</dd></div>
              </dl>
              <p data-testid="c47-detail-body" className="whitespace-pre-wrap text-sm">{opened.body}</p>
              {opened.attachments.length > 0 && (
                <ul aria-label="Attachments" data-testid="c47-detail-attachments" className="flex flex-wrap gap-1.5">
                  {opened.attachments.map((a) => (
                    <li key={a} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"><Paperclip className="size-3" aria-hidden />{a}</li>
                  ))}
                </ul>
              )}
            </article>
          ) : (
            <ul id="c47-list" data-testid="c47-list" aria-label={`${cap(folder)} messages`} className="divide-y divide-border rounded-lg border border-border bg-card">
              {list.map((m) => (
                <li key={m.id}>
                  <button type="button" id={`c47-msg-${m.id}`} data-testid={`c47-msg-${m.id}`} className="grid w-full gap-0.5 px-4 py-2.5 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50" onClick={() => { setOpenId(m.id); api.log(`Opened message "${m.subject}"`) }}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{folder === 'sent' ? `To: ${m.to.join(', ')}` : m.from}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.time}</span>
                    </span>
                    <span className="truncate">{m.subject}</span>
                    <span className="truncate text-xs text-muted-foreground">{m.body}</span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No messages in {cap(folder)}.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
