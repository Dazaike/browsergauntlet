export { cn } from 'cn'

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function fmtMs(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(2)}s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s - m * 60)
  return `${m}m ${pad2(rest)}s`
}

export function fmtClock(t: number): string {
  const d = new Date(t)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
