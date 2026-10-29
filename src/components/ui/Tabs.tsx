import { useRef, type KeyboardEvent } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem<K extends string> {
  key: K
  label: string
  count?: number
}

/** Accessible tab list with arrow-key navigation. Panels are rendered by the caller. */
export function Tabs<K extends string>({ tabs, active, onChange, label }: { tabs: TabItem<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onChange(tabs[next].key)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="no-print -mb-px flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t, i) => {
        const selected = t.key === active
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 py-px text-xs', selected ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
