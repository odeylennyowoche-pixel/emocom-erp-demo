import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useData } from '../../data/store'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Hide on small screens to keep tables readable on mobile. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
  empty?: ReactNode
  /** Resets to page 1 whenever this value changes (e.g. filters). */
  resetKey?: string
  footer?: ReactNode
}

const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowLabel, initialSort, pageSize, empty, resetKey, footer }: DataTableProps<T>) {
  const { state } = useData()
  const size = pageSize ?? state.preferences.pageSize
  const compact = state.preferences.compactTables
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)

  useEffect(() => setPage(1), [resetKey, sort, size])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir
    })
  }, [rows, columns, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / size))
  const current = Math.min(page, pageCount)
  const visible = sorted.slice((current - 1) * size, current * size)

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : undefined) : { key, dir: 'asc' }))

  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records found" description="Try adjusting your search or filters." />}</>

  const cellPad = compact ? 'px-4 py-2' : 'px-4 py-3'

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.hideBelow && hideClass[c.hideBelow],
                    )}
                  >
                    {c.sortValue ? (
                      <button onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 uppercase hover:text-slate-800', active && 'text-slate-800')}>
                        {c.header}
                        {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row)
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                className={cn('bg-white', onRowClick && 'cursor-pointer transition-colors hover:bg-brand-50/40 focus-visible:bg-brand-50/60')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      cellPad,
                      'align-middle text-slate-700',
                      c.align === 'right' ? 'tabular text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.hideBelow && hideClass[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer}
        </table>
      </div>
      <Pagination page={current} pageCount={pageCount} total={sorted.length} pageSize={size} onPage={setPage} />
    </div>
  )
}

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <p className="tabular">
        Showing <span className="font-medium text-slate-700">{from}</span>–<span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total.toLocaleString()}</span>
      </p>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular px-2 text-slate-600">
            Page {page} of {pageCount}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
