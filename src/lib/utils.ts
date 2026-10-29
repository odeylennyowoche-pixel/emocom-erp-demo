/** Join class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

let counter = 0
/** Unique-enough client-side id for demo records. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Next sequential code such as EMP-0087 given existing codes. */
export function nextCode(existing: string[], prefix: string, width = 4): string {
  const max = existing.reduce((acc, code) => {
    const n = Number(code.replace(/\D/g, '').slice(-width))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function pluralize(n: number, singular: string, plural = singular + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ??= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function includesText(haystack: Array<string | undefined>, needle: string): boolean {
  const q = needle.trim().toLowerCase()
  if (!q) return true
  return haystack.some((h) => h?.toLowerCase().includes(q))
}

export function percent(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}
