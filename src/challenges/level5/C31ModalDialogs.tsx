import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

export default function C31ModalDialogs({ api }: ChallengeProps) {
  const [word] = useState(() => {
    const r = api.rng('word')
    return `${r.word()}-${r.digits(3)}`
  })
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const confirmedRef = useRef(false)
  const { fb, set } = useFeedback()

  const openDialog = () => {
    setText('')
    setUnderstood(false)
    setError('')
    setOpen(true)
    api.log('Dialog opened')
    set('info', 'Dialog is open.')
  }

  const onOpenChange = (next: boolean) => {
    if (next) return openDialog()
    setOpen(false)
    if (!confirmedRef.current) {
      api.log('Dialog dismissed without confirming')
      set('info', 'Dialog dismissed without confirming. Open it again to retry.')
    }
  }

  const confirm = () => {
    const typed = text.trim()
    api.log(`Confirm clicked (input "${typed}", understood=${understood})`)
    if (!typed) {
      setError('Enter the required word.')
      set('error', 'The text field is empty')
      return
    }
    if (typed !== word) {
      setError('The text does not match the required word.')
      set('error', `Wrong input: "${typed}"`)
      api.fail('Dialog confirmed with wrong input')
      return
    }
    if (!understood) {
      setError('Tick "I understand" before confirming.')
      set('error', 'Tick "I understand" before confirming')
      return
    }
    confirmedRef.current = true
    setConfirmed(true)
    setOpen(false)
    set('success', 'Confirmed. Waiting for the dialog to close.')
  }

  // Succeed only once the dialog has finished closing after a correct confirm.
  useEffect(() => {
    if (!confirmed || open) return
    const t = setInterval(() => {
      if (document.getElementById('c31-dialog')) return
      clearInterval(t)
      set('success', 'Dialog closed after a correct confirm.')
      api.succeed('Dialog confirmed and closed')
    }, 100)
    return () => clearInterval(t)
  }, [confirmed, open, api, set])

  return (
    <div className="grid gap-4">
      <Task>
        Open the dialog, type <Target>{word}</Target> into its text field, tick <b>I understand</b> and press <b>Confirm</b>. The dialog must be closed afterwards.
      </Task>
      <div className="flex flex-wrap items-center gap-3">
        <Button id="c31-open" data-testid="c31-open" aria-haspopup="dialog" disabled={confirmed} onClick={openDialog}>
          Open dialog
        </Button>
        <span id="c31-state" data-testid="c31-state" data-open={open} className="text-sm text-muted-foreground">
          Dialog: {open ? 'open' : 'closed'}
        </span>
      </div>
      <Feedback state={fb} id="c31-feedback" />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent id="c31-dialog" data-testid="c31-dialog">
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>Enter the required word and acknowledge to continue.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Required word" htmlFor="c31-input" error={error}>
              <Input
                id="c31-input"
                data-testid="c31-input"
                value={text}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setText(e.target.value)
                  setError('')
                }}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="c31-understand"
                data-testid="c31-understand"
                checked={understood}
                onCheckedChange={(v) => {
                  setUnderstood(v === true)
                  setError('')
                  api.log(`"I understand" ${v === true ? 'ticked' : 'cleared'}`)
                }}
              />
              <label htmlFor="c31-understand" className="text-sm">I understand</label>
            </div>
          </div>
          <DialogFooter>
            <Button id="c31-cancel" data-testid="c31-cancel" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button id="c31-confirm" data-testid="c31-confirm" onClick={confirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
