import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useData } from '../data/store'
import { searchAll } from '../features/search/searchIndex'
import { usePopover } from '../hooks/usePopover'
import { cn } from '../lib/utils'

export function GlobalSearch() {
  const { state, perms } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { open, setOpen, ref } = usePopover<HTMLDivElement>()
  const results = useMemo(() => searchAll(state, perms, query, 4), [state, perms, query])

  // Ctrl/⌘+K or "/" focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => setActive(0), [query])

  const go = (to: string) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate(to)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active < results.length && results[active]) go(results[active].to)
      else if (query.trim().length >= 2) go(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  let lastGroup = ''
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && query.length >= 2}
        aria-controls="global-search-results"
        aria-label="Search employees, items, requests, suppliers and invoices"
        placeholder="Search employees, items, requests…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-14 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-400 sm:block">Ctrl K</kbd>

      {open && query.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="animate-pop-in absolute top-full right-0 left-0 z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl sm:min-w-[28rem]">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No matches for “{query.trim()}”.</p>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <div key={`${r.group}-${r.id}`}>
                {header && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{header}</p>}
                <button
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.to)}
                  className={cn('block w-full px-4 py-2 text-left', i === active ? 'bg-brand-50' : 'hover:bg-slate-50')}
                >
                  <span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>
                  <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>
                </button>
              </div>
            )
          })}
          <button
            onMouseEnter={() => setActive(results.length)}
            onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
            className={cn('mt-1 block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-brand-700', active === results.length ? 'bg-brand-50' : 'hover:bg-slate-50')}
          >
            See all results for “{query.trim()}”
          </button>
        </div>
      )}
    </div>
  )
}
