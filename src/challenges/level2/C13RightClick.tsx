import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MousePointer2 } from 'lucide-react'
import { Feedback, Target, Task, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'

const ACTIONS = ['Copy', 'Paste', 'Rename', 'Duplicate', 'Archive', 'Delete', 'Share', 'Pin', 'Export', 'Move']

export default function C13RightClick({ api, status }: ChallengeProps) {
  const [{ items, target }] = useState(() => {
    const r = api.rng('actions')
    const items = r.sample(ACTIONS, 6)
    return { items, target: r.pick(items) }
  })
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const { fb, set } = useFeedback()
  const areaRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = (restoreFocus: boolean) => {
    setMenu(null)
    setPos(null)
    if (restoreFocus) areaRef.current?.focus()
  }

  // Keep the menu inside the viewport once its size is known, then focus the first item.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const { width, height } = menuRef.current.getBoundingClientRect()
    const x = Math.max(4, Math.min(menu.x, window.innerWidth - width - 4))
    const y = Math.max(4, Math.min(menu.y, window.innerHeight - height - 4))
    setPos({ x, y })
    menuRef.current.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return
      setMenu(null)
      setPos(null)
      api.log('Context menu closed (outside click)')
    }
    const onBlur = () => {
      setMenu(null)
      setPos(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [menu, api])

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    let { clientX: x, clientY: y } = e
    if (x === 0 && y === 0) {
      // Keyboard-invoked context menu: anchor to the middle of the area.
      const r = e.currentTarget.getBoundingClientRect()
      x = r.left + r.width / 2
      y = r.top + r.height / 2
    }
    setPos(null)
    setMenu({ x, y })
    api.log(`Context menu opened at (${Math.round(x)}, ${Math.round(y)})`)
  }

  const choose = (name: string) => {
    if (status === 'passed') {
      close(true)
      return
    }
    api.log(`Menu action chosen: ${name}`)
    close(true)
    if (name === target) {
      set('success', `Chose ${name}`)
      api.succeed(`chose ${name}`)
    } else {
      set('error', `Wrong action: ${name}`)
      api.fail(`chose ${name}, expected ${target}`)
    }
  }

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      api.log('Context menu closed (Escape)')
      close(true)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      close(true)
    }
  }

  return (
    <div className="grid gap-5">
      <Task>
        Right-click inside the area to open its context menu, then choose <Target>{target}</Target>.
      </Task>

      <div
        ref={areaRef}
        id={`${api.id}-area`}
        data-testid={`${api.id}-area`}
        data-menu-open={menu !== null}
        role="region"
        aria-label="Context menu area. Right-click or press Shift+F10 to open the menu"
        tabIndex={0}
        onContextMenu={onContextMenu}
        className="flex h-48 select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MousePointer2 className="size-5" aria-hidden />
        Right-click anywhere in this area
      </div>

      <Feedback state={fb} id={`${api.id}-feedback`} />

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            id={`${api.id}-menu`}
            data-testid={`${api.id}-menu`}
            role="menu"
            aria-label="Context menu"
            onKeyDown={onMenuKeyDown}
            onContextMenu={(e) => {
              // portal events bubble through the React tree: keep the area's handler from re-opening the menu
              e.preventDefault()
              e.stopPropagation()
            }}
            className="fixed z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: (pos ?? menu).x, top: (pos ?? menu).y }}
          >
            {items.map((name) => (
              <button
                key={name}
                type="button"
                role="menuitem"
                id={`${api.id}-item-${name.toLowerCase()}`}
                data-testid={`${api.id}-item-${name.toLowerCase()}`}
                tabIndex={-1}
                onClick={() => choose(name)}
                className="flex w-full select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              >
                {name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
