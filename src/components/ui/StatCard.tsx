import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  hint?: ReactNode
  /** Percentage change vs previous period; positive is shown green unless `invertTrend`. */
  trend?: number
  invertTrend?: boolean
  to?: string
  tone?: 'brand' | 'purple' | 'emerald' | 'amber' | 'rose'
}

const toneClasses = {
  brand: 'bg-brand-50 text-brand-600',
  purple: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

export function StatCard({ label, value, icon, hint, trend, invertTrend, to, tone = 'brand' }: StatCardProps) {
  const good = trend === undefined ? undefined : invertTrend ? trend <= 0 : trend >= 0
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>{icon}</span>
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        {trend !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
            {trend >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-slate-500">{hint}</span>}
      </div>
    </>
  )
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:border-brand-200 hover:bg-brand-50/20')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
