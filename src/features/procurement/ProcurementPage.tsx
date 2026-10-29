import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Clock, Download, FilePlus2, XCircle } from 'lucide-react'
import { useData } from '../../data/store'
import { departmentName, employeeById, fullName, prTotal, supplierName } from '../../data/selectors'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor } from '../../lib/money'
import { cn, includesText } from '../../lib/utils'
import { PR_STATUSES, type PurchaseRequest, type PurchaseRequestStatus } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { SuppliersTab } from './SuppliersTab'
import { visibleRequests } from '../auth/permissions'
import { checkTransition } from './workflow'

type TabKey = 'requests' | 'suppliers'

export default function ProcurementPage() {
  const { state, perms } = useData()
  const [tabParam, setTab] = useTabParam<TabKey>('requests')
  const showSuppliers = perms.procurement === 'all'
  const tab = showSuppliers ? tabParam : 'requests'
  const mine = visibleRequests(perms, state.purchaseRequests)
  const title = perms.procurement === 'self' ? 'My purchase requests' : perms.procurement === 'department' ? `${perms.department?.name ?? 'Department'} procurement` : 'Procurement'
  return (
    <>
      <PageHeader
        title={title}
        description={
          perms.procurement === 'self'
            ? 'Raise purchase requests and track their approval.'
            : perms.procurement === 'department'
              ? 'Requests raised by your department. You approve those within your limit.'
              : 'Purchase requests, approvals and supplier directory.'
        }
        actions={
          <ButtonLink to="/procurement/requests/new" icon={<FilePlus2 className="size-4" />}>
            New purchase request
          </ButtonLink>
        }
      />
      <Card>
        <div className="px-4 pt-1">
          <Tabs
            label="Procurement sections"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'requests' as const, label: 'Purchase requests', count: mine.length },
              ...(showSuppliers ? [{ key: 'suppliers' as const, label: 'Suppliers', count: state.suppliers.length }] : []),
            ]}
          />
        </div>
        {tab === 'requests' ? <RequestsTab /> : <SuppliersTab />}
      </Card>
    </>
  )
}

function RequestsTab() {
  const { state, perms } = useData()
  const scoped = useMemo(() => visibleRequests(perms, state.purchaseRequests), [perms, state.purchaseRequests])
  const [awaiting, setAwaiting] = useQueryState<'' | 'me'>('awaiting')
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState<PurchaseRequestStatus | ''>('status')
  const [dept, setDept] = useQueryState('dept')
  const [supplier, setSupplier] = useQueryState('supplier')

  const rows = useMemo(
    () =>
      scoped.filter((p) => {
        const requester = employeeById(state, p.requesterId)
        return (
          (!awaiting || (p.status === 'Pending Approval' && checkTransition(p, 'approve', perms).allowed)) &&
          (!status || p.status === status) &&
          (!dept || p.departmentId === dept) &&
          (!supplier || p.supplierId === supplier) &&
          includesText([p.code, p.title, requester && fullName(requester), supplierName(state, p.supplierId)], q)
        )
      }),
    [state, scoped, perms, awaiting, status, dept, supplier, q],
  )

  const byStatus = useMemo(() => {
    const m = new Map<PurchaseRequestStatus, PurchaseRequest[]>()
    for (const s of PR_STATUSES) m.set(s, [])
    for (const p of scoped) m.get(p.status)!.push(p)
    return m
  }, [scoped])
  const awaitingCount = useMemo(() => scoped.filter((p) => p.status === 'Pending Approval' && checkTransition(p, 'approve', perms).allowed).length, [scoped, perms])

  const pipeline: Array<{ status: PurchaseRequestStatus; icon: ReactNode; color: string }> = [
    { status: 'Draft', icon: <FilePlus2 className="size-4" />, color: 'text-slate-500' },
    { status: 'Pending Approval', icon: <Clock className="size-4" />, color: 'text-amber-600' },
    { status: 'Approved', icon: <ClipboardCheck className="size-4" />, color: 'text-sky-600' },
    { status: 'Received', icon: <CheckCircle2 className="size-4" />, color: 'text-emerald-600' },
    { status: 'Rejected', icon: <XCircle className="size-4" />, color: 'text-rose-600' },
  ]

  const columns: Column<PurchaseRequest>[] = [
    {
      key: 'code',
      header: 'Request',
      sortValue: (p) => p.code,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{p.code}</p>
          <p className="max-w-64 truncate text-xs text-slate-500">{p.title}</p>
        </div>
      ),
    },
    { key: 'requester', header: 'Requester', sortValue: (p) => fullName(employeeById(state, p.requesterId)), render: (p) => fullName(employeeById(state, p.requesterId)), hideBelow: 'md' },
    { key: 'dept', header: 'Department', sortValue: (p) => departmentName(state, p.departmentId), render: (p) => departmentName(state, p.departmentId), hideBelow: 'lg' },
    { key: 'supplier', header: 'Supplier', sortValue: (p) => supplierName(state, p.supplierId), render: (p) => supplierName(state, p.supplierId), hideBelow: 'lg' },
    { key: 'items', header: 'Items', align: 'right', render: (p) => p.lines.length, hideBelow: 'md' },
    { key: 'total', header: 'Total', align: 'right', sortValue: (p) => prTotal(p), render: (p) => <span className="font-medium text-slate-900">{formatMoney(prTotal(p))}</span> },
    { key: 'created', header: 'Created', sortValue: (p) => p.createdAt, render: (p) => <span className="whitespace-nowrap">{formatDate(p.createdAt)}</span>, hideBelow: 'sm' },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <StatusBadge status={p.status} /> },
  ]

  const exportCsv = () =>
    downloadCsv(`purchase-requests-${todayISO()}`, rows, [
      { header: 'Request ID', value: (p) => p.code },
      { header: 'Title', value: (p) => p.title },
      { header: 'Requester', value: (p) => fullName(employeeById(state, p.requesterId)) },
      { header: 'Department', value: (p) => departmentName(state, p.departmentId) },
      { header: 'Supplier', value: (p) => supplierName(state, p.supplierId) },
      { header: 'Line items', value: (p) => p.lines.map((l) => `${l.quantity} x ${l.description}`).join('; ') },
      { header: 'Total', value: (p) => minorToInput(prTotal(p)) },
      { header: 'Created', value: (p) => p.createdAt },
      { header: 'Status', value: (p) => p.status },
      { header: 'Rejection reason', value: (p) => p.rejectionReason },
    ])

  const hasFilters = !!(q || status || dept || supplier || awaiting)

  return (
    <>
      <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-5">
        {pipeline.map((p) => {
          const list = byStatus.get(p.status)!
          const active = status === p.status
          return (
            <button
              key={p.status}
              onClick={() => setStatus(active ? '' : p.status)}
              aria-pressed={active}
              className={cn('bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50', active && 'bg-brand-50/60 hover:bg-brand-50')}
            >
              <span className={cn('flex items-center gap-1.5 text-xs font-medium', p.color)}>
                {p.icon}
                {p.status}
              </span>
              <span className="tabular mt-1 block text-lg font-semibold text-slate-900">{list.length}</span>
              <span className="tabular block text-xs text-slate-500">{formatMoneyCompact(sumMinor(list.map(prTotal)))}</span>
            </button>
          )
        })}
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search ID, title, requester…" label="Search purchase requests" />
        <FilterSelect label="Filter by status" value={status} onChange={setStatus} options={PR_STATUSES} allLabel="All statuses" />
        {perms.procurement === 'all' && (
          <FilterSelect label="Filter by department" value={dept} onChange={setDept} options={state.departments.map((d) => ({ value: d.id, label: d.name }))} allLabel="All departments" />
        )}
        {perms.approvalLimitMinor > 0 && (
          <button
            onClick={() => setAwaiting(awaiting ? '' : 'me')}
            aria-pressed={!!awaiting}
            className={cn('h-9 rounded-lg border px-3 text-sm font-medium', awaiting ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')}
          >
            Awaiting my approval ({awaitingCount})
          </button>
        )}
        <FilterSelect label="Filter by supplier" value={supplier} onChange={setSupplier} options={state.suppliers.map((s) => ({ value: s.id, label: s.name }))} allLabel="All suppliers" />
        <Button variant="secondary" size="sm" className="sm:ml-auto" icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        rowLabel={(p) => `Open ${p.code}`}
        onRowClick={(p) => navigate(`/procurement/requests/${p.id}`)}
        initialSort={{ key: 'created', dir: 'desc' }}
        resetKey={`${q}|${status}|${dept}|${supplier}|${awaiting}`}
        empty={
          <EmptyState
            title={hasFilters ? 'No requests match these filters' : 'No purchase requests yet'}
            description={hasFilters ? 'Try another status or clear the search.' : 'Raise the first purchase request to start the approval workflow.'}
            action={!hasFilters && <ButtonLink to="/procurement/requests/new">New purchase request</ButtonLink>}
          />
        }
      />
    </>
  )
}
