import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Minus, PackageCheck, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import type { ChallengeApi, ChallengeProps } from '@/challenges/types'
import { Feedback, Field, Target, Task, useFeedback } from '@/challenges/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const NAMES = [
  'Trail Backpack', 'Ceramic Mug', 'Desk Lamp', 'Wool Beanie', 'Steel Bottle', 'Notebook Set',
  'Phone Stand', 'Canvas Tote', 'Cable Kit', 'Plant Pot', 'Sketch Pens', 'Yoga Strap',
]
const FREE_SHIPPING_AT = 6000
const SHIPPING = 599

interface Product { id: string; name: string; cents: number }
type Cart = Record<string, number>

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

function buildPuzzle(api: ChallengeApi) {
  const r = api.rng('catalogue')
  const products: Product[] = r.sample(NAMES, 8).map((name, i) => ({ id: `p${i + 1}`, name, cents: r.int(6, 59) * 100 - 1 }))
  const t = api.rng('target')
  const picks = t.sample(products, t.int(2, 3)).sort((a, b) => a.id.localeCompare(b.id))
  const target: Cart = {}
  for (const p of picks) target[p.id] = t.int(1, 3)
  const pct = t.pick([10, 15, 20, 25])
  const coupon = { code: `${t.pick(['SAVE', 'TAKE', 'DEAL'])}${pct}`, pct }
  return { products, target, coupon }
}

function price(cart: Cart, products: Product[], pct: number) {
  const subtotal = products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.cents, 0)
  const discount = Math.round((subtotal * pct) / 100)
  const shipping = subtotal === 0 ? 0 : subtotal - discount >= FREE_SHIPPING_AT ? 0 : SHIPPING
  return { subtotal, discount, shipping, total: subtotal - discount + shipping }
}

function sameCart(a: Cart, b: Cart) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

function QtyInput({ id, label, value, disabled, onCommit }: { id: string; label: string; value: number; disabled: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    setDraft((d) => (d !== null && Number(d) === value ? d : null))
  }, [value])
  return (
    <Input
      id={id}
      data-testid={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      aria-label={label}
      disabled={disabled}
      className="h-8 w-14 px-1 text-center"
      value={draft ?? String(value)}
      onChange={(e) => {
        const v = e.target.value
        setDraft(v)
        if (/^\d{1,2}$/.test(v)) onCommit(Number(v))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

interface Form { name: string; address: string; card: string; expiry: string; cvc: string }
const EMPTY: Form = { name: '', address: '', card: '', expiry: '', cvc: '' }

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (f.name.trim().length < 2) e.name = 'Enter the full name.'
  if (f.address.trim().length < 5) e.address = 'Enter a shipping address.'
  if (!/^\d{16}$/.test(f.card.replace(/\s/g, ''))) e.card = 'Card number must be 16 digits.'
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.expiry)) e.expiry = 'Use MM/YY.'
  if (!/^\d{3}$/.test(f.cvc)) e.cvc = 'CVC must be 3 digits.'
  return e
}

export default function C41ShoppingCheckout({ api, status }: ChallengeProps) {
  const [puzzle] = useState(() => buildPuzzle(api))
  const { products, target, coupon: targetCoupon } = puzzle
  const [cart, setCart] = useState<Cart>({})
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState('')
  const [applied, setApplied] = useState<{ code: string; pct: number } | null>(null)
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState<{ id: string; total: number } | null>(null)
  const [lateReady, setLateReady] = useState(!api.settings.dynamic)
  const { fb, set } = useFeedback()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (!api.settings.dynamic) return
    const t = setTimeout(() => setLateReady(true), api.delay(900))
    return () => clearTimeout(t)
  }, [api])

  const visible = lateReady ? products : products.slice(0, 6)
  const locked = order !== null || status === 'failed'
  const totals = price(cart, products, applied?.pct ?? 0)
  const lines = products.filter((p) => (cart[p.id] ?? 0) > 0)
  const itemCount = lines.reduce((s, p) => s + cart[p.id], 0)

  const setQty = (p: Product, qty: number, how: string) => {
    setCart((c) => {
      const next = { ...c }
      if (qty <= 0) delete next[p.id]
      else next[p.id] = Math.min(99, qty)
      return next
    })
    api.log(qty <= 0 ? `Removed ${p.name} from cart (${how})` : `${p.name} quantity set to ${Math.min(99, qty)} (${how})`)
    set('info', qty <= 0 ? `${p.name} removed from cart` : `${p.name} quantity: ${Math.min(99, qty)}`)
  }

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) { setCouponError('Enter a coupon code.'); return }
    setApplying(true)
    api.log(`Applying coupon ${code}`)
    const found = await api.request(() => (code === targetCoupon.code ? targetCoupon : null), 'coupon lookup')
    if (!mounted.current) return
    setApplying(false)
    if (found) {
      setApplied(found)
      setCouponError('')
      setCouponInput('')
      set('success', `Coupon ${found.code} applied: ${found.pct}% off`)
    } else {
      setCouponError(`"${code}" is not a valid coupon.`)
      set('error', `Coupon ${code} rejected`)
    }
  }

  const placeOrder = async () => {
    if (placing || locked) return
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) { set('error', 'Fix the highlighted checkout fields.'); api.log('Place order blocked: invalid checkout form'); return }
    if (lines.length === 0) { set('error', 'Your cart is empty.'); api.log('Place order blocked: empty cart'); return }
    setPlacing(true)
    const snapshot = { cart, applied, total: totals.total }
    api.log(`Placing order: ${itemCount} items, total ${money(snapshot.total)}${snapshot.applied ? `, coupon ${snapshot.applied.code}` : ', no coupon'}`)
    const id = await api.request(() => `ORD-${api.rng('order').digits(6)}`, 'place order')
    if (!mounted.current) return
    setPlacing(false)
    const expected = price(target, products, targetCoupon.pct).total
    const problems: string[] = []
    if (!sameCart(snapshot.cart, target)) problems.push('cart contents differ from the task')
    if (snapshot.applied?.code !== targetCoupon.code) problems.push('required coupon not applied')
    if (snapshot.total !== expected) problems.push(`total ${money(snapshot.total)} instead of ${money(expected)}`)
    if (problems.length > 0) {
      const reason = `Order rejected: ${problems.join('; ')}`
      set('error', reason)
      api.fail(reason)
      return
    }
    setOrder({ id, total: snapshot.total })
    set('success', `Order ${id} placed`)
    api.succeed(`order ${id} total ${money(snapshot.total)}`)
  }

  const upd = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const blurLog = (name: string) => () => api.log(`Checkout field edited: ${name}`)

  return (
    <div className="grid gap-4">
      <Task>
        Add to the cart:{' '}
        {products.filter((p) => target[p.id]).map((p, i) => (
          <span key={p.id}>{i > 0 && ', '}<Target>{target[p.id]} × {p.name}</Target></span>
        ))}
        . Apply coupon <Target>{targetCoupon.code}</Target> ({targetCoupon.pct}% off), fill the checkout form with any valid test details
        (16-digit card, expiry MM/YY, 3-digit CVC) and place the order. Nothing else may be in the cart.
      </Task>

      <div className="grid gap-4 lg:grid-cols-5">
        <section aria-label="Catalogue" className="min-w-0 lg:col-span-3">
          <h3 className="mb-2 text-sm font-medium">Products</h3>
          <ul id={`${api.id}-catalogue`} className="grid gap-2 sm:grid-cols-2">
            {visible.map((p) => (
              <li key={p.id} data-testid={`${api.id}-product-${p.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{money(p.cents)}</p>
                </div>
                <Button
                  id={`${api.id}-add-${p.id}`}
                  data-testid={`${api.id}-add-${p.id}`}
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  aria-label={`Add ${p.name} to cart`}
                  onClick={() => setQty(p, (cart[p.id] ?? 0) + 1, 'add')}
                >
                  <Plus /> Add
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Cart" className="min-w-0 rounded-lg border border-border bg-card p-3 lg:col-span-2">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><ShoppingCart className="size-4" /> Cart <span data-testid={`${api.id}-cart-count`} className="text-muted-foreground">({itemCount})</span></h3>
          {lines.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <ul id={`${api.id}-cart`} className="grid gap-2">
              {lines.map((p) => (
                <li key={p.id} data-testid={`${api.id}-line-${p.id}`} data-qty={cart[p.id]} className="grid gap-1 border-b border-border pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{money(p.cents * cart[p.id])}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button id={`${api.id}-dec-${p.id}`} data-testid={`${api.id}-dec-${p.id}`} size="icon-sm" variant="outline" disabled={locked} aria-label={`Decrease quantity of ${p.name}`} onClick={() => setQty(p, cart[p.id] - 1, 'decrement')}><Minus /></Button>
                    <QtyInput id={`${api.id}-qty-${p.id}`} label={`Quantity of ${p.name}`} value={cart[p.id]} disabled={locked} onCommit={(n) => !locked && setQty(p, n, 'typed')} />
                    <Button id={`${api.id}-inc-${p.id}`} data-testid={`${api.id}-inc-${p.id}`} size="icon-sm" variant="outline" disabled={locked} aria-label={`Increase quantity of ${p.name}`} onClick={() => setQty(p, cart[p.id] + 1, 'increment')}><Plus /></Button>
                    <Button id={`${api.id}-remove-${p.id}`} data-testid={`${api.id}-remove-${p.id}`} size="icon-sm" variant="ghost" className="ml-auto" disabled={locked} aria-label={`Remove ${p.name} from cart`} onClick={() => setQty(p, 0, 'remove')}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-1.5">
            <label htmlFor={`${api.id}-coupon`} className="text-sm font-medium">Coupon code</label>
            {applied ? (
              <div data-testid={`${api.id}-coupon-applied`} className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-sm">
                <span>{applied.code} · {applied.pct}% off</span>
                <Button id={`${api.id}-coupon-remove`} data-testid={`${api.id}-coupon-remove`} size="icon-xs" variant="ghost" disabled={locked} aria-label="Remove coupon" onClick={() => { setApplied(null); api.log(`Removed coupon ${applied.code}`); set('info', 'Coupon removed') }}><X /></Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id={`${api.id}-coupon`}
                  data-testid={`${api.id}-coupon`}
                  value={couponInput}
                  disabled={locked}
                  autoComplete="off"
                  aria-invalid={couponError ? true : undefined}
                  aria-describedby={couponError ? `${api.id}-coupon-error` : undefined}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon() } }}
                />
                <Button id={`${api.id}-coupon-apply`} data-testid={`${api.id}-coupon-apply`} variant="secondary" disabled={locked || applying} onClick={() => void applyCoupon()}>{applying ? 'Checking…' : 'Apply'}</Button>
              </div>
            )}
            {couponError && <p id={`${api.id}-coupon-error`} role="alert" className="text-xs text-red-500">{couponError}</p>}
          </div>

          <dl className="mt-3 grid gap-1 border-t border-border pt-3 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd id={`${api.id}-subtotal`} data-testid={`${api.id}-subtotal`} data-cents={totals.subtotal}>{money(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd id={`${api.id}-discount`} data-testid={`${api.id}-discount`} data-cents={totals.discount}>−{money(totals.discount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping <span className="text-xs">(free from {money(FREE_SHIPPING_AT)})</span></dt><dd id={`${api.id}-shipping`} data-testid={`${api.id}-shipping`} data-cents={totals.shipping}>{totals.shipping === 0 ? 'Free' : money(totals.shipping)}</dd></div>
            <div className="flex justify-between border-t border-border pt-1.5 font-medium"><dt>Total</dt><dd id={`${api.id}-total`} data-testid={`${api.id}-total`} data-cents={totals.total}>{money(totals.total)}</dd></div>
          </dl>
        </section>
      </div>

      <section aria-label="Checkout" className={cn('rounded-lg border border-border bg-card p-3 sm:p-4', order && 'opacity-60')}>
        <h3 className="mb-3 text-sm font-medium">Checkout</h3>
        <form noValidate className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void placeOrder() }}>
          <Field label="Full name" htmlFor={`${api.id}-name`} error={errors.name}>
            <Input id={`${api.id}-name`} data-testid={`${api.id}-name`} autoComplete="name" value={form.name} disabled={locked} aria-invalid={errors.name ? true : undefined} onChange={upd('name')} onBlur={blurLog('name')} />
          </Field>
          <Field label="Shipping address" htmlFor={`${api.id}-address`} error={errors.address}>
            <Input id={`${api.id}-address`} data-testid={`${api.id}-address`} autoComplete="street-address" value={form.address} disabled={locked} aria-invalid={errors.address ? true : undefined} onChange={upd('address')} onBlur={blurLog('address')} />
          </Field>
          <Field label="Card number" htmlFor={`${api.id}-card`} error={errors.card} hint="Test card, 16 digits">
            <Input id={`${api.id}-card`} data-testid={`${api.id}-card`} autoComplete="cc-number" inputMode="numeric" placeholder="0000 0000 0000 0000" value={form.card} disabled={locked} aria-invalid={errors.card ? true : undefined} onChange={upd('card')} onBlur={blurLog('card')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry (MM/YY)" htmlFor={`${api.id}-expiry`} error={errors.expiry}>
              <Input id={`${api.id}-expiry`} data-testid={`${api.id}-expiry`} autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} value={form.expiry} disabled={locked} aria-invalid={errors.expiry ? true : undefined} onChange={upd('expiry')} onBlur={blurLog('expiry')} />
            </Field>
            <Field label="CVC" htmlFor={`${api.id}-cvc`} error={errors.cvc}>
              <Input id={`${api.id}-cvc`} data-testid={`${api.id}-cvc`} autoComplete="cc-csc" inputMode="numeric" maxLength={3} value={form.cvc} disabled={locked} aria-invalid={errors.cvc ? true : undefined} onChange={upd('cvc')} onBlur={blurLog('cvc')} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button id={`${api.id}-place-order`} data-testid={`${api.id}-place-order`} type="submit" disabled={locked || placing}>{placing ? 'Placing order…' : `Place order · ${money(totals.total)}`}</Button>
          </div>
        </form>
      </section>

      <Feedback state={fb} id={`${api.id}-feedback`} />

      {order && (
        <div id={`${api.id}-confirmation`} data-testid={`${api.id}-confirmation`} role="status" className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <PackageCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
          <div>
            <p className="font-medium">Order confirmed</p>
            <p className="text-muted-foreground">Order id <span id={`${api.id}-order-id`} data-testid={`${api.id}-order-id`} className="font-mono text-foreground">{order.id}</span> · total {money(order.total)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
