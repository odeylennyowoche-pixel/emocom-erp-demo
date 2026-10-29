import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'purple'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
}

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  brand: 'bg-brand-500',
  purple: 'bg-violet-500',
}

export function Badge({ tone = 'neutral', dot = false, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  )
}

/** Maps every business status in the app to a consistent colour. */
const STATUS_TONES: Record<string, BadgeTone> = {
  // employees
  Active: 'success',
  'On Leave': 'warning',
  Inactive: 'neutral',
  Suspended: 'danger',
  // stock
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'danger',
  // assets
  'In Use': 'brand',
  'In Storage': 'neutral',
  'Under Repair': 'warning',
  Retired: 'neutral',
  // procurement
  Draft: 'neutral',
  'Pending Approval': 'warning',
  Approved: 'info',
  Rejected: 'danger',
  Received: 'success',
  // finance
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
  Sent: 'info',
  // stock movement
  Receipt: 'success',
  Issue: 'purple',
  Adjustment: 'neutral',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} dot>
      {status}
    </Badge>
  )
}
