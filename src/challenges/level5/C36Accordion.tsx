import { useMemo, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const SECTIONS = ['Billing', 'Shipping', 'Security', 'Notifications', 'Integrations', 'Privacy', 'Support', 'Appearance', 'Storage']
const BLURBS = [
  'Manage how this part of your workspace behaves. Changes apply to every member.',
  'These settings are stored per account and synced across your devices.',
  'Review the defaults before changing anything here; some options affect other sections.',
  'Everything in this panel is read-only in this demo and exists to be expanded.',
]

export default function C36Accordion({ api }: ChallengeProps) {
  const spec = useMemo(() => {
    const r = api.rng('sections')
    const sections = r.sample(SECTIONS, 6).map((name, i) => ({ name, slug: name.toLowerCase(), blurb: BLURBS[i % BLURBS.length] }))
    const targets = r.sample(sections, r.int(2, 3)).map((s) => s.slug)
    const decoys = sections.filter((s) => !targets.includes(s.slug))
    return { sections, targets, initial: [r.pick(decoys).slug] }
  }, [api])
  const [open, setOpen] = useState<string[]>(spec.initial)
  const { fb, set } = useFeedback()

  const names = (slugs: string[]) => spec.sections.filter((s) => slugs.includes(s.slug)).map((s) => s.name)

  const submit = () => {
    const ok = open.length === spec.targets.length && spec.targets.every((t) => open.includes(t))
    const summary = names(open).join(', ') || 'none'
    api.log(`Submitted open panels: ${summary}`)
    if (ok) {
      set('success', `Open panels match: ${summary}`)
      api.succeed(`Open panels: ${summary}`)
    } else {
      set('error', `Open panels do not match: ${summary}`)
      api.fail(`Open panels were: ${summary}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Open exactly these panels and keep all others closed: {names(spec.targets).map((n) => (
          <span key={n}>
            <Target>{n}</Target>{' '}
          </span>
        ))}
        then press <b>Submit</b>.
      </Task>
      <Accordion
        id="c36-accordion"
        data-testid="c36-accordion"
        type="multiple"
        value={open}
        onValueChange={(v) => {
          setOpen(v)
          api.log(`Open panels: ${names(v).join(', ') || 'none'}`)
        }}
        className="rounded-lg border border-border bg-card px-4"
      >
        {spec.sections.map((s) => (
          <AccordionItem key={s.slug} value={s.slug} id={`c36-panel-${s.slug}`} data-testid={`c36-panel-${s.slug}`}>
            <AccordionTrigger id={`c36-trigger-${s.slug}`} data-testid={`c36-trigger-${s.slug}`} aria-controls={`c36-content-${s.slug}`}>
              {s.name}
            </AccordionTrigger>
            <AccordionContent id={`c36-content-${s.slug}`} aria-labelledby={`c36-trigger-${s.slug}`} data-testid={`c36-content-${s.slug}`}>
              <p className="text-muted-foreground">{s.blurb}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p id="c36-open" data-testid="c36-open" data-value={open.join(',')} className="text-sm text-muted-foreground">
        Open: {names(open).join(', ') || 'none'}
      </p>
      <div>
        <Button id="c36-submit" data-testid="c36-submit" onClick={submit}>
          Submit
        </Button>
      </div>
      <Feedback state={fb} id="c36-feedback" />
    </div>
  )
}
