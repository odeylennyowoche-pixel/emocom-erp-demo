import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Horizontal progress bar (0–100). */
export function ProgressBar({ value, tone = 'brand', className, label }: { value: number; tone?: 'brand' | 'emerald' | 'amber' | 'rose'; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const colors = { brand: 'bg-brand-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }
  return (
    <div className={cn('h-2 w-full rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-2 rounded-full transition-[width]', colors[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}

/** Five-dot rating display (1–5). */
export function Rating({ value }: { value: number | undefined }) {
  if (!value) return <span className="text-slate-400">—</span>
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn('size-1.5 rounded-full', i <= Math.round(value) ? 'bg-brand-500' : 'bg-slate-200')} />
        ))}
      </span>
      <span className="tabular text-xs text-slate-600">{value.toFixed(1)}</span>
    </span>
  )
}

/** Small informational banner used for demo / illustrative notices. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div className={cn('rounded-lg px-3 py-2 text-xs ring-1 ring-inset', tone === 'warning' ? 'bg-amber-50 text-amber-900 ring-amber-600/20' : 'bg-slate-50 text-slate-600 ring-slate-500/10')}>{children}</div>
  )
}
