import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Download, UserPlus, Users } from 'lucide-react'
import { useData } from '../../data/store'
import { departmentName, fullName } from '../../data/selectors'
import { useQueryState } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { cn, includesText, initials } from '../../lib/utils'
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, type Employee, type EmploymentStatus, type EmploymentType } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { visibleEmployees } from '../auth/permissions'

export default function EmployeesPage() {
  const { state, perms } = useData()
  const navigate = useNavigate()
  const scoped = useMemo(() => visibleEmployees(perms, state.employees), [perms, state.employees])
  const [q, setQ] = useQueryState('q')
  const [dept, setDept] = useQueryState('dept')
  const [status, setStatus] = useQueryState<EmploymentStatus | ''>('status')
  const [type, setType] = useQueryState<EmploymentType | ''>('type')

  const filtered = useMemo(
    () =>
      scoped.filter(
        (e) =>
          (!dept || e.departmentId === dept) &&
          (!status || e.status === status) &&
          (!type || e.employmentType === type) &&
          includesText([fullName(e), e.email, e.employeeNo, e.jobTitle, e.phone], q),
      ),
    [scoped, dept, status, type, q],
  )

  const counts = useMemo(() => {
    const c = { total: scoped.length, Active: 0, 'On Leave': 0, Inactive: 0 } as Record<string, number>
    for (const e of scoped) c[e.status]++
    return c
  }, [scoped])

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortValue: (e) => fullName(e),
      render: (e) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{initials(fullName(e))}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{fullName(e)}</p>
            <p className="truncate text-xs text-slate-500">{e.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'no', header: 'ID', sortValue: (e) => e.employeeNo, render: (e) => <span className="font-mono text-xs text-slate-600">{e.employeeNo}</span>, hideBelow: 'md' },
    { key: 'dept', header: 'Department', sortValue: (e) => departmentName(state, e.departmentId), render: (e) => departmentName(state, e.departmentId), hideBelow: 'sm' },
    { key: 'title', header: 'Job title', sortValue: (e) => e.jobTitle, render: (e) => e.jobTitle, hideBelow: 'lg' },
    { key: 'status', header: 'Status', sortValue: (e) => e.status, render: (e) => <StatusBadge status={e.status} /> },
    { key: 'join', header: 'Joined', sortValue: (e) => e.joinDate, render: (e) => <span className="whitespace-nowrap">{formatDate(e.joinDate)}</span>, hideBelow: 'md' },
  ]

  const exportCsv = () =>
    downloadCsv(`employees-${todayISO()}`, filtered, [
      { header: 'Employee ID', value: (e) => e.employeeNo },
      { header: 'Full name', value: (e) => fullName(e) },
      { header: 'Department', value: (e) => departmentName(state, e.departmentId) },
      { header: 'Job title', value: (e) => e.jobTitle },
      { header: 'Email', value: (e) => e.email },
      { header: 'Phone', value: (e) => e.phone },
      { header: 'Status', value: (e) => e.status },
      { header: 'Employment type', value: (e) => e.employmentType },
      { header: 'Joining date', value: (e) => e.joinDate },
      { header: 'Location', value: (e) => e.location },
    ])

  const summary: Array<{ label: string; value: number; status: EmploymentStatus | ''; dot: string }> = [
    { label: 'All employees', value: counts.total, status: '', dot: 'bg-slate-400' },
    { label: 'Active', value: counts.Active, status: 'Active', dot: 'bg-emerald-500' },
    { label: 'On leave', value: counts['On Leave'], status: 'On Leave', dot: 'bg-amber-500' },
    { label: 'Inactive', value: counts.Inactive, status: 'Inactive', dot: 'bg-slate-300' },
  ]

  const hasFilters = !!(q || dept || status || type)
  if (perms.employees === 'self') return <Navigate to={`/employees/${perms.user.employeeId}`} replace />

  return (
    <>
      <PageHeader
        title={perms.employees === 'department' ? `${perms.department?.name ?? 'Department'} team` : 'Employees'}
        description={perms.employees === 'department' ? 'Staff in your department. HR manages records for the whole company.' : 'Directory of all staff records, departments and employment status.'}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
            {perms.canManageEmployees && (
              <ButtonLink to="/employees/new" icon={<UserPlus className="size-4" />}>
                Add employee
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <button
            key={s.label}
            onClick={() => setStatus(s.status)}
            aria-pressed={status === s.status}
            className={cn(
              'rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-brand-200',
              status === s.status ? 'border-brand-300 ring-2 ring-brand-500/15' : 'border-slate-200',
            )}
          >
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <span className={cn('size-2 rounded-full', s.dot)} aria-hidden />
              {s.label}
            </span>
            <span className="tabular mt-1 block text-xl font-semibold text-slate-900">{s.value}</span>
          </button>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search name, email, ID, title…" label="Search employees" />
          {perms.employees === 'all' && (
            <FilterSelect label="Filter by department" value={dept} onChange={setDept} options={state.departments.map((d) => ({ value: d.id, label: d.name }))} allLabel="All departments" />
          )}
          <FilterSelect label="Filter by status" value={status} onChange={setStatus} options={EMPLOYMENT_STATUSES} allLabel="All statuses" />
          <FilterSelect label="Filter by employment type" value={type} onChange={setType} options={EMPLOYMENT_TYPES} allLabel="All types" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setDept('')
                setStatus('')
                setType('')
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(e) => e.id}
          rowLabel={(e) => `Open ${fullName(e)}`}
          onRowClick={(e) => navigate(`/employees/${e.id}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          resetKey={`${q}|${dept}|${status}|${type}`}
          empty={
            <EmptyState
              icon={<Users className="size-5" />}
              title={hasFilters ? 'No employees match these filters' : 'No employees yet'}
              description={hasFilters ? 'Try a different search term or clear the filters.' : 'Add your first employee to get started.'}
              action={!hasFilters && perms.canManageEmployees && <ButtonLink to="/employees/new">Add employee</ButtonLink>}
            />
          }
        />
      </Card>
    </>
  )
}
