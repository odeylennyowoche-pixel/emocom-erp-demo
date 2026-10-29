import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useData } from '../../data/store'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchInput } from '../../components/ui/Toolbar'
import { searchAll, type SearchGroup, type SearchResult } from './searchIndex'

export default function SearchPage() {
  const { state, perms } = useData()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const results = useMemo(() => searchAll(state, perms, q), [state, perms, q])
  const groups = useMemo(() => {
    const map = new Map<SearchGroup, SearchResult[]>()
    for (const r of results) map.set(r.group, [...(map.get(r.group) ?? []), r])
    return [...map.entries()]
  }, [results])

  return (
    <>
      <PageHeader title="Search" description={q ? `${results.length} result(s) for “${q}”` : 'Search across employees, inventory, assets, purchase requests, suppliers and invoices.'} />
      <div className="mb-6">
        <SearchInput value={q} onChange={(v) => setParams(v ? { q: v } : {}, { replace: true })} placeholder="Type at least 2 characters…" className="sm:w-96" />
      </div>
      {q.trim().length < 2 ? (
        <Card>
          <EmptyState title="Start typing to search" description="Tip: press Ctrl + K anywhere to jump to search." />
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchX className="size-5" />} title="No results" description="Check the spelling or try a code such as EMP-0012, ITM-1004 or PR-2026-0005." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map(([group, items]) => (
            <Card key={group}>
              <CardHeader title={group} description={`${items.length} match(es)`} />
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {items.map((r) => (
                  <li key={r.id}>
                    <Link to={r.to} className="block px-5 py-3 hover:bg-slate-50">
                      <span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>
                      <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
