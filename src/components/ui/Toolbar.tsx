import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { controlClass } from './Form'

/** Filter bar shown above tables. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('no-print flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string }) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={controlClass(false, 'h-9 pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** From/to date inputs (ISO strings; empty means open-ended). */
export function DateRangeInputs({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className={controlClass(false, 'h-9 w-full sm:w-[9.5rem]')} />
      <span className="text-xs text-slate-400">to</span>
      <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className={controlClass(false, 'h-9 w-full sm:w-[9.5rem]')} />
    </div>
  )
}

export function FilterSelect<V extends string>({
  value,
  onChange,
  options,
  label,
  allLabel = 'All',
}: {
  value: V | ''
  onChange: (v: V | '') => void
  options: readonly V[] | Array<{ value: V; label: string }>
  label: string
  allLabel?: string
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as V | '')} className={controlClass(false, 'h-9 w-full pr-8 sm:w-auto')}>
      <option value="">{allLabel}</option>
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  )
}
