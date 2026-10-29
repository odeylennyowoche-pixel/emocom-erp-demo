import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, Gauge, ListChecks, Users } from 'lucide-react'
import { useData } from '../../data/store'
import { fullName } from '../../data/selectors'
import { isOverdue, utilisation } from '../../data/workSelectors'
import { useTabParam } from '../../hooks/useQueryState'
import { todayISO } from '../../lib/dates'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { ProgressBar, Rating } from '../../components/ui/Progress'
import { AXIS_PROPS, ChartTooltip } from '../../components/charts/chartKit'
import { ITAssetRegister } from '../admin/ITAssetRegister'
import { AppraisalModal } from './AppraisalModal'
import type { Appraisal } from '../../types'

type TabKey = 'overview' | 'appraisals' | 'assets'

export default function TeamPage() {
  const { perms } = useData()
  const [tab, setTab] = useTabParam<TabKey>('overview')
  return (
    <>
      <PageHeader title="My team" description={`${perms.department?.name ?? 'Team'} — performance, utilisation, appraisals and IT assets.`} />
      <Card>
        <div className="px-4 pt-1">
          <Tabs
            label="Team sections"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Performance & utilisation' },
              { key: 'appraisals', label: 'Appraisals' },
              { key: 'assets', label: 'IT asset register' },
            ]}
          />
        </div>
        {tab === 'overview' && <Overview />}
        {tab === 'appraisals' && <Appraisals />}
        {tab === 'assets' && <ITAssetRegister departmentId={perms.user.departmentId} />}
      </Card>
    </>
  )
}

function Overview() {
  const { state, perms } = useData()
  const today = todayISO()
  const team = useMemo(() => state.employees.filter((e) => e.departmentId === perms.user.departmentId && e.status !== 'Inactive' && e.id !== perms.user.employeeId), [state.employees, perms.user])
  const util = utilisation(state, team.map((e) => e.id), 21, today)
  const rows = team.map((e) => {
    const tasks = state.tasks.filter((t) => t.assigneeId === e.id)
    const onLeave = state.leaveRequests.some((l) => l.employeeId === e.id && l.status === 'Approved' && l.startDate <= today && l.endDate >= today)
    const last = state.appraisals.filter((a) => a.employeeId === e.id && a.status === 'Completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    const u = util.find((x) => x.employeeId === e.id)!
    return { e, open: tasks.filter((t) => t.status !== 'Done').length, done: tasks.filter((t) => t.status === 'Done').length, overdue: tasks.filter((t) => isOverdue(t, today)).length, util: u, onLeave, rating: last?.overall }
  })
  const logged = rows.filter((r) => r.util.hours > 0)
  const avgUtil = logged.length ? logged.reduce((s, r) => s + r.util.rate, 0) / logged.length : 0
  const chart = logged.map((r) => ({ name: r.e.firstName, Utilisation: Math.round(r.util.rate * 100) }))
  const upcoming = state.tasks
    .filter((t) => team.some((e) => e.id === t.assigneeId) && t.status !== 'Done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team members" value={team.length} hint={`${rows.filter((r) => r.onLeave).length} on leave today`} icon={<Users className="size-5" />} />
        <StatCard label="Average utilisation" value={`${Math.round(avgUtil * 100)}%`} hint="billable hours, last 3 weeks" icon={<Gauge className="size-5" />} tone="emerald" />
        <StatCard label="Open tasks" value={rows.reduce((s, r) => s + r.open, 0)} hint={`${rows.reduce((s, r) => s + r.done, 0)} done`} icon={<ListChecks className="size-5" />} tone="purple" />
        <StatCard label="Overdue tasks" value={rows.reduce((s, r) => s + r.overdue, 0)} icon={<CalendarClock className="size-5" />} tone="rose" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Utilisation by person" description="Hours logged ÷ available hours (8h a day), last 3 weeks" />
          <CardBody>
            {chart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No timesheets logged in this period.</p>
            ) : (
              <div className="h-60" role="img" aria-label="Utilisation chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="name" {...AXIS_PROPS} interval={0} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis {...AXIS_PROPS} unit="%" domain={[0, 120]} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={80} stroke="#0d9488" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#0f766e', fontSize: 11, position: 'insideTopRight' }} />
                    <Bar dataKey="Utilisation" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Upcoming team milestones & tasks" />
          <ul className="divide-y divide-slate-100 text-sm">
            {upcoming.map((t) => (
              <li key={t.id} className="px-5 py-2.5">
                <p className="font-medium text-slate-800">{t.title}</p>
                <p className={isOverdue(t, today) ? 'text-xs font-medium text-rose-600' : 'text-xs text-slate-500'}>
                  {fullName(state.employees.find((e) => e.id === t.assigneeId))} · due {t.dueDate}
                </p>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-slate-100">
            <Link to="/projects" className="text-sm font-medium text-brand-700 hover:underline">
              Open team projects →
            </Link>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Team performance" />
        <DataTable
          rows={rows}
          rowKey={(r) => r.e.id}
          initialSort={{ key: 'util', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Name', sortValue: (r) => fullName(r.e), render: (r) => (<span><Link to={`/employees/${r.e.id}`} className="block font-medium text-slate-900 hover:underline">{fullName(r.e)}</Link><span className="text-xs text-slate-500">{r.e.jobTitle}</span></span>) },
            { key: 'util', header: 'Utilisation', sortValue: (r) => r.util.rate, render: (r) => (<span className="block w-28"><ProgressBar value={r.util.rate * 100} tone={r.util.rate < 0.5 ? 'amber' : r.util.rate > 1 ? 'rose' : 'emerald'} label="Utilisation" /><span className="text-xs text-slate-500">{r.util.hours}h · {Math.round(r.util.rate * 100)}%</span></span>) },
            { key: 'open', header: 'Open', align: 'right', sortValue: (r) => r.open, render: (r) => r.open, hideBelow: 'sm' },
            { key: 'overdue', header: 'Overdue', align: 'right', sortValue: (r) => r.overdue, render: (r) => <span className={r.overdue ? 'font-medium text-rose-600' : ''}>{r.overdue}</span>, hideBelow: 'sm' },
            { key: 'rating', header: 'Last rating', sortValue: (r) => r.rating ?? 0, render: (r) => <Rating value={r.rating} />, hideBelow: 'md' },
            { key: 'status', header: 'Today', render: (r) => (r.onLeave ? <StatusBadge status="On Leave" /> : <StatusBadge status={r.e.status} />), hideBelow: 'lg' },
          ]}
        />
      </Card>
    </div>
  )
}

function Appraisals() {
  const { state, perms } = useData()
  const [open, setOpen] = useState<Appraisal | null>(null)
  const mine = state.appraisals.filter((a) => a.reviewerId === perms.user.employeeId)
  const periods = [...new Set(mine.map((a) => a.period))].sort().reverse()
  const [period, setPeriod] = useState(periods[0] ?? '')
  const rows = mine.filter((a) => a.period === period)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        {periods.map((p) => (
          <Button key={p} size="sm" variant={p === period ? 'primary' : 'secondary'} onClick={() => setPeriod(p)}>
            {p}
          </Button>
        ))}
        <span className="text-sm text-slate-500 sm:ml-auto">
          {rows.filter((a) => a.status === 'Completed').length} of {rows.length} completed
        </span>
      </div>
      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        initialSort={{ key: 'status', dir: 'asc' }}
        columns={[
          { key: 'name', header: 'Employee', sortValue: (a) => fullName(state.employees.find((e) => e.id === a.employeeId)), render: (a) => fullName(state.employees.find((e) => e.id === a.employeeId)) },
          { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
          { key: 'overall', header: 'Overall', render: (a) => <Rating value={a.overall} />, hideBelow: 'sm' },
          { key: 'kpis', header: 'KPIs', render: (a) => <Badge>{a.kpis.length} KPIs</Badge>, hideBelow: 'md' },
          { key: 'a', header: '', align: 'right', render: (a) => <Button size="sm" variant={a.status === 'Completed' ? 'ghost' : 'primary'} onClick={() => setOpen(a)}>{a.status === 'Completed' ? 'View' : 'Conduct appraisal'}</Button> },
        ]}
      />
      <AppraisalModal appraisal={open} onClose={() => setOpen(null)} />
    </>
  )
}
