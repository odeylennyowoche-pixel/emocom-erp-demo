import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Briefcase, CalendarCheck, CheckCircle2, Circle, GraduationCap, Plus, UserMinus, UserPlus, Users } from 'lucide-react'
import { useData } from '../../data/store'
import { addCandidate, moveCandidate, saveOpening, saveTraining, startLifecycle, toggleLifecycleItem } from '../../data/workActions'
import { activeHeadcount, departmentName, fullName } from '../../data/selectors'
import { certStatus } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { addDays, formatDate, todayISO } from '../../lib/dates'
import { cn, percent } from '../../lib/utils'
import { CANDIDATE_STAGES, type Appraisal, type CandidateStage, type JobOpening, type TrainingRecord } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { FormModal } from '../../components/ui/FormModal'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Form'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice, ProgressBar, Rating } from '../../components/ui/Progress'
import { AppraisalModal } from '../team/AppraisalModal'
import type { HrTab } from '../auth/permissions'

const LABELS: Record<HrTab, string> = {
  people: 'Employee master data',
  recruitment: 'Recruitment',
  lifecycle: 'Onboarding & offboarding',
  leave: 'Leave & attendance',
  performance: 'Performance & appraisals',
  learning: 'Learning & certifications',
}

export default function HRPage() {
  const { state, perms } = useData()
  const allowed = perms.hrTabs
  const [tabParam, setTab] = useTabParam<HrTab>(allowed[0] ?? 'people')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  const pendingLeave = state.leaveRequests.filter((l) => l.status === 'Pending').length
  return (
    <>
      <PageHeader title="Human resources" description={perms.canManageHR ? 'People records, hiring, onboarding, leave, performance and learning.' : 'Staff information and performance (read-only).'} meta={!perms.canManageHR ? <Badge>Read only</Badge> : undefined} />
      <Card>
        <div className="px-4 pt-1">
          <Tabs label="HR sections" active={tab} onChange={setTab} tabs={allowed.map((k) => ({ key: k, label: LABELS[k], count: k === 'leave' && pendingLeave ? pendingLeave : undefined }))} />
        </div>
        {tab === 'people' && <PeopleTab />}
        {tab === 'recruitment' && <RecruitmentTab />}
        {tab === 'lifecycle' && <LifecycleTab />}
        {tab === 'leave' && <LeaveAttendanceTab />}
        {tab === 'performance' && <PerformanceTab />}
        {tab === 'learning' && <LearningTab />}
      </Card>
    </>
  )
}

function PeopleTab() {
  const { state, perms } = useData()
  const today = todayISO()
  const active = state.employees.filter((e) => e.status !== 'Inactive')
  const rows = state.departments.map((d) => {
    const staff = state.employees.filter((e) => e.departmentId === d.id)
    return { d, total: staff.filter((e) => e.status !== 'Inactive').length, onLeave: staff.filter((e) => e.status === 'On Leave').length, contract: staff.filter((e) => e.employmentType !== 'Full-time' && e.status !== 'Inactive').length, newHires: staff.filter((e) => e.joinDate >= addDays(today, -90)).length }
  })
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active headcount" value={activeHeadcount(state.employees)} hint={`${state.employees.length} records in total`} icon={<Users className="size-5" />} />
        <StatCard label="New hires (90 days)" value={state.employees.filter((e) => e.joinDate >= addDays(today, -90)).length} icon={<UserPlus className="size-5" />} tone="emerald" />
        <StatCard label="Contract & interns" value={active.filter((e) => e.employmentType !== 'Full-time').length} hint={`${percent(active.filter((e) => e.employmentType !== 'Full-time').length, active.length)}% of active staff`} icon={<Briefcase className="size-5" />} tone="purple" />
        <StatCard label="Leavers" value={state.employees.filter((e) => e.status === 'Inactive').length} hint="inactive records" icon={<UserMinus className="size-5" />} tone="rose" />
      </div>
      <Card>
        <CardHeader title="Headcount by department" actions={<ButtonLink size="sm" variant="secondary" to="/employees">{perms.canManageEmployees ? 'Open employee records' : 'Open staff directory'}</ButtonLink>} />
        <DataTable
          rows={rows}
          rowKey={(r) => r.d.id}
          pageSize={10}
          initialSort={{ key: 'total', dir: 'desc' }}
          columns={[
            { key: 'd', header: 'Department', render: (r) => <Link className="font-medium text-slate-900 hover:underline" to={`/employees?dept=${r.d.id}`}>{r.d.name}</Link> },
            { key: 'total', header: 'Active', align: 'right', sortValue: (r) => r.total, render: (r) => r.total },
            { key: 'leave', header: 'On leave', align: 'right', render: (r) => r.onLeave, hideBelow: 'sm' },
            { key: 'c', header: 'Contract / intern', align: 'right', render: (r) => r.contract, hideBelow: 'md' },
            { key: 'n', header: 'New (90d)', align: 'right', render: (r) => r.newHires, hideBelow: 'md' },
          ]}
        />
      </Card>
      <Notice>Employee master data (personal details, job, manager, employment type and status) is maintained in Employees. HR can add, edit and deactivate records; every change is logged.</Notice>
    </div>
  )
}

function RecruitmentTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [opening, setOpening] = useState<JobOpening | 'new' | null>(null)
  const [adding, setAdding] = useState<JobOpening | null>(null)
  const [selected, setSelected] = useState(state.jobOpenings[0]?.id ?? '')
  const job = state.jobOpenings.find((j) => j.id === selected)
  const cands = state.candidates.filter((c) => c.openingId === selected)
  const managers = state.users.filter((u) => u.level === 'Manager' || u.level === 'Finance' || u.level === 'HR')
  const editing = opening && opening !== 'new' ? opening : undefined
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{state.jobOpenings.filter((j) => j.status !== 'Filled').length} open vacancies · {state.candidates.filter((c) => !['Hired', 'Rejected'].includes(c.stage)).length} active candidates</p>
        {perms.canManageHR && <Button icon={<Plus className="size-4" />} onClick={() => setOpening('new')}>New vacancy</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {state.jobOpenings.map((j) => (
          <button key={j.id} onClick={() => setSelected(j.id)} className={cn('rounded-xl border p-3 text-left transition', j.id === selected ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white hover:border-slate-300')}>
            <p className="font-medium text-slate-900">{j.title}</p>
            <p className="text-xs text-slate-500">{j.code} · {departmentName(state, j.departmentId)}</p>
            <div className="mt-2 flex items-center justify-between">
              <StatusBadge status={j.status} />
              <span className="text-xs text-slate-500">{state.candidates.filter((c) => c.openingId === j.id).length} candidates</span>
            </div>
          </button>
        ))}
      </div>
      {job && (
        <Card>
          <CardHeader
            title={`${job.title} — candidate pipeline`}
            description={`${job.openings} opening(s) · posted ${formatDate(job.postedAt)} · hiring manager ${state.users.find((u) => u.id === job.hiringManagerUserId)?.name ?? '—'}`}
            actions={
              perms.canManageHR && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setOpening(job)}>Edit vacancy</Button>
                  <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setAdding(job)}>Add candidate</Button>
                </>
              )
            }
          />
          <div className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
            {CANDIDATE_STAGES.map((stage) => (
              <div key={stage} className="min-w-0 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                <p className="mb-2 px-1 text-xs font-semibold text-slate-600">{stage} · {cands.filter((c) => c.stage === stage).length}</p>
                <ul className="space-y-2">
                  {cands.filter((c) => c.stage === stage).map((c) => (
                    <li key={c.id} className="rounded-md border border-slate-200 bg-white p-2 text-xs">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-slate-500">{c.source} · {formatDate(c.appliedAt)}</p>
                      {perms.canManageHR && stage !== 'Hired' && stage !== 'Rejected' && (
                        <select aria-label={`Move ${c.name}`} value="" onChange={(e) => e.target.value && run(() => commit((s) => moveCandidate(s, c.id, e.target.value as CandidateStage)), { title: `Moved to ${e.target.value}`, description: c.name })} className="mt-1.5 h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs">
                          <option value="">Move to…</option>
                          {CANDIDATE_STAGES.filter((s) => s !== stage).map((s) => (<option key={s}>{s}</option>))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
      <FormModal
        open={!!opening}
        onClose={() => setOpening(null)}
        title={editing ? 'Edit vacancy' : 'New vacancy'}
        fields={[
          { name: 'title', label: 'Job title', required: true },
          { name: 'departmentId', label: 'Department', type: 'select', required: true, options: state.departments.map((d) => ({ value: d.id, label: d.name })) },
          { name: 'openings', label: 'Openings', type: 'number', required: true, min: 1, max: 50 },
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Open', 'Interviewing', 'Offer made', 'Filled', 'On hold'] },
          { name: 'hiringManagerUserId', label: 'Hiring manager', type: 'select', required: true, options: managers.map((u) => ({ value: u.id, label: `${u.name} (${departmentName(state, u.departmentId)})` })) },
        ]}
        initial={editing ? { title: editing.title, departmentId: editing.departmentId, openings: String(editing.openings), status: editing.status, hiringManagerUserId: editing.hiringManagerUserId } : { openings: '1', status: 'Open' }}
        onSubmit={(v) => run(() => commit((s) => saveOpening(s, { title: v.title, departmentId: v.departmentId, openings: Number(v.openings), status: v.status as JobOpening['status'], hiringManagerUserId: v.hiringManagerUserId }, editing?.id)), { title: editing ? 'Vacancy updated' : 'Vacancy opened' })}
      />
      <FormModal
        open={!!adding}
        onClose={() => setAdding(null)}
        title="Add candidate"
        description={adding?.title}
        fields={[
          { name: 'name', label: 'Full name', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'source', label: 'Source', type: 'select', required: true, options: ['LinkedIn', 'Referral', 'Careers page', 'Recruitment agency'] },
        ]}
        initial={{ source: 'LinkedIn' }}
        onSubmit={(v) => run(() => commit((s) => addCandidate(s, { openingId: adding!.id, name: v.name, email: v.email, source: v.source })), { title: 'Candidate added' })}
      />
    </div>
  )
}

function LifecycleTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [starting, setStarting] = useState<'Onboarding' | 'Offboarding' | null>(null)
  const [empId, setEmpId] = useState('')
  const lists = state.lifecycleChecklists
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap justify-end gap-2">
        {perms.canManageHR && (
          <>
            <Button variant="secondary" icon={<UserMinus className="size-4" />} onClick={() => { setEmpId(''); setStarting('Offboarding') }}>Start offboarding</Button>
            <Button icon={<UserPlus className="size-4" />} onClick={() => { setEmpId(''); setStarting('Onboarding') }}>Start onboarding</Button>
          </>
        )}
      </div>
      {lists.length === 0 && <EmptyState title="No onboarding or offboarding in progress" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {lists.map((l) => {
          const emp = state.employees.find((e) => e.id === l.employeeId)
          const done = l.items.filter((i) => i.done).length
          return (
            <Card key={l.id}>
              <CardHeader title={fullName(emp)} description={`${emp?.jobTitle ?? ''} · ${departmentName(state, emp?.departmentId)} · started ${formatDate(l.startDate)}`} actions={<Badge tone={l.kind === 'Onboarding' ? 'success' : 'warning'}>{l.kind}</Badge>} />
              <CardBody>
                <ProgressBar value={(done / l.items.length) * 100} tone={done === l.items.length ? 'emerald' : 'brand'} label="Checklist progress" />
                <p className="mt-1 text-xs text-slate-500">{done} of {l.items.length} complete</p>
                <ul className="mt-3 space-y-0.5">
                  {l.items.map((it, i) => (
                    <li key={it.label}>
                      <button disabled={!perms.canManageHR} onClick={() => run(() => commit((s) => toggleLifecycleItem(s, l.id, i)))} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', perms.canManageHR && 'hover:bg-slate-50')}>
                        {it.done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-slate-300" />}
                        <span className={it.done ? 'text-slate-500 line-through' : 'text-slate-800'}>{it.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )
        })}
      </div>
      <Modal
        open={!!starting}
        onClose={() => setStarting(null)}
        title={`Start ${starting?.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStarting(null)}>Cancel</Button>
            <Button disabled={!empId} onClick={() => { if (run(() => commit((s) => startLifecycle(s, empId, starting!)), { title: `${starting} started` })) setStarting(null) }}>Start checklist</Button>
          </>
        }
      >
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Employee</span>
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select…</option>
            {state.employees.filter((e) => (starting === 'Onboarding' ? e.status !== 'Inactive' : true)).sort((a, b) => b.joinDate.localeCompare(a.joinDate)).map((e) => (<option key={e.id} value={e.id}>{fullName(e)} — {e.jobTitle}</option>))}
          </Select>
        </label>
      </Modal>
    </div>
  )
}

function LeaveAttendanceTab() {
  const { state } = useData()
  const today = todayISO()
  const onLeaveToday = state.leaveRequests.filter((l) => l.status === 'Approved' && l.startDate <= today && l.endDate >= today)
  const pending = state.leaveRequests.filter((l) => l.status === 'Pending')
  const upcoming = state.leaveRequests.filter((l) => l.status === 'Approved' && l.startDate > today && l.startDate <= addDays(today, 30))
  // attendance derived from timesheets over the last 10 working days (project staff)
  const attendance = useMemo(() => {
    const days: string[] = []
    for (let d = addDays(today, -14); d < today; d = addDays(d, 1)) {
      const wd = new Date(d + 'T00:00:00').getDay()
      if (wd !== 0 && wd !== 6) days.push(d)
    }
    return state.departments
      .map((d) => {
        const staff = new Set(state.timesheets.filter((t) => state.employees.find((e) => e.id === t.employeeId)?.departmentId === d.id).map((t) => t.employeeId))
        if (staff.size === 0) return null
        const present = [...staff].reduce((s, id) => s + days.filter((day) => state.timesheets.some((t) => t.employeeId === id && t.date === day)).length, 0)
        return { d, staff: staff.size, rate: present / (staff.size * days.length) }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
  }, [state.departments, state.timesheets, state.employees, today])
  const empName = (id: string) => fullName(state.employees.find((e) => e.id === id))
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending leave requests" value={pending.length} to="/approvals?tab=leave" hint="review in Approvals" icon={<CalendarCheck className="size-5" />} tone="amber" />
        <StatCard label="On leave today" value={onLeaveToday.length} icon={<Users className="size-5" />} />
        <StatCard label="Approved, next 30 days" value={upcoming.length} icon={<CalendarCheck className="size-5" />} tone="emerald" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leave requests awaiting approval" actions={<ButtonLink size="sm" to="/approvals?tab=leave">Review</ButtonLink>} />
          <DataTable
            rows={pending}
            rowKey={(l) => l.id}
            pageSize={6}
            empty={<EmptyState title="No pending leave" />}
            columns={[
              { key: 'n', header: 'Employee', render: (l) => (<span><span className="block text-slate-900">{empName(l.employeeId)}</span><span className="text-xs text-slate-500">{departmentName(state, state.employees.find((e) => e.id === l.employeeId)?.departmentId)}</span></span>) },
              { key: 't', header: 'Leave', render: (l) => `${l.type} · ${l.days}d` },
              { key: 'd', header: 'From', render: (l) => formatDate(l.startDate), hideBelow: 'sm' },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Attendance (last 2 weeks)" description="Days with time logged ÷ working days — project staff" />
          <ul className="divide-y divide-slate-100 text-sm">
            {attendance.map((a) => (
              <li key={a.d.id} className="px-5 py-3">
                <div className="flex justify-between"><span className="text-slate-800">{a.d.name}</span><span className="tabular text-slate-600">{Math.round(a.rate * 100)}% · {a.staff} staff</span></div>
                <ProgressBar className="mt-1.5" value={a.rate * 100} tone={a.rate < 0.85 ? 'amber' : 'emerald'} label="Attendance" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Who is away" description="Today and the next 30 days" />
        <DataTable
          rows={[...onLeaveToday, ...upcoming]}
          rowKey={(l) => l.id}
          pageSize={8}
          empty={<EmptyState title="Nobody is on leave" />}
          columns={[
            { key: 'n', header: 'Employee', render: (l) => empName(l.employeeId) },
            { key: 't', header: 'Type', render: (l) => l.type },
            { key: 'd', header: 'Dates', render: (l) => `${formatDate(l.startDate)} → ${formatDate(l.endDate)}` },
            { key: 's', header: '', render: (l) => (l.startDate <= today ? <Badge tone="warning">Away now</Badge> : <Badge>Upcoming</Badge>) },
          ]}
        />
      </Card>
    </div>
  )
}

function PerformanceTab() {
  const { state, perms } = useData()
  const periods = [...new Set(state.appraisals.map((a) => a.period))].sort().reverse()
  const [period, setPeriod] = useQueryState('period', periods[0] ?? '')
  const [dept, setDept] = useQueryState('dept')
  const [open, setOpen] = useState<Appraisal | null>(null)
  const rows = state.appraisals.filter((a) => a.period === period && (!dept || state.employees.find((e) => e.id === a.employeeId)?.departmentId === dept))
  const byDept = state.departments
    .map((d) => {
      const list = state.appraisals.filter((a) => a.period === period && state.employees.find((e) => e.id === a.employeeId)?.departmentId === d.id)
      const done = list.filter((a) => a.status === 'Completed')
      return { d, total: list.length, done: done.length, avg: done.length ? done.reduce((s, a) => s + (a.overall ?? 0), 0) / done.length : undefined }
    })
    .filter((x) => x.total > 0)
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (<Button key={p} size="sm" variant={p === period ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>{p}</Button>))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {byDept.map((r) => (
          <div key={r.d.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">{r.d.name}</p>
            <ProgressBar className="mt-2" value={(r.done / r.total) * 100} label="Completion" />
            <p className="mt-1.5 flex justify-between text-xs text-slate-500"><span>{r.done} of {r.total} complete</span><Rating value={r.avg} /></p>
          </div>
        ))}
      </div>
      <Card>
        <Toolbar>
          <FilterSelect label="Department" value={dept} onChange={setDept} options={byDept.map((r) => ({ value: r.d.id, label: r.d.name }))} allLabel="All departments" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          resetKey={period + dept}
          initialSort={{ key: 'overall', dir: 'desc' }}
          columns={[
            { key: 'n', header: 'Employee', sortValue: (a) => fullName(state.employees.find((e) => e.id === a.employeeId)), render: (a) => { const e = state.employees.find((x) => x.id === a.employeeId); return (<span><span className="block font-medium text-slate-900">{fullName(e)}</span><span className="text-xs text-slate-500">{e?.jobTitle}</span></span>) } },
            { key: 'r', header: 'Reviewer', render: (a) => fullName(state.employees.find((e) => e.id === a.reviewerId)), hideBelow: 'md' },
            { key: 's', header: 'Status', sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
            { key: 'overall', header: 'Overall', sortValue: (a) => a.overall ?? 0, render: (a) => <Rating value={a.overall} /> },
            { key: 'a', header: '', align: 'right', render: (a) => <Button size="sm" variant="ghost" onClick={() => setOpen(a)}>{perms.canManageHR && a.status !== 'Completed' ? 'Review' : 'View'}</Button> },
          ]}
        />
      </Card>
      <AppraisalModal appraisal={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function LearningTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [q, setQ] = useState('')
  const [status, setStatus] = useQueryState('cert')
  const [enrolling, setEnrolling] = useState(false)
  const certs = state.certifications.map((c) => ({ c, status: certStatus(c.expires), emp: state.employees.find((e) => e.id === c.employeeId) }))
  const rows = certs.filter((r) => (!status || r.status === status) && (!q || `${r.c.name} ${fullName(r.emp)}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Certifications on record" value={certs.length} icon={<Award className="size-5" />} />
        <StatCard label="Expiring in 60 days" value={certs.filter((r) => r.status === 'Expiring soon').length} icon={<Award className="size-5" />} tone="amber" />
        <StatCard label="Expired" value={certs.filter((r) => r.status === 'Expired').length} icon={<Award className="size-5" />} tone="rose" />
        <StatCard label="Training in progress" value={state.trainings.filter((t) => t.status !== 'Completed').length} icon={<GraduationCap className="size-5" />} tone="purple" />
      </div>
      <Card>
        <CardHeader title="Certifications" description="Staff update their own certifications in My workspace" />
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search certification or person…" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={['Valid', 'Expiring soon', 'Expired', 'No expiry']} allLabel="All statuses" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.c.id}
          resetKey={q + status}
          initialSort={{ key: 'exp', dir: 'asc' }}
          columns={[
            { key: 'n', header: 'Certification', sortValue: (r) => r.c.name, render: (r) => (<span><span className="block font-medium text-slate-900">{r.c.name}</span><span className="text-xs text-slate-500">{r.c.issuer}</span></span>) },
            { key: 'e', header: 'Holder', sortValue: (r) => fullName(r.emp), render: (r) => (<span><span className="block text-slate-800">{fullName(r.emp)}</span><span className="text-xs text-slate-500">{departmentName(state, r.emp?.departmentId)}</span></span>) },
            { key: 'exp', header: 'Expires', sortValue: (r) => r.c.expires ?? '9999', render: (r) => formatDate(r.c.expires), hideBelow: 'sm' },
            { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Training" actions={perms.canManageHR && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEnrolling(true)}>Enrol staff</Button>} />
        <DataTable
          rows={state.trainings}
          rowKey={(t) => t.id}
          initialSort={{ key: 'd', dir: 'asc' }}
          columns={[
            { key: 'c', header: 'Course', render: (t) => (<span><span className="block font-medium text-slate-900">{t.course}</span><span className="text-xs text-slate-500">{t.provider}</span></span>) },
            { key: 'e', header: 'Employee', render: (t) => fullName(state.employees.find((e) => e.id === t.employeeId)) },
            { key: 'd', header: 'Due', sortValue: (t) => t.dueDate, render: (t) => formatDate(t.dueDate), hideBelow: 'sm' },
            {
              key: 's',
              header: 'Status',
              render: (t) =>
                perms.canManageHR ? (
                  <select aria-label="Training status" value={t.status} onChange={(e) => run(() => commit((s) => saveTraining(s, { ...t, status: e.target.value as TrainingRecord['status'] }, t.id)), { title: 'Training updated' })} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                    {['Enrolled', 'In progress', 'Completed'].map((s) => (<option key={s}>{s}</option>))}
                  </select>
                ) : (
                  <StatusBadge status={t.status} />
                ),
            },
          ]}
        />
      </Card>
      <FormModal
        open={enrolling}
        onClose={() => setEnrolling(false)}
        title="Enrol staff on training"
        fields={[
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: state.employees.filter((e) => e.status !== 'Inactive').map((e) => ({ value: e.id, label: `${fullName(e)} — ${departmentName(state, e.departmentId)}` })) },
          { name: 'course', label: 'Course', required: true },
          { name: 'provider', label: 'Provider', required: true },
          { name: 'dueDate', label: 'Complete by', type: 'date', required: true },
        ]}
        initial={{ provider: 'In-house', dueDate: addDays(todayISO(), 30) }}
        onSubmit={(v) => run(() => commit((s) => saveTraining(s, { employeeId: v.employeeId, course: v.course, provider: v.provider, dueDate: v.dueDate, status: 'Enrolled' })), { title: 'Enrolled' })}
      />
    </div>
  )
}
