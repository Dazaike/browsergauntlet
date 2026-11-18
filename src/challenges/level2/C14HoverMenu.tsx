import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import { cn } from '@/lib/utils'
import { Rng } from '@/lib/prng'
import type { ChallengeProps } from '@/challenges/types'

const MENU_NAMES = ['Products', 'Company', 'Support', 'Resources', 'Pricing', 'Community']
const ITEM_WORDS = ['anchor', 'beacon', 'canyon', 'delta', 'ember', 'fjord', 'glacier', 'harbor', 'island', 'jasper', 'lantern', 'meadow', 'nebula', 'orchid', 'pioneer', 'quartz', 'ripple', 'summit', 'tundra', 'willow']

interface MenuDef {
  name: string
  items: string[]
}

function build(r: Rng) {
  const names = r.sample(MENU_NAMES, 3)
  const words = r.sample(ITEM_WORDS, 15).map((s) => s[0].toUpperCase() + s.slice(1))
  const menus: MenuDef[] = names.map((name, i) => ({ name, items: words.slice(i * 5, i * 5 + 5) }))
  const menu = r.pick(menus)
  return { menus, targetMenu: menu.name, targetItem: r.pick(menu.items) }
}

export default function C14HoverMenu({ api, status }: ChallengeProps) {
  const [{ menus, targetMenu, targetItem }] = useState(() => build(api.rng('menus')))
  const [open, setOpen] = useState<string | null>(null)
  const { fb, set } = useFeedback()
  const navRef = useRef<HTMLElement>(null)
  const openTimer = useRef(0)
  const closeTimer = useRef(0)
  const focusFirst = useRef(false)

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  useEffect(() => clearTimers, [])

  // Keyboard-opened menus move focus to their first item once rendered.
  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false
      navRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && navRef.current?.contains(e.target)) return
      clearTimers()
      setOpen(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const show = (name: string) => {
    window.clearTimeout(closeTimer.current)
    window.clearTimeout(openTimer.current)
    const wait = api.delay(0)
    const apply = () => {
      setOpen(name)
      api.log(`Submenu opened: ${name}`)
    }
    if (wait === 0) apply()
    else openTimer.current = window.setTimeout(apply, wait)
  }

  const scheduleClose = (name: string) => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen((cur) => (cur === name ? null : cur)), api.delay(150))
  }

  const choose = (menu: string, item: string) => {
    if (status === 'passed') return
    clearTimers()
    setOpen(null)
    api.log(`Submenu item clicked: ${menu} > ${item}`)
    if (menu === targetMenu && item === targetItem) {
      set('success', `Clicked ${item}`)
      api.succeed(`clicked ${menu} > ${item}`)
    } else {
      set('error', `Wrong item: ${menu} > ${item}`)
      api.fail(`clicked ${menu} > ${item}, expected ${targetMenu} > ${targetItem}`)
    }
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, name: string) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      focusFirst.current = true
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
      if (open === name) {
        focusFirst.current = false
        navRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      } else setOpen(name)
    } else if (e.key === 'Escape') setOpen(null)
  }

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, name: string) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const i = els.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      els[(n + els.length) % els.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(els.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(null)
      document.getElementById(`${api.id}-trigger-${name.toLowerCase()}`)?.focus()
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Open the <Target>{targetMenu}</Target> menu by hovering over it, then click <Target>{targetItem}</Target> in its submenu.
      </Task>

      <nav ref={navRef} aria-label="Demo navigation" className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-background p-2">
        {menus.map((m) => {
          const key = m.name.toLowerCase()
          const isOpen = open === m.name
          return (
            <div
              key={m.name}
              className="relative"
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') show(m.name)
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== 'touch') scheduleClose(m.name)
              }}
            >
              <button
                type="button"
                id={`${api.id}-trigger-${key}`}
                data-testid={`${api.id}-trigger-${key}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={`${api.id}-menu-${key}`}
                onClick={() => show(m.name)}
                onKeyDown={(e) => onTriggerKeyDown(e, m.name)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                  isOpen && 'bg-muted',
                )}
              >
                {m.name}
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full z-20 pt-1">
                  <div
                    id={`${api.id}-menu-${key}`}
                    data-testid={`${api.id}-menu-${key}`}
                    role="menu"
                    aria-label={m.name}
                    onKeyDown={(e) => onMenuKeyDown(e, m.name)}
                    className="min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {m.items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        role="menuitem"
                        id={`${api.id}-item-${key}-${item.toLowerCase()}`}
                        data-testid={`${api.id}-item-${key}-${item.toLowerCase()}`}
                        tabIndex={-1}
                        onClick={() => choose(m.name, item)}
                        className="flex w-full select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="min-h-44" aria-hidden />
      <Feedback state={fb} id={`${api.id}-feedback`} />
    </div>
  )
}
