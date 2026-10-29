import { useMemo, useState } from 'react'
import { Award, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, FileText, HeartPulse, ListChecks, Plane, Plus, Printer, Receipt, Trash2, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { DomainError } from '../../data/actions'
import { addSkill, addTimesheetEntry, cancelLeave, deleteTimesheetEntry, removeCertification, removeSkill, requestLeave, saveCertification, setTaskStatus, submitClaim, workingDays } from '../../data/workActions'
import { certStatus, gradeOf, isOverdue, leaveBalance, payslipFor, PAY_RULES } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { useTabParam } from '../../hooks/useQueryState'
import { addDays, addMonths, formatDate, monthKey, monthLabel, parseISODate, toISODate, todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { cn } from '../../lib/utils'
import { CLAIM_CATEGORIES, LEAVE_TYPES, type Certification, type ExpenseClaim, type LeaveRequest, type SkillRecord, type Task } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { FormModal, formValue } from '../../components/ui/FormModal'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Form'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice, ProgressBar } from '../../components/ui/Progress'
import type { WorkspaceTab } from '../auth/permissions'

const LABELS: Record<WorkspaceTab, string> = {
  tasks: 'My tasks',
  calendar: 'Project calendar',
  timesheets: 'Timesheets',
  leave: 'Leave & claims',
  pay: 'Pay & benefits',
  skills: 'Skills & certifications',
}

export default function WorkspacePage() {
  const { state, perms } = useData()
  const allowed = perms.workspaceTabs
  const [tabParam, setTab] = useTabParam<WorkspaceTab>('tasks')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  const empId = perms.user.employeeId
  const open = state.tasks.filter((t) => t.assigneeId === empId && t.status !== 'Done').length
  return (
    <>
      <PageHeader title="My workspace" description="Your tasks, calendar, timesheets, leave, pay documents and certifications. Only you can see and edit this information." />
      <Card>
        <div className="px-4 pt-1">
          <Tabs label="Workspace sections" active={tab} onChange={setTab} tabs={allowed.map((k) => ({ key: k, label: LABELS[k], count: k === 'tasks' && open ? open : undefined }))} />
        </div>
        {tab === 'tasks' && <TasksTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'timesheets' && <TimesheetsTab />}
        {tab === 'leave' && <LeaveTab />}
        {tab === 'pay' && <PayTab />}
        {tab === 'skills' && <SkillsTab />}
      </Card>
    </>
  )
}

// ---------------- Tasks ----------------

function TasksTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [completing, setCompleting] = useState<Task | null>(null)
  const today = todayISO()
  // open tasks first (soonest due), then completed ones (most recent first)
  const mine = [
    ...state.tasks.filter((t) => t.assigneeId === perms.user.employeeId && t.status !== 'Done').sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    ...state.tasks.filter((t) => t.assigneeId === perms.user.employeeId && t.status === 'Done').sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
  ]
  const projectOf = (id: string) => state.projects.find((p) => p.id === id)
  const myProjects = state.projects.filter((p) => p.memberIds.includes(perms.user.employeeId ?? '') && p.status !== 'Pending approval' && p.status !== 'Rejected')
  const weekEnd = addDays(today, 7)
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tasks" value={mine.filter((t) => t.status !== 'Done').length} icon={<ListChecks className="size-5" />} />
        <StatCard label="Due this week" value={mine.filter((t) => t.status !== 'Done' && t.dueDate >= today && t.dueDate <= weekEnd).length} icon={<CalendarDays className="size-5" />} tone="purple" />
        <StatCard label="Overdue" value={mine.filter((t) => isOverdue(t, today)).length} icon={<Clock className="size-5" />} tone="rose" />
        <StatCard label="Completed" value={mine.filter((t) => t.status === 'Done').length} icon={<CheckCircle2 className="size-5" />} tone="emerald" />
      </div>
      <Card>
        <CardHeader title="Assigned to me" description="Start a task, then mark it complete with a short note" />
        <DataTable
          rows={mine}
          rowKey={(t) => t.id}
          empty={<EmptyState title="No tasks assigned" description="Tasks your manager assigns will appear here." />}
          columns={[
            { key: 'task', header: 'Task', sortValue: (t) => t.title, render: (t) => (<span><span className="block font-medium text-slate-900">{t.title}</span><span className="text-xs text-slate-500">{projectOf(t.projectId)?.name} · assigned by {t.assignedBy}</span></span>) },
            { key: 'due', header: 'Due', sortValue: (t) => t.dueDate, render: (t) => <span className={cn('whitespace-nowrap', isOverdue(t, today) && 'font-medium text-rose-600')}>{formatDate(t.dueDate)}{isOverdue(t, today) && <span className="block text-xs">Overdue</span>}</span> },
            { key: 'est', header: 'Estimate', align: 'right', render: (t) => `${t.estimateHours}h`, hideBelow: 'md' },
            { key: 'status', header: 'Status', sortValue: (t) => t.status, render: (t) => (<span><StatusBadge status={t.status} />{t.completionNote && <span className="mt-0.5 block max-w-[14rem] truncate text-xs text-slate-500" title={t.completionNote}>{t.completionNote}</span>}</span>) },
            {
              key: 'a',
              header: '',
              align: 'right',
              render: (t) =>
                t.status === 'To do' ? (
                  <Button size="sm" variant="secondary" onClick={() => run(() => commit((s) => setTaskStatus(s, t.id, 'In progress')), { title: 'Task started' })}>Start</Button>
                ) : t.status === 'In progress' ? (
                  <Button size="sm" variant="success" onClick={() => setCompleting(t)}>Mark complete</Button>
                ) : null,
            },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Milestone tracker" description="Milestones on the projects you work on" />
        {myProjects.length === 0 ? (
          <EmptyState title="You are not on any projects yet" />
        ) : (
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
            {myProjects.map((p) => {
              const done = p.milestones.filter((m) => m.done).length
              const next = p.milestones.find((m) => !m.done)
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.clientName}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <ProgressBar className="mt-3" value={(done / p.milestones.length) * 100} label="Milestones" />
                  <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                    {p.milestones.map((m) => (
                      <li key={m.id} className="flex items-center gap-1 text-xs text-slate-600">
                        {m.done ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Circle className="size-3.5 text-slate-300" />}
                        {m.name}
                      </li>
                    ))}
                  </ol>
                  {next && <p className="mt-2 text-xs text-slate-500">Next: <span className="font-medium text-slate-700">{next.name}</span> by {formatDate(next.dueDate)}</p>}
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={!!completing}
        onClose={() => setCompleting(null)}
        title="Complete this task?"
        tone="success"
        confirmLabel="Mark complete"
        message={completing?.title}
        noteLabel="Completion note"
        notePlaceholder="What was done, links to documents…"
        onConfirm={(note) => {
          run(() => commit((s) => setTaskStatus(s, completing!.id, 'Done', note)), { title: 'Task completed', description: 'Your manager has been notified.' })
          setCompleting(null)
        }}
      />
    </div>
  )
}

// ---------------- Calendar ----------------

function CalendarTab() {
  const { state, perms } = useData()
  const today = todayISO()
  const [month, setMonth] = useState(monthKey(today))
  const empId = perms.user.employeeId ?? ''
  const first = parseISODate(month + '-01')
  const startOffset = (first.getDay() + 6) % 7 // Monday first
  const gridStart = addDays(month + '-01', -startOffset)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const myProjects = state.projects.filter((p) => p.memberIds.includes(empId))
  type Ev = { label: string; kind: 'task' | 'due' | 'milestone' | 'leave'; tone: string }
  const events = useMemo(() => {
    const map = new Map<string, Ev[]>()
    const add = (d: string, e: Ev) => map.set(d, [...(map.get(d) ?? []), e])
    state.tasks.filter((t) => t.assigneeId === empId).forEach((t) => add(t.dueDate, { label: `${t.title}`, kind: 'due', tone: t.status === 'Done' ? 'bg-emerald-50 text-emerald-800' : t.dueDate < today ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800' }))
    myProjects.forEach((p) => p.milestones.forEach((m) => add(m.dueDate, { label: `◆ ${m.name}`, kind: 'milestone', tone: 'bg-ink-900 text-brand-400' })))
    state.leaveRequests
      .filter((l) => l.employeeId === empId && l.status !== 'Rejected')
      .forEach((l) => {
        for (let d = l.startDate; d <= l.endDate; d = addDays(d, 1)) add(d, { label: `${l.type} leave${l.status === 'Pending' ? ' (pending)' : ''}`, kind: 'leave', tone: 'bg-violet-50 text-violet-800' })
      })
    return map
  }, [state.tasks, state.leaveRequests, myProjects, empId, today])
  return (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" aria-label="Previous month" onClick={() => setMonth(monthKey(addMonths(month + '-01', -1)))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="secondary" onClick={() => setMonth(monthKey(today))}>Today</Button>
          <Button size="sm" variant="secondary" aria-label="Next month" onClick={() => setMonth(monthKey(addMonths(month + '-01', 1)))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-slate-50 px-2 py-1.5 font-semibold text-slate-500">{d}</div>
        ))}
        {days.map((d) => {
          const evs = events.get(d) ?? []
          const inMonth = d.startsWith(month)
          return (
            <div key={d} className={cn('min-h-20 bg-white p-1 sm:min-h-24', !inMonth && 'bg-slate-50/70 text-slate-400')}>
              <p className={cn('mb-1 inline-flex size-6 items-center justify-center rounded-full text-[11px]', d === today ? 'bg-brand-500 font-semibold text-ink-950' : '')}>{parseISODate(d).getDate()}</p>
              <ul className="space-y-0.5">
                {evs.slice(0, 3).map((e, i) => (
                  <li key={i} className={cn('truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px]', e.tone)} title={e.label}>{e.label}</li>
                ))}
                {evs.length > 3 && <li className="px-1 text-[10px] text-slate-500">+{evs.length - 3} more</li>}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-brand-200" /> Task due</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-rose-200" /> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-emerald-200" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-ink-900" /> Project milestone</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-violet-200" /> Leave</span>
      </div>
    </div>
  )
}

// ---------------- Timesheets ----------------

function mondayOf(iso: string): string {
  const d = parseISODate(iso)
  return addDays(iso, -((d.getDay() + 6) % 7))
}

function TimesheetsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const today = todayISO()
  const [week, setWeek] = useState(mondayOf(today))
  const empId = perms.user.employeeId ?? ''
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const entries = state.timesheets.filter((t) => t.employeeId === empId && t.date >= week && t.date <= days[6]).sort((a, b) => a.date.localeCompare(b.date))
  const myProjects = state.projects.filter((p) => p.memberIds.includes(empId) && (p.status === 'Active' || p.status === 'Planning'))
  const [date, setDate] = useState(today)
  const [projectId, setProjectId] = useState(myProjects[0]?.id ?? '')
  const [taskId, setTaskId] = useState('')
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')
  const tasks = state.tasks.filter((t) => t.projectId === projectId && t.assigneeId === empId)
  const total = entries.reduce((s, e) => s + e.hours, 0)
  const add = () => {
    const h = Number(hours)
    if (!projectId) return
    if (run(() => commit((s) => addTimesheetEntry(s, { date, projectId, taskId: taskId || undefined, hours: h, note: note.trim() || 'Project work' })), { title: 'Time logged', description: `${h}h on ${formatDate(date)}` })) setNote('')
  }
  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name ?? '—'
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Card>
        <CardHeader title="Log time" description="Against the projects and tasks you are assigned to" />
        {myProjects.length === 0 ? (
          <CardBody><Notice>You are not assigned to an active project, so there is nothing to log time against yet.</Notice></CardBody>
        ) : (
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9.5rem_1fr_1fr_5.5rem_1fr_auto] lg:items-end">
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Date</span><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Project</span>
              <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId('') }}>
                {myProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Task</span>
              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">General project work</option>
                {tasks.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
              </Select>
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Hours</span><Input type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Note</span><Input value={note} placeholder="What you worked on" onChange={(e) => setNote(e.target.value)} /></label>
            <Button icon={<Plus className="size-4" />} onClick={add}>Add</Button>
          </CardBody>
        )}
      </Card>
      <Card>
        <CardHeader
          title={`Week of ${formatDate(week)}`}
          description={`${total}h logged · ${Math.round((total / 40) * 100)}% of a 40-hour week`}
          actions={
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button>
              <Button size="sm" variant="secondary" onClick={() => setWeek(mondayOf(today))}>This week</Button>
              <Button size="sm" variant="secondary" aria-label="Next week" disabled={addDays(week, 7) > today} onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button>
            </div>
          }
        />
        <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs">
          {days.map((d) => {
            const h = entries.filter((e) => e.date === d).reduce((s, e) => s + e.hours, 0)
            return (
              <div key={d} className={cn('px-1 py-2', d === today && 'bg-brand-50')}>
                <p className="text-slate-500">{parseISODate(d).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                <p className={cn('tabular text-sm font-semibold', h === 0 ? 'text-slate-300' : h > 9 ? 'text-amber-700' : 'text-slate-900')}>{h}h</p>
              </div>
            )
          })}
        </div>
        <DataTable
          rows={entries}
          rowKey={(e) => e.id}
          pageSize={10}
          empty={<EmptyState title="No time logged this week" />}
          columns={[
            { key: 'd', header: 'Date', render: (e) => formatDate(e.date) },
            { key: 'p', header: 'Project / task', render: (e) => (<span><span className="block text-slate-900">{projectName(e.projectId)}</span><span className="text-xs text-slate-500">{e.note}</span></span>) },
            { key: 'h', header: 'Hours', align: 'right', render: (e) => `${e.hours}h` },
            { key: 'a', header: '', align: 'right', render: (e) => (<Button size="sm" variant="ghost" aria-label="Remove entry" onClick={() => run(() => commit((s) => deleteTimesheetEntry(s, e.id)), { title: 'Entry removed' })}><Trash2 className="size-4" /></Button>) },
          ]}
        />
      </Card>
    </div>
  )
}

// ---------------- Leave & claims ----------------

function LeaveTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [modal, setModal] = useState<'leave' | 'claim' | null>(null)
  const empId = perms.user.employeeId ?? ''
  const bal = leaveBalance(state, empId)
  const leaves = state.leaveRequests.filter((l) => l.employeeId === empId)
  const claims = state.expenseClaims.filter((c) => c.employeeId === empId)
  const myProjects = state.projects.filter((p) => p.memberIds.includes(empId) && p.status === 'Active')
  const today = todayISO()
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Annual leave left" value={`${bal.remaining} days`} hint={`of ${bal.entitlement} this year`} icon={<Plane className="size-5" />} />
        <StatCard label="Taken" value={`${bal.taken} days`} hint={bal.pending ? `${bal.pending} pending` : 'annual leave'} icon={<CalendarDays className="size-5" />} tone="purple" />
        <StatCard label="Claims awaiting approval" value={claims.filter((c) => c.status === 'Pending').length} icon={<Receipt className="size-5" />} tone="amber" />
        <StatCard label="Approved, not yet paid" value={formatMoney(claims.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.amountMinor, 0))} icon={<Wallet className="size-5" />} tone="emerald" />
      </div>
      <Card>
        <CardHeader title="My leave requests" actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setModal('leave')}>Request leave</Button>} />
        <DataTable
          rows={leaves}
          rowKey={(l) => l.id}
          pageSize={6}
          initialSort={{ key: 'start', dir: 'desc' }}
          empty={<EmptyState title="No leave requests" />}
          columns={[
            { key: 'type', header: 'Type', render: (l) => l.type },
            { key: 'start', header: 'Dates', sortValue: (l) => l.startDate, render: (l) => `${formatDate(l.startDate)} → ${formatDate(l.endDate)}` },
            { key: 'days', header: 'Days', align: 'right', render: (l) => l.days },
            { key: 's', header: 'Status', render: (l) => (<span><StatusBadge status={l.status} />{l.decidedBy && <span className="block text-xs text-slate-500">{l.decidedBy}{l.decisionNote ? ` — ${l.decisionNote}` : ''}</span>}</span>) },
            { key: 'a', header: '', align: 'right', render: (l) => (l.status === 'Pending' ? <Button size="sm" variant="ghost" onClick={() => run(() => commit((s) => cancelLeave(s, l.id)), { title: 'Request cancelled' })}>Cancel</Button> : null) },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="My expense claims" description="Approved by your manager, then paid by Finance" actions={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setModal('claim')}>New claim</Button>} />
        <DataTable
          rows={claims}
          rowKey={(c) => c.id}
          pageSize={6}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState title="No claims" />}
          columns={[
            { key: 'c', header: 'Claim', render: (c) => (<span><span className="block font-medium text-slate-900">{c.description}</span><span className="text-xs text-slate-500">{c.code} · {c.category}</span></span>) },
            { key: 'date', header: 'Date', sortValue: (c) => c.date, render: (c) => formatDate(c.date), hideBelow: 'sm' },
            { key: 'amt', header: 'Amount', align: 'right', render: (c) => formatMoney(c.amountMinor) },
            { key: 's', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </Card>
      <FormModal
        open={modal === 'leave'}
        onClose={() => setModal(null)}
        title="Request leave"
        description={`You have ${bal.remaining} annual leave day(s) left. Weekends are not counted.`}
        fields={[
          { name: 'type', label: 'Leave type', type: 'select', required: true, options: LEAVE_TYPES },
          { name: 'reason', label: 'Reason', required: true, min: 3 },
          { name: 'startDate', label: 'From', type: 'date', required: true },
          { name: 'endDate', label: 'To', type: 'date', required: true },
        ]}
        initial={{ type: 'Annual', startDate: addDays(today, 14), endDate: addDays(today, 18) }}
        submitLabel="Submit request"
        onSubmit={(v) => {
          if (v.type === 'Annual' && workingDays(v.startDate, v.endDate) > bal.remaining) {
            run(() => {
              throw new DomainError(`That is more than the ${bal.remaining} annual leave day(s) you have left.`)
            })
            return false
          }
          return run(() => commit((s) => requestLeave(s, { type: v.type as LeaveRequest['type'], reason: v.reason, startDate: v.startDate, endDate: v.endDate })), { title: 'Leave requested', description: 'Your manager and HR have been notified.' })
        }}
      />
      <FormModal
        open={modal === 'claim'}
        onClose={() => setModal(null)}
        title="New expense claim"
        fields={[
          { name: 'description', label: 'Description', required: true, full: true, min: 3 },
          { name: 'category', label: 'Category', type: 'select', required: true, options: CLAIM_CATEGORIES },
          { name: 'amount', label: 'Amount (₦)', type: 'money', required: true },
          { name: 'date', label: 'Date of expense', type: 'date', required: true },
          { name: 'projectId', label: 'Project (optional)', type: 'select', options: myProjects.map((p) => ({ value: p.id, label: p.name })) },
        ]}
        initial={{ date: today, category: 'Transport' }}
        submitLabel="Submit claim"
        onSubmit={(v) => run(() => commit((s) => submitClaim(s, { description: v.description, category: v.category as ExpenseClaim['category'], amountMinor: formValue.money(v.amount), date: v.date, projectId: formValue.optional(v.projectId) })), { title: 'Claim submitted' })}
      >
        <Notice>Keep your receipt — in production you would attach it here.</Notice>
      </FormModal>
    </div>
  )
}

// ---------------- Pay & benefits ----------------

function PayTab() {
  const { state, perms } = useData()
  const today = todayISO()
  const grade = gradeOf(state, perms.user.employeeId)
  const slip = payslipFor(grade)
  const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonths(today, -i - (Number(today.slice(8, 10)) >= 25 ? 0 : 1))))
  const [viewing, setViewing] = useState<string | null>(null)
  const emp = state.employees.find((e) => e.id === perms.user.employeeId)
  const ytdMonths = months.filter((m) => m.startsWith(today.slice(0, 4))).length
  if (!slip || !grade) return <EmptyState title="No pay information" description="Your salary grade has not been set up yet." />
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <Notice tone="warning">Illustrative figures for the demo. Pension uses 8% (employee) and 10% (employer) of basic, housing and transport; the income-tax line is a flat {Math.round(PAY_RULES.illustrativeTaxRate * 100)}% estimate, not a PAYE calculation.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Net pay (monthly)" value={formatMoney(slip.net)} hint={`Grade ${grade.code} · ${grade.name}`} icon={<Wallet className="size-5" />} />
        <StatCard label="Gross pay" value={formatMoney(slip.gross)} icon={<FileText className="size-5" />} tone="purple" />
        <StatCard label="Pension (YTD, both)" value={formatMoney((slip.deductions[0].amountMinor + slip.employerPension) * ytdMonths)} hint="Demo Pensions PFA" icon={<Award className="size-5" />} tone="emerald" />
        <StatCard label="HMO" value="Gold — family" hint="Demo Health HMO Ltd" icon={<HeartPulse className="size-5" />} tone="rose" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Payslips" />
          <ul className="divide-y divide-slate-100">
            {months.map((m) => (
              <li key={m} className="flex items-center justify-between px-5 py-3 text-sm">
                <span><span className="block font-medium text-slate-800">{parseISODate(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span><span className="text-xs text-slate-500">Paid {formatDate(m + '-25')} · net {formatMoney(slip.net)}</span></span>
                <Button size="sm" variant="secondary" onClick={() => setViewing(m)}>View</Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Tax, pension & HMO documents" />
          <ul className="divide-y divide-slate-100 text-sm">
            <Doc title={`Annual tax summary ${Number(today.slice(0, 4)) - 1}`} sub="Income and tax deducted (illustrative)" />
            <Doc title="Pension contribution statement" sub={`Employee ${formatMoney(slip.deductions[0].amountMinor)} + employer ${formatMoney(slip.employerPension)} per month`} />
            <Doc title="RSA details" sub="Pension fund administrator: Demo Pensions PFA · PIN on file (hidden in demo)" />
            <Doc title="HMO membership card" sub="Demo Health HMO Ltd · Gold plan · principal + family" />
            <Doc title="Employment letter" sub={`${emp?.jobTitle ?? ''} since ${formatDate(emp?.joinDate)}`} />
          </ul>
        </Card>
      </div>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Payslip — ${viewing ? monthLabel(viewing) : ''}`} description={`${perms.user.name} · ${emp?.employeeNo ?? ''} · Grade ${grade.code}`} footer={<Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>}>
        <div className="space-y-4 text-sm">
          <SlipSection title="Earnings" rows={slip.earnings} total={slip.gross} totalLabel="Gross pay" />
          <SlipSection title="Deductions" rows={slip.deductions} total={slip.totalDeductions} totalLabel="Total deductions" />
          <div className="flex justify-between rounded-lg bg-ink-900 px-4 py-3 text-white"><span className="font-medium">Net pay</span><span className="tabular font-semibold text-brand-400">{formatMoney(slip.net)}</span></div>
          <p className="text-xs text-slate-500">Employer pension contribution (10%): {formatMoney(slip.employerPension)}. Illustrative demo payslip.</p>
        </div>
      </Modal>
    </div>
  )
}

function Doc({ title, sub }: { title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <FileText className="size-5 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1"><span className="block font-medium text-slate-800">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
      <Badge>Demo</Badge>
    </li>
  )
}

function SlipSection({ title, rows, total, totalLabel }: { title: string; rows: Array<{ label: string; amountMinor: number }>; total: number; totalLabel: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between px-3 py-2"><span className="text-slate-700">{r.label}</span><span className="tabular">{formatMoney(r.amountMinor)}</span></li>
        ))}
        <li className="flex justify-between bg-slate-50 px-3 py-2 font-medium"><span>{totalLabel}</span><span className="tabular">{formatMoney(total)}</span></li>
      </ul>
    </div>
  )
}

// ---------------- Skills & certifications ----------------

function SkillsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const empId = perms.user.employeeId ?? ''
  const [skill, setSkill] = useState('')
  const [level, setLevel] = useState<SkillRecord['level']>('Intermediate')
  const [editing, setEditing] = useState<Certification | 'new' | null>(null)
  const skills = state.skills.filter((s) => s.employeeId === empId)
  const certs = state.certifications.filter((c) => c.employeeId === empId)
  const trainings = state.trainings.filter((t) => t.employeeId === empId)
  const cert = editing && editing !== 'new' ? editing : undefined
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <Card>
        <CardHeader title="My skills" description="Visible to your manager and HR for staffing projects" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {skills.length === 0 && <p className="text-sm text-slate-500">No skills added yet.</p>}
            {skills.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm text-slate-700">
                {s.name} <span className="text-xs text-slate-500">· {s.level}</span>
                <button className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600" aria-label={`Remove ${s.name}`} onClick={() => run(() => commit((st) => removeSkill(st, s.id)))}>
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (run(() => commit((s) => addSkill(s, skill, level)), { title: 'Skill added' })) setSkill('') }}>
            <Input aria-label="Skill" placeholder="Add a skill, e.g. Fibre splicing" value={skill} onChange={(e) => setSkill(e.target.value)} className="sm:max-w-xs" />
            <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as SkillRecord['level'])} className="sm:w-40">
              {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((l) => (<option key={l}>{l}</option>))}
            </Select>
            <Button type="submit" variant="secondary" icon={<Plus className="size-4" />}>Add skill</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="My certifications" actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add certification</Button>} />
        <DataTable
          rows={certs}
          rowKey={(c) => c.id}
          empty={<EmptyState title="No certifications recorded" />}
          columns={[
            { key: 'n', header: 'Certification', render: (c) => (<span><span className="block font-medium text-slate-900">{c.name}</span><span className="text-xs text-slate-500">{c.issuer}</span></span>) },
            { key: 'i', header: 'Issued', render: (c) => formatDate(c.issued), hideBelow: 'sm' },
            { key: 'e', header: 'Expires', render: (c) => formatDate(c.expires) },
            { key: 's', header: 'Status', render: (c) => <StatusBadge status={certStatus(c.expires)} /> },
            { key: 'a', header: '', align: 'right', render: (c) => (<span className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button><Button size="sm" variant="ghost" aria-label="Remove" onClick={() => run(() => commit((s) => removeCertification(s, c.id)), { title: 'Certification removed' })}><Trash2 className="size-4" /></Button></span>) },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="My learning" description="Training assigned by HR" />
        <DataTable
          rows={trainings}
          rowKey={(t) => t.id}
          empty={<EmptyState title="No training assigned" />}
          columns={[
            { key: 'c', header: 'Course', render: (t) => (<span><span className="block font-medium text-slate-900">{t.course}</span><span className="text-xs text-slate-500">{t.provider}</span></span>) },
            { key: 'd', header: 'Due', render: (t) => formatDate(t.dueDate) },
            { key: 's', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          ]}
        />
      </Card>
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={cert ? 'Edit certification' : 'Add certification'}
        fields={[
          { name: 'name', label: 'Certification', required: true, full: true },
          { name: 'issuer', label: 'Issuing body', required: true },
          { name: 'issued', label: 'Issue date', type: 'date', required: true },
          { name: 'expires', label: 'Expiry date', type: 'date', hint: 'Leave empty if it does not expire' },
        ]}
        initial={cert ? { name: cert.name, issuer: cert.issuer, issued: cert.issued, expires: cert.expires ?? '' } : { issued: toISODate(new Date()) }}
        onSubmit={(v) => run(() => commit((s) => saveCertification(s, { name: v.name, issuer: v.issuer, issued: v.issued, expires: formValue.optional(v.expires) }, cert?.id)), { title: cert ? 'Certification updated' : 'Certification added' })}
      >
        <Notice>In production you would upload the certificate file here.</Notice>
      </FormModal>
    </div>
  )
}
