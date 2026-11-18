import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Feedback, Task, Target, useFeedback } from '@/challenges/kit'
import type { ChallengeProps } from '@/challenges/types'
import { cn } from '@/lib/utils'

interface MenuNode {
  key: string
  label: string
  children?: MenuNode[]
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function build(tree: Record<string, Record<string, string[]>>): MenuNode[] {
  return Object.entries(tree).map(([cat, subs]) => ({
    key: slug(cat),
    label: cat,
    children: Object.entries(subs).map(([sub, leaves]) => ({
      key: `${slug(cat)}/${slug(sub)}`,
      label: sub,
      children: leaves.map((leaf) => ({ key: `${slug(cat)}/${slug(sub)}/${slug(leaf)}`, label: leaf })),
    })),
  }))
}

const TREE = build({
  Cloud: {
    Compute: ['Virtual Machines', 'Containers', 'Serverless Functions'],
    Storage: ['Object Storage', 'Block Volumes', 'Archive Vault'],
    Networking: ['Load Balancer', 'Private Link', 'Traffic Manager'],
  },
  Data: {
    Databases: ['Relational SQL', 'Document Store', 'Key-Value Cache'],
    Analytics: ['Data Warehouse', 'Query Engine', 'Report Builder'],
    Streaming: ['Event Hub', 'Message Queue', 'Stream Processor'],
  },
  Security: {
    Identity: ['Single Sign-On', 'Access Policies', 'Directory Sync'],
    Secrets: ['Key Vault', 'Certificate Manager', 'Token Broker'],
    Monitoring: ['Threat Detection', 'Audit Trail', 'Compliance Scanner'],
  },
  Developer: {
    Build: ['Pipeline Runner', 'Artifact Registry', 'Preview Environments'],
    Observe: ['Log Explorer', 'Trace Viewer', 'Uptime Probes'],
    Tools: ['Command Line', 'SDK Generator', 'API Sandbox'],
  },
})

const LEAVES = TREE.flatMap((c) => c.children!.flatMap((s) => s.children!))
const CLOSE_DELAY_MS = 250

export default function C51NestedHoverMenu({ api, status }: ChallengeProps) {
  const target = useMemo(() => api.rng('target').pick(LEAVES), [api])
  const [open, setOpen] = useState(false)
  const [openPath, setOpenPath] = useState<string[]>([])
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const { fb, set } = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const locked = status === 'passed' || status === 'failed'

  const closeAll = () => {
    clearTimeout(timer.current)
    setOpen(false)
    setOpenPath([])
  }
  const cancelClose = () => clearTimeout(timer.current)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Outside press closes (covers touch, where pointerleave is unreliable).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        clearTimeout(timer.current)
        setOpen(false)
        setOpenPath([])
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (!focusKey) return
    document.querySelector<HTMLElement>(`[data-menu-key="${focusKey}"]`)?.focus()
    setFocusKey(null)
  }, [focusKey, openPath, open])

  const openRoot = (byKeyboard: boolean) => {
    cancelClose()
    if (!open) api.log('Products menu opened')
    setOpen(true)
    if (byKeyboard) setFocusKey(TREE[0].key)
  }

  const enterItem = (depth: number, node: MenuNode) => {
    cancelClose()
    setOpenPath((p) => {
      const next = [...p.slice(0, depth), ...(node.children ? [node.key] : [])]
      return next.length === p.length && next.every((k, i) => k === p[i]) ? p : next
    })
  }

  const selectLeaf = (node: MenuNode) => {
    api.log(`Menu leaf clicked: ${node.label}`)
    closeAll()
    triggerRef.current?.focus()
    if (node.key === target.key) {
      set('success', `Selected ${node.label}`)
      api.succeed(`selected ${node.label}`)
    } else {
      set('error', `Wrong item: ${node.label}`)
      api.fail(`wrong leaf: ${node.label}`)
    }
  }

  const onItemKey = (e: React.KeyboardEvent<HTMLButtonElement>, depth: number, node: MenuNode) => {
    const items = Array.from(e.currentTarget.closest('[role=menu]')!.querySelectorAll<HTMLElement>(':scope > li > [role=menuitem]'))
    const idx = items.indexOf(e.currentTarget)
    if (e.key === 'ArrowDown') items[(idx + 1) % items.length].focus()
    else if (e.key === 'ArrowUp') items[(idx - 1 + items.length) % items.length].focus()
    else if (e.key === 'ArrowRight' && node.children) {
      enterItem(depth, node)
      setFocusKey(node.children[0].key)
    } else if (e.key === 'ArrowLeft') {
      if (depth === 0) {
        closeAll()
        triggerRef.current?.focus()
      } else {
        const parentKey = openPath[depth - 1]
        setOpenPath(openPath.slice(0, depth - 1))
        setFocusKey(parentKey)
      }
    } else if (e.key === 'Escape') {
      closeAll()
      triggerRef.current?.focus()
    } else return
    e.preventDefault()
  }

  const renderMenu = (nodes: MenuNode[], depth: number, label: string) => (
    <ul
      role="menu"
      aria-label={label}
      data-depth={depth + 1}
      className={cn(
        'absolute z-20 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
        depth === 0 ? 'left-0 top-full mt-1' : '-top-1 left-full -ml-px',
      )}
    >
      {nodes.map((node) => {
        const isOpen = openPath[depth] === node.key
        return (
          <li key={node.key} role="none" className="relative">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              id={`${api.id}-item-${node.key.replace(/\//g, '--')}`}
              data-testid={`${api.id}-item-${node.key.replace(/\//g, '--')}`}
              data-menu-key={node.key}
              aria-haspopup={node.children ? 'menu' : undefined}
              aria-expanded={node.children ? isOpen : undefined}
              disabled={locked}
              onPointerEnter={() => enterItem(depth, node)}
              onFocus={() => enterItem(depth, node)}
              onKeyDown={(e) => onItemKey(e, depth, node)}
              onClick={(e) => {
                if (node.children) {
                  enterItem(depth, node)
                  if (e.detail === 0) setFocusKey(node.children[0].key)
                } else selectLeaf(node)
              }}
              className={cn(
                'flex h-8 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                isOpen && 'bg-muted',
              )}
            >
              <span className="truncate">{node.label}</span>
              {node.children && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
            {node.children && isOpen && renderMenu(node.children, depth + 1, node.label)}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="grid gap-4">
      <Task>
        Open the <strong>Products</strong> menu and click the item <Target>{target.label}</Target>. Submenus open on hover and the whole menu closes {CLOSE_DELAY_MS}ms after the pointer leaves it.
      </Task>
      <div className="min-h-80 overflow-x-auto pb-2">
        <div
          ref={rootRef}
          id="c51-menu"
          data-testid="c51-menu"
          className="relative w-fit"
          onPointerEnter={cancelClose}
          onPointerLeave={(e) => {
            if (e.pointerType === 'touch') return
            cancelClose()
            timer.current = window.setTimeout(() => {
              setOpen(false)
              setOpenPath([])
              api.log('Menu closed after pointer left')
            }, CLOSE_DELAY_MS)
          }}
          onBlur={(e) => {
            if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) closeAll()
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            id="c51-trigger"
            data-testid="c51-trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="c51-root-menu"
            disabled={locked}
            onPointerEnter={() => openRoot(false)}
            onClick={(e) => openRoot(e.detail === 0)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault()
                openRoot(true)
              } else if (e.key === 'Escape') closeAll()
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
          >
            Products
            <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" aria-hidden />
          </button>
          {open && <div id="c51-root-menu">{renderMenu(TREE, 0, 'Products')}</div>}
        </div>
      </div>
      <Feedback state={fb} id="c51-feedback" />
    </div>
  )
}
