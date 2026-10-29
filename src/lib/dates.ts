/** Small date helpers working on ISO `YYYY-MM-DD` strings (local calendar). */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toISODate(d)
}

/** `YYYY-MM` month key. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

/** Ordered list of month keys from `startISO` to `endISO`, inclusive. */
export function monthRange(startISO: string, endISO: string): string[] {
  const keys: string[] = []
  const d = parseISODate(startISO.slice(0, 7) + '-01')
  const end = monthKey(endISO)
  while (monthKey(toISODate(d)) <= end) {
    keys.push(monthKey(toISODate(d)))
    d.setMonth(d.getMonth() + 1)
  }
  return keys
}

export function isWithin(iso: string, startISO: string, endISO: string): boolean {
  const d = iso.slice(0, 10)
  return d >= startISO && d <= endISO
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return parseISODate(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export type DateRangePreset = '30d' | 'qtd' | '6m' | 'ytd' | '12m'

export const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: 'qtd', label: 'This quarter' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
]

export function resolveRange(preset: DateRangePreset, today = todayISO()): { start: string; end: string } {
  const d = parseISODate(today)
  switch (preset) {
    case '30d':
      return { start: addDays(today, -29), end: today }
    case 'qtd': {
      const qStartMonth = Math.floor(d.getMonth() / 3) * 3
      return { start: toISODate(new Date(d.getFullYear(), qStartMonth, 1)), end: today }
    }
    case '6m':
      return { start: monthKey(addMonths(today, -5)) + '-01', end: today }
    case 'ytd':
      return { start: `${d.getFullYear()}-01-01`, end: today }
    case '12m':
    default:
      return { start: monthKey(addMonths(today, -11)) + '-01', end: today }
  }
}
