import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, ClipboardList, FilePlus2, GitPullRequest, ListPlus, Settings2, Users } from 'lucide-react'
import { useData } from '../../data/store'
import { addStatusReport, raiseChangeRequest, saveTask, setProjectMembers, setTaskStatus, toggleProjectMilestone, updateProjectStatus } from '../../data/workActions'
import { departmentName, fullName } from '../../data/selectors'
import { isOverdue, projectProgress, utilisation } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { addDays, formatDate, formatDateTime, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact } from '../../lib/money'
import { cn } from '../../lib/utils'
import { TASK_STATUSES, type ProjectHealth, type ProjectStatus, type Task } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { FormModal, formValue } from '../../components/ui/FormModal'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Checkbox } from '../../components/ui/Form'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice, ProgressBar } from '../../components/ui/Progress'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'
import { visibleProjects } from './ProjectsPage'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { state, perms, commit } = useData()
  const run = useAction()
  const project = state.projects.find((p) => p.id === id)
  const [modal, setModal] = useState<'status' | 'report' | 'task' | 'cr' | 'team' | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [completing, setCompleting] = useState<Task | null>(null)
  const [members, setMembers] = useState<string[]>([])
  if (!project) return <NotFoundPage title="Project not found" />
  if (!visibleProjects(perms, [project]).length) return <AccessDenied message="This project belongs to another team." />

  const today = todayISO()
  const manage = perms.canManageProjects && project.departmentId === perms.user.departmentId
  const live = project.status !== 'Pending approval' && project.status !== 'Rejected'
  const tasks = state.tasks.filter((t) => t.projectId === project.id)
  const progress = projectProgress(project, state.tasks)
  const crs = state.changeRequests.filter((c) => c.projectId === project.id)
  const reports = state.statusReports.filter((r) => r.projectId === project.id).sort((a, b) => b.at.localeCompare(a.at))
  const empName = (eid: string) => fullName(state.employees.find((e) => e.id === eid))
  const util = utilisation(state, project.memberIds, 21, today)
  const manager = state.users.find((u) => u.id === project.managerUserId)
  const budgetUsed = project.budgetMinor ? (project.costToDateMinor / project.budgetMinor) * 100 : 0
  const teamCandidates = state.employees.filter((e) => e.departmentId === project.departmentId && e.status !== 'Inactive')

  return (
    <>
      <PageHeader
        title={project.name}
        meta={
          <>
            <StatusBadge status={project.status} />
            {live && project.status !== 'Completed' && <StatusBadge status={project.health} />}
          </>
        }
        description={`${project.code} · ${project.clientName} · ${departmentName(state, project.departmentId)} · Manager: ${manager?.name ?? '—'}`}
        actions={
          manage &&
          live && (
            <>
              <Button variant="secondary" icon={<Settings2 className="size-4" />} onClick={() => setModal('status')}>
                Status
              </Button>
              <Button variant="secondary" icon={<GitPullRequest className="size-4" />} onClick={() => setModal('cr')}>
                Change request
              </Button>
              <Button variant="secondary" icon={<FilePlus2 className="size-4" />} onClick={() => setModal('report')}>
                Status report
              </Button>
              <Button icon={<ListPlus className="size-4" />} onClick={() => setModal('task')}>
                Assign task
              </Button>
            </>
          )
        }
      />
      {project.status === 'Pending approval' && (
        <div className="mb-6">
          <Notice tone="warning">This project is above ₦50m and is waiting for the CEO’s final approval. Tasks can be assigned once it is approved.</Notice>
        </div>
      )}
      {project.status === 'Rejected' && (
        <div className="mb-6">
          <Notice tone="warning">Rejected by the CEO: {project.rejectionReason}</Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Contract value" value={formatMoney(project.contractValueMinor)} hint={project.approval ? `Approved by ${project.approval.by}` : undefined} />
        <Kpi label="Progress" value={`${progress}%`} bar={progress} hint={`${tasks.filter((t) => t.status === 'Done').length} of ${tasks.length} tasks done`} />
        <Kpi label="Cost to date" value={formatMoneyCompact(project.costToDateMinor)} bar={budgetUsed} barTone={budgetUsed > progress + 10 ? 'rose' : 'brand'} hint={`${Math.round(budgetUsed)}% of ${formatMoneyCompact(project.budgetMinor)} budget`} />
        <Kpi label="Schedule" value={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`} hint={project.endDate < today && project.status !== 'Completed' ? 'Past end date' : `${Math.max(0, Math.round((Date.parse(project.endDate) - Date.parse(today)) / 86_400_000))} days remaining`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Tasks" description="Who is doing what, and by when" />
          <DataTable
            rows={tasks}
            rowKey={(t) => t.id}
            pageSize={8}
            initialSort={{ key: 'due', dir: 'asc' }}
            empty={<EmptyState title="No tasks yet" description={manage && live ? 'Assign the first task to the team.' : undefined} />}
            columns={[
              { key: 'title', header: 'Task', sortValue: (t) => t.title, render: (t) => (<span><span className="block font-medium text-slate-900">{t.title}</span><span className="text-xs text-slate-500">{empName(t.assigneeId)} · {t.estimateHours}h</span></span>) },
              { key: 'due', header: 'Due', sortValue: (t) => t.dueDate, render: (t) => <span className={cn('whitespace-nowrap', isOverdue(t, today) && 'font-medium text-rose-600')}>{formatDate(t.dueDate)}</span> },
              {
                key: 'status',
                header: 'Status',
                render: (t) =>
                  manage ? (
                    <select
                      aria-label={`Status of ${t.title}`}
                      value={t.status}
                      onChange={(e) => (e.target.value === 'Done' ? setCompleting(t) : run(() => commit((s) => setTaskStatus(s, t.id, e.target.value as Task['status']))))}
                      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
                    >
                      {TASK_STATUSES.map((s) => (<option key={s}>{s}</option>))}
                    </select>
                  ) : (
                    <StatusBadge status={t.status} />
                  ),
              },
              { key: 'a', header: '', align: 'right', render: (t) => (manage && t.status !== 'Done' ? <Button size="sm" variant="ghost" onClick={() => setEditTask(t)}>Reassign</Button> : null) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Milestones" />
          <CardBody>
            <ol className="space-y-1">
              {project.milestones.map((m) => (
                <li key={m.id}>
                  <button disabled={!manage || !live} onClick={() => run(() => commit((s) => toggleProjectMilestone(s, project.id, m.id)))} className={cn('flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm', manage && live && 'hover:bg-slate-50')}>
                    {m.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className={cn('mt-0.5 size-5 shrink-0', m.dueDate < today ? 'text-rose-500' : 'text-slate-300')} />}
                    <span>
                      <span className={cn('block font-medium', m.done ? 'text-slate-500' : 'text-slate-800')}>{m.name}</span>
                      <span className="text-xs text-slate-500">{m.done ? `Done ${formatDate(m.doneAt)}` : `Due ${formatDate(m.dueDate)}`}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Team & utilisation"
            description="Hours logged in the last 3 weeks"
            actions={
              manage && live ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Users className="size-4" />}
                  onClick={() => {
                    setMembers(project.memberIds)
                    setModal('team')
                  }}
                >
                  Manage
                </Button>
              ) : undefined
            }
          />
          {project.memberIds.length === 0 ? (
            <EmptyState title="No team assigned" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {util.map((u) => {
                const open = tasks.filter((t) => t.assigneeId === u.employeeId && t.status !== 'Done').length
                return (
                  <li key={u.employeeId} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{empName(u.employeeId)}</span>
                      <span className="tabular text-xs text-slate-500">{u.hours}h · {Math.round(u.rate * 100)}%</span>
                    </div>
                    <ProgressBar className="mt-1.5" value={u.rate * 100} tone={u.rate > 1 ? 'rose' : u.rate < 0.5 ? 'amber' : 'emerald'} label="Utilisation" />
                    <p className="mt-1 text-xs text-slate-500">{open} open task(s)</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Change requests" description="Scope changes with cost and schedule impact" />
          <DataTable
            rows={crs}
            rowKey={(c) => c.id}
            pageSize={5}
            empty={<EmptyState title="No change requests" />}
            columns={[
              { key: 'c', header: 'Request', render: (c) => (<span><span className="block font-medium text-slate-900">{c.title}</span><span className="text-xs text-slate-500">{c.code} · {c.raisedBy} · {formatDate(c.raisedAt.slice(0, 10))}</span></span>) },
              { key: 'cost', header: 'Cost', align: 'right', render: (c) => formatMoneyCompact(c.costImpactMinor) },
              { key: 'days', header: 'Days', align: 'right', render: (c) => `+${c.daysImpact}`, hideBelow: 'sm' },
              { key: 's', header: 'Status', render: (c) => (<span><StatusBadge status={c.status} />{c.decidedBy && <span className="block text-xs text-slate-500">{c.decidedBy}</span>}</span>) },
            ]}
          />
          {crs.some((c) => c.status === 'Pending') && (
            <CardBody className="border-t border-slate-100">
              <Link to="/approvals?tab=changes" className="text-sm font-medium text-brand-700 hover:underline">
                Decide pending change requests in Approvals →
              </Link>
            </CardBody>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Status reports" description="Published by the project manager" />
        {reports.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title="No status reports yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((r) => (
              <li key={r.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.health} />
                  <Badge>{r.percentComplete}% complete</Badge>
                  <span className="text-xs text-slate-500">
                    {r.author} · {formatDateTime(r.at)}
                  </span>
                </div>
                <p className="mt-2 text-slate-700">{r.summary}</p>
                <p className="mt-1 text-slate-500">
                  <span className="font-medium text-slate-600">Next: </span>
                  {r.nextSteps}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------- dialogs ---------- */}
      <FormModal
        open={modal === 'status'}
        onClose={() => setModal(null)}
        title="Project status"
        fields={[
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Planning', 'Active', 'On hold', 'Completed'] },
          { name: 'health', label: 'Health', type: 'select', required: true, options: ['On track', 'At risk', 'Off track'] },
        ]}
        initial={{ status: project.status, health: project.health }}
        onSubmit={(v) => run(() => commit((s) => updateProjectStatus(s, project.id, v.status as ProjectStatus, v.health as ProjectHealth)), { title: 'Status updated' })}
      />
      <FormModal
        open={modal === 'report'}
        onClose={() => setModal(null)}
        title="Publish status report"
        description={`Progress is calculated from tasks: ${progress}% complete.`}
        fields={[
          { name: 'health', label: 'Overall health', type: 'select', required: true, options: ['On track', 'At risk', 'Off track'] },
          { name: 'summary', label: 'Summary', type: 'textarea', required: true, min: 10 },
          { name: 'nextSteps', label: 'Next steps', type: 'textarea', required: true, min: 5 },
        ]}
        initial={{ health: project.health }}
        submitLabel="Publish"
        onSubmit={(v) => run(() => commit((s) => addStatusReport(s, project.id, { health: v.health as ProjectHealth, summary: v.summary, nextSteps: v.nextSteps }, progress)), { title: 'Status report published' })}
      />
      <FormModal
        open={modal === 'task' || !!editTask}
        onClose={() => {
          setModal(null)
          setEditTask(null)
        }}
        title={editTask ? 'Reassign task' : 'Assign a task'}
        fields={[
          { name: 'title', label: 'Task', required: true, full: true, min: 3 },
          { name: 'assigneeId', label: 'Assign to', type: 'select', required: true, options: teamCandidates.map((e) => ({ value: e.id, label: `${fullName(e)} — ${e.jobTitle}` })) },
          { name: 'milestoneId', label: 'Milestone', type: 'select', options: project.milestones.map((m) => ({ value: m.id, label: m.name })) },
          { name: 'startDate', label: 'Start', type: 'date', required: true },
          { name: 'dueDate', label: 'Due', type: 'date', required: true },
          { name: 'estimateHours', label: 'Estimated hours', type: 'number', required: true, min: 1, max: 400 },
        ]}
        initial={editTask ? { title: editTask.title, assigneeId: editTask.assigneeId, milestoneId: editTask.milestoneId ?? '', startDate: editTask.startDate, dueDate: editTask.dueDate, estimateHours: String(editTask.estimateHours) } : { startDate: today, dueDate: addDays(today, 7), estimateHours: '8' }}
        submitLabel={editTask ? 'Save' : 'Assign'}
        onSubmit={(v) => run(() => commit((s) => saveTask(s, { projectId: project.id, title: v.title, assigneeId: v.assigneeId, milestoneId: formValue.optional(v.milestoneId), startDate: v.startDate, dueDate: v.dueDate, estimateHours: formValue.number(v.estimateHours) }, editTask?.id)), { title: editTask ? 'Task updated' : 'Task assigned', description: 'The assignee has been notified.' })}
      />
      <FormModal
        open={modal === 'cr'}
        onClose={() => setModal(null)}
        title="Raise a change request"
        description="Up to ₦10m is decided by the team manager; above that by the CEO."
        fields={[
          { name: 'title', label: 'Change', required: true, full: true, min: 5 },
          { name: 'description', label: 'Details & justification', type: 'textarea', required: true, min: 10 },
          { name: 'cost', label: 'Cost impact (₦)', type: 'money', required: true },
          { name: 'days', label: 'Schedule impact (days)', type: 'number', required: true, min: 0, max: 365 },
        ]}
        initial={{ days: '0' }}
        submitLabel="Submit"
        onSubmit={(v) => run(() => commit((s) => raiseChangeRequest(s, { projectId: project.id, title: v.title, description: v.description, costImpactMinor: formValue.money(v.cost), daysImpact: formValue.number(v.days) })), { title: 'Change request submitted' })}
      />
      <Modal
        open={modal === 'team'}
        onClose={() => setModal(null)}
        title="Project team"
        description={`Choose who works on this project (${departmentName(state, project.departmentId)})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (run(() => commit((s) => setProjectMembers(s, project.id, members)), { title: 'Team updated' })) setModal(null)
              }}
            >
              Save team
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {teamCandidates.map((e) => (
            <Checkbox key={e.id} label={fullName(e)} description={e.jobTitle} checked={members.includes(e.id)} onChange={(ev) => setMembers((m) => (ev.target.checked ? [...m, e.id] : m.filter((x) => x !== e.id)))} />
          ))}
        </div>
      </Modal>
      <ConfirmDialog
        open={!!completing}
        onClose={() => setCompleting(null)}
        title="Mark task as done?"
        tone="success"
        confirmLabel="Mark done"
        message={completing?.title}
        noteLabel="Completion note"
        onConfirm={(note) => {
          run(() => commit((s) => setTaskStatus(s, completing!.id, 'Done', note)), { title: 'Task completed' })
          setCompleting(null)
        }}
      />
    </>
  )
}

function Kpi({ label, value, hint, bar, barTone = 'brand' }: { label: string; value: string; hint?: string; bar?: number; barTone?: 'brand' | 'rose' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="tabular mt-1.5 text-lg font-semibold text-slate-900">{value}</p>
      {bar !== undefined && <ProgressBar className="mt-2" value={bar} tone={barTone} label={label} />}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
