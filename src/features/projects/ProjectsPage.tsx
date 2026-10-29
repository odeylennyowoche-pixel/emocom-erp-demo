import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderKanban, FolderPlus, ListChecks, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { acceptHandover, createProject } from '../../data/workActions'
import { departmentName } from '../../data/selectors'
import { isOverdue, projectProgress } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { useQueryState } from '../../hooks/useQueryState'
import { addDays, formatDate, todayISO } from '../../lib/dates'
import { formatMoneyCompact, sumMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { PROJECT_STATUSES } from '../../types'
import { LIMITS } from '../../config/approvals'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { FormModal, formValue } from '../../components/ui/FormModal'
import { ProgressBar } from '../../components/ui/Progress'
import { visibleProjects } from '../auth/scopes'

export default function ProjectsPage() {
  const { state, perms, commitWith } = useData()
  const run = useAction()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState('status')
  const [creating, setCreating] = useState(false)
  const today = todayISO()
  const all = visibleProjects(perms, state.projects)
  const rows = all.filter((p) => (!status || p.status === status) && includesText([p.code, p.name, p.clientName], q))
  const active = all.filter((p) => p.status === 'Active')
  const handovers = state.opportunities.filter((o) => o.handover?.status === 'Pending')
  const overdueTasks = state.tasks.filter((t) => all.some((p) => p.id === t.projectId && p.status === 'Active') && isOverdue(t, today)).length

  return (
    <>
      <PageHeader
        title={perms.projects === 'all' ? 'Projects overview' : `${perms.department?.name ?? 'Team'} projects`}
        description={perms.readOnly ? 'Current projects across the company (read-only).' : 'Set up projects, assign the team and tasks, manage change requests and publish status reports.'}
        actions={
          perms.canManageProjects && (
            <Button icon={<FolderPlus className="size-4" />} onClick={() => setCreating(true)}>
              New project
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active projects" value={active.length} hint={`${all.length} in total`} icon={<FolderKanban className="size-5" />} />
        <StatCard label="Active contract value" value={formatMoneyCompact(sumMinor(active.map((p) => p.contractValueMinor)))} icon={<Wallet className="size-5" />} tone="emerald" />
        <StatCard label="At risk / off track" value={active.filter((p) => p.health !== 'On track').length} hint="active projects" icon={<AlertTriangle className="size-5" />} tone="amber" />
        <StatCard label="Overdue tasks" value={overdueTasks} hint="on active projects" icon={<ListChecks className="size-5" />} tone="rose" />
      </div>
      {perms.canManageProjects && perms.department?.code !== 'SBD' && handovers.length > 0 && (
        <Card className="mb-6 border-brand-300">
          <CardHeader title="Won deals waiting for handover" description="Sales has handed these over. Accept to set up the project (above ₦50m it then goes to the CEO for final approval)." />
          <ul className="divide-y divide-slate-100">
            {handovers.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{o.name}</span>
                  <span className="block text-xs text-slate-500">{o.code} · {o.clientName} · {formatMoneyCompact(o.valueMinor)} · from {o.handover?.requestedBy}</span>
                  <span className="mt-0.5 block text-xs text-slate-600 italic">“{o.handover?.notes}”</span>
                </span>
                <Button size="sm" variant="success" onClick={() => run(() => commitWith((s) => ({ state: acceptHandover(s, o.id), record: null })), { title: 'Handover accepted', description: 'The project has been set up.' })}>
                  Accept & create project
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search projects…" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={PROJECT_STATUSES} allLabel="All statuses" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          resetKey={q + status}
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          rowLabel={(p) => `Open ${p.name}`}
          initialSort={{ key: 'end', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Project', sortValue: (p) => p.name, render: (p) => (<span><span className="block font-medium text-slate-900">{p.name}</span><span className="text-xs text-slate-500">{p.code} · {p.clientName}</span></span>) },
            { key: 'dept', header: 'Team', render: (p) => departmentName(state, p.departmentId), hideBelow: 'lg' },
            { key: 'value', header: 'Contract', align: 'right', sortValue: (p) => p.contractValueMinor, render: (p) => formatMoneyCompact(p.contractValueMinor), hideBelow: 'sm' },
            { key: 'progress', header: 'Progress', sortValue: (p) => projectProgress(p, state.tasks), render: (p) => (<span className="block w-24"><ProgressBar value={projectProgress(p, state.tasks)} label="Progress" /><span className="text-xs text-slate-500">{projectProgress(p, state.tasks)}%</span></span>), hideBelow: 'md' },
            { key: 'health', header: 'Health', render: (p) => (p.status === 'Active' || p.status === 'On hold' ? <StatusBadge status={p.health} /> : <span className="text-slate-400">—</span>), hideBelow: 'sm' },
            { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <StatusBadge status={p.status} /> },
            { key: 'end', header: 'End date', sortValue: (p) => p.endDate, render: (p) => formatDate(p.endDate), hideBelow: 'lg' },
          ]}
        />
      </Card>
      <FormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="Set up a project"
        description={`Projects or contracts above ${formatMoneyCompact(LIMITS.ceoProjectThresholdMinor)} wait for the CEO’s final approval before they can start.`}
        fields={[
          { name: 'name', label: 'Project name', required: true, full: true, min: 3 },
          { name: 'clientName', label: 'Client', required: true },
          { name: 'contract', label: 'Contract value (₦)', type: 'money', required: true },
          { name: 'budget', label: 'Cost budget (₦)', type: 'money', required: true },
          { name: 'startDate', label: 'Start date', type: 'date', required: true },
          { name: 'endDate', label: 'End date', type: 'date', required: true },
        ]}
        initial={{ startDate: addDays(today, 7), endDate: addDays(today, 97) }}
        submitLabel="Create project"
        onSubmit={(v) => {
          let id = ''
          const ok = run(
            () => {
              id = commitWith((s) => createProject(s, { name: v.name, clientName: v.clientName, contractValueMinor: formValue.money(v.contract), budgetMinor: formValue.money(v.budget), startDate: v.startDate, endDate: v.endDate, memberIds: [] })).id
            },
            { title: 'Project created', description: 'Assign the team and tasks next.' },
          )
          if (ok) navigate(`/projects/${id}`)
          return ok
        }}
      />
    </>
  )
}
