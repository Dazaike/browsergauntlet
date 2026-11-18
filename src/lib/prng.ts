/** Deterministic PRNG helpers. Same seed string => same sequence on every machine. */

export function hashString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

const WORDS = [
  'amber', 'anchor', 'beacon', 'birch', 'bridge', 'cactus', 'canyon', 'cedar', 'cobalt', 'comet',
  'copper', 'coral', 'crystal', 'delta', 'ember', 'falcon', 'fjord', 'forest', 'garnet', 'glacier',
  'harbor', 'hazel', 'horizon', 'indigo', 'island', 'jasper', 'juniper', 'kestrel', 'lagoon', 'lantern',
  'lotus', 'maple', 'meadow', 'meteor', 'nebula', 'nickel', 'oasis', 'onyx', 'orchid', 'pebble',
  'pioneer', 'quartz', 'raven', 'ripple', 'saffron', 'summit', 'thistle', 'tundra', 'velvet', 'willow',
  'zephyr', 'prism', 'harvest', 'monsoon', 'orbit', 'pixel', 'signal', 'vector', 'walnut', 'yonder',
]

export class Rng {
  private state: number

  constructor(seed: number | string) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0
  }

  /** float in [0,1) — mulberry32 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  bool(p = 0.5): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /** n distinct items */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n)
  }

  string(len: number, alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'): string {
    let s = ''
    for (let i = 0; i < len; i++) s += alphabet[this.int(0, alphabet.length - 1)]
    return s
  }

  digits(len: number): string {
    return this.string(len, '0123456789')
  }

  /** n distinct lowercase words joined by a space */
  phrase(n = 4): string {
    return this.sample(WORDS, n).join(' ')
  }

  word(): string {
    return this.pick(WORDS)
  }
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8)
}
