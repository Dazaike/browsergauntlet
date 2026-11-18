import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import type { ChallengeProps } from '@/challenges/types'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { pad2 } from '@/lib/utils'

interface Item {
  id: string
  name: string
  note: string
}

const COUNT = 40

export default function C56StickyFloating({ api, status }: ChallengeProps) {
  const [{ items, targetId }] = useState(() => {
    const rng = api.rng('items')
    const list: Item[] = Array.from({ length: COUNT }, (_, i) => {
      const n = pad2(i + 1)
      return { id: `item-${n}`, name: `${rng.word()}-${n}`, note: `Reward batch ${rng.digits(4)} · expires in ${rng.int(2, 28)} days` }
    })
    const target = list[api.rng('target').int(13, 33)]
    return { items: list, targetId: target.id }
  })
  const target = items.find((it) => it.id === targetId)!
  const [late, setLate] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [claimed, setClaimed] = useState<string | null>(null)
  const { fb, set } = useFeedback()

  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setLate(true), api.delay(900))
    return () => clearTimeout(t)
  }, [api])

  const all: Item[] = late ? [...items, { id: 'item-late', name: 'latecomer-41', note: 'Reward batch 0000 · added late' }] : items

  const claim = (item: Item) => {
    if (status === 'passed' || status === 'failed') return
    api.log(`Claim clicked: ${item.name}`)
    if (item.id === targetId) {
      setClaimed(item.id)
      set('success', `Claimed ${item.name}`)
      api.succeed(`Claimed ${item.name}`)
    } else {
      set('error', `Wrong item: ${item.name}`)
      api.fail(`Claimed wrong item ${item.name}`)
    }
  }

  return (
    <div className="grid gap-4">
      <Task>
        Scroll the list and click the <strong>Claim</strong> button for item <Target>{target.name}</Target>. The sticky header and the floating chat widget can cover parts of the list.
      </Task>

      <div className="relative">
        <div
          id={`${api.id}-scroll`}
          data-testid={`${api.id}-scroll`}
          role="region"
          aria-label="Rewards list"
          tabIndex={0}
          className="h-[420px] overflow-auto rounded-lg border border-border bg-background"
        >
          <div
            id={`${api.id}-header`}
            data-testid={`${api.id}-header`}
            className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-4 text-sm font-medium"
          >
            <span>Rewards inbox</span>
            <span className="text-xs font-normal text-muted-foreground">{all.length} items</span>
          </div>
          <ul className="grid gap-2 p-3" aria-label="Reward items">
            {all.map((item) => (
              <li
                key={item.id}
                data-item={item.id}
                data-testid={`${api.id}-${item.id}`}
                className="flex h-16 items-center justify-between gap-3 rounded-md border border-border bg-card px-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.note}</p>
                </div>
                <Button
                  id={`${api.id}-claim-${item.id}`}
                  data-testid={`${api.id}-claim-${item.id}`}
                  data-item={item.id}
                  size="sm"
                  variant={claimed === item.id ? 'secondary' : 'outline'}
                  aria-label={`Claim ${item.name}`}
                  onClick={() => claim(item)}
                >
                  {claimed === item.id ? 'Claimed' : 'Claim'}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-end pr-6">
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {chatOpen && (
              <div
                id={`${api.id}-chat-panel`}
                data-testid={`${api.id}-chat-panel`}
                role="dialog"
                aria-label="Support chat"
                className="w-56 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md"
              >
                Hi! This widget floats over the list. Nothing here claims anything.
              </div>
            )}
            <Button
              id={`${api.id}-chat`}
              data-testid={`${api.id}-chat`}
              size="sm"
              aria-expanded={chatOpen}
              aria-label={chatOpen ? 'Close support chat' : 'Open support chat'}
              onClick={() => {
                setChatOpen((o) => !o)
                api.log(chatOpen ? 'Chat widget closed' : 'Chat widget opened')
              }}
            >
              {chatOpen ? <X /> : <MessageCircle />} Support chat
            </Button>
          </div>
        </div>
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
