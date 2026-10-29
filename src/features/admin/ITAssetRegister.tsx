import { useState } from 'react'
import { Download } from 'lucide-react'
import { useData } from '../../data/store'
import { departmentName, fullName } from '../../data/selectors'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { ASSET_STATUSES, type Asset } from '../../types'
import { Button, ButtonLink } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'

export const IT_CATEGORIES = ['Laptop', 'Monitor', 'Phone', 'Printer', 'Test Equipment'] as const

/** IT asset register (laptops, monitors, phones, printers, test equipment). */
export function ITAssetRegister({ departmentId, manageLink }: { departmentId?: string; manageLink?: boolean }) {
  const { state } = useData()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const base = state.assets.filter((a) => (IT_CATEGORIES as readonly string[]).includes(a.category) && (!departmentId || a.departmentId === departmentId))
  const holder = (a: Asset) => fullName(state.employees.find((e) => e.id === a.assignedToId))
  const rows = base.filter((a) => (!cat || a.category === cat) && (!status || a.status === status) && includesText([a.tag, a.name, a.serialNumber, holder(a)], q))
  const ageYears = (a: Asset) => (Date.parse(todayISO()) - Date.parse(a.purchaseDate)) / (365 * 86_400_000)
  return (
    <>
      <div className="grid gap-3 px-4 pt-4 text-sm sm:grid-cols-4 sm:px-5">
        <Mini label="IT assets" value={String(base.length)} />
        <Mini label="In use" value={String(base.filter((a) => a.status === 'In Use').length)} />
        <Mini label="Under repair / in storage" value={String(base.filter((a) => a.status === 'Under Repair' || a.status === 'In Storage').length)} />
        <Mini label="Book cost" value={formatMoneyCompact(sumMinor(base.map((a) => a.costMinor)))} />
      </div>
      <Toolbar className="mt-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search tag, serial or holder…" />
        <FilterSelect label="Category" value={cat} onChange={setCat} options={IT_CATEGORIES} allLabel="All IT categories" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={ASSET_STATUSES} allLabel="All statuses" />
        <div className="flex gap-2 sm:ml-auto">
          <Button
            size="sm"
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() =>
              downloadCsv('it-asset-register', rows, [
                { header: 'Tag', value: (a) => a.tag },
                { header: 'Asset', value: (a) => a.name },
                { header: 'Category', value: (a) => a.category },
                { header: 'Serial', value: (a) => a.serialNumber },
                { header: 'Assigned to', value: (a) => holder(a) },
                { header: 'Department', value: (a) => departmentName(state, a.departmentId) },
                { header: 'Status', value: (a) => a.status },
                { header: 'Purchased', value: (a) => a.purchaseDate },
                { header: 'Cost (NGN)', value: (a) => minorToInput(a.costMinor) },
              ])
            }
          >
            Export
          </Button>
          {manageLink && (
            <ButtonLink size="sm" to="/inventory?tab=assets">
              Add / edit assets
            </ButtonLink>
          )}
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        resetKey={q + cat + status}
        initialSort={{ key: 'tag', dir: 'asc' }}
        columns={[
          { key: 'tag', header: 'Tag', sortValue: (a) => a.tag, render: (a) => <span className="font-mono text-xs">{a.tag}</span> },
          { key: 'name', header: 'Asset', sortValue: (a) => a.name, render: (a) => (<span><span className="block font-medium text-slate-900">{a.name}</span><span className="text-xs text-slate-500">{a.category} · {a.serialNumber}</span></span>) },
          { key: 'holder', header: 'Assigned to', sortValue: (a) => holder(a), render: (a) => (a.assignedToId ? holder(a) : <span className="text-slate-400">Unassigned</span>) },
          { key: 'dept', header: 'Department', render: (a) => departmentName(state, a.departmentId), hideBelow: 'lg' },
          { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
          { key: 'age', header: 'Purchased', sortValue: (a) => a.purchaseDate, render: (a) => (<span className="whitespace-nowrap">{formatDate(a.purchaseDate)}{ageYears(a) > 3 && <span className="block text-xs text-amber-700">Due for refresh</span>}</span>), hideBelow: 'md' },
          { key: 'cost', header: 'Cost', align: 'right', sortValue: (a) => a.costMinor, render: (a) => formatMoney(a.costMinor), hideBelow: 'sm' },
        ]}
      />
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tabular text-base font-semibold text-slate-900">{value}</p>
    </div>
  )
}
