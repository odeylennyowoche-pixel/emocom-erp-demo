import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Award,
  Boxes,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  Handshake,
  KeyRound,
  Laptop,
  ListChecks,
  Plane,
  Plug,
  Receipt,
  ShieldCheck,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useData } from '../../data/store'
import { activeHeadcount, budgetSummary, departmentName, fullName, invoiceTotal, itemValue, stockStatus } from '../../data/selectors'
import { cashFlow, certStatus, grossMargin, isOverdue, leaveBalance, monthlyMargin, OPEN_STAGES, pipelineValue, projectProgress, proposalTotal, utilisation, weightedPipeline, winLoss } from '../../data/workSelectors'
import { addDays, addMonths, formatDate, monthLabel, monthRange, timeAgo, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, sumMinor, toMajorForDisplay } from '../../lib/money'
import { cn } from '../../lib/utils'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ButtonLink } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/Progress'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import { canSeeNotification } from '../auth/permissions'
import { useApprovalQueues } from '../approvals/useApprovalQueues'
import { greeting } from './greeting'

// ---------------- shared widgets ----------------

function firstName(name: string) {
  return name.split(' ')[0]
}

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-brand-700 hover:text-brand-800">
      {label}
    </Link>
  )
}

function ApprovalsCard({ title = 'Waiting for your approval' }: { title?: string }) {
  const q = useApprovalQueues()
  const items: Array<[string, number, string]> = [
    ['Projects & contracts', q.mine.projects, '/approvals?tab=projects'],
    ['Purchases & capital', q.mine.purchases, '/approvals?tab=purchases'],
    ['Change requests', q.mine.changes, '/approvals?tab=changes'],
    ['Leave requests', q.mine.leave, '/approvals?tab=leave'],
    ['Expense claims', q.mine.claims, '/approvals?tab=claims'],
  ]
  const shown = items.filter(([, n]) => n > 0)
  return (
    <Card>
      <CardHeader title={title} actions={<ViewAll to="/approvals" label="Open approvals" />} />
      {shown.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nothing waiting for you" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map(([label, n, to]) => (
            <li key={label}>
              <Link to={to} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                <span className="font-medium text-slate-800">{label}</span>
                <span className="tabular rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-ink-950">{n}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Announcements({ limit = 5 }: { limit?: number }) {
  const { state, perms } = useData()
  const notes = state.notifications.filter((n) => canSeeNotification(perms, n)).slice(0, limit)
  return (
    <Card>
      <CardHeader title="Notifications & announcements" />
      {notes.length === 0 ? (
        <EmptyState title="You’re all caught up" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {notes.map((n) => (
            <li key={n.id} className="px-5 py-3">
              {n.link ? (
                <Link to={n.link} className="block text-sm font-medium text-slate-800 hover:text-brand-700">
                  {n.title}
                </Link>
              ) : (
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
              )}
              <p className="text-xs text-slate-500">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ListCard<T>({ title, description, rows, render, empty, action }: { title: string; description?: string; rows: T[]; render: (r: T) => ReactNode; empty: string; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} actions={action} />
      {rows.length === 0 ? <EmptyState title={empty} /> : <ul className="divide-y divide-slate-100">{rows.map(render)}</ul>}
    </Card>
  )
}

function Row({ to, title, sub, right }: { to?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">{title}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </>
  )
  return (
    <li>
      {to ? (
        <Link to={to} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
          {body}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 px-5 py-3">{body}</div>
      )}
    </li>
  )
}

// ---------------- CEO / MD (main admin) ----------------

export function CeoDashboard() {
  const { state, user } = useData()
  const today = todayISO()
  const months = monthRange(addMonths(today, -11), today)
  const fy = budgetSummary(state, today).fyStart
  const gmYtd = grossMargin(state, fy, today)
  const prevYtd = grossMargin(state, addMonths(fy, -12), addMonths(today, -12))
  const dataStart = state.invoices.reduce((min, i) => (i.issueDate < min ? i.issueDate : min), today)
  const revTrend = prevYtd.revenue && dataStart <= addMonths(fy, -12) ? ((gmYtd.revenue - prevYtd.revenue) / prevYtd.revenue) * 100 : undefined
  const flow = cashFlow(state, months)
  const margin = monthlyMargin(state, months).map((m) => ({ month: monthLabel(m.month), Revenue: toMajorForDisplay(m.revenue), 'Gross profit': toMajorForDisplay(m.grossProfit), 'Margin %': Math.round(m.marginPct * 10) / 10 }))
  const opps = state.opportunities
  const wl = winLoss(opps, addDays(today, -365))
  const activeProjects = state.projects.filter((p) => p.status === 'Active' || p.status === 'Planning' || p.status === 'On hold')
  const headcount = activeHeadcount(state.employees)
  const newHires = state.employees.filter((e) => e.joinDate >= addDays(today, -90)).length
  const stockValue = sumMinor(state.inventory.map(itemValue))
  const assetValue = sumMinor(state.assets.filter((a) => a.status !== 'Retired').map((a) => a.costMinor))
  const lowStock = state.inventory.filter((i) => stockStatus(i) !== 'In Stock').length
  const partnersDue = state.partners.filter((p) => p.status !== 'Active')
  const stageRows = OPEN_STAGES.map((s) => ({ stage: s, value: toMajorForDisplay(sumMinor(opps.filter((o) => o.stage === s).map((o) => o.valueMinor))) }))
  const byDept = state.departments.map((d) => ({ d, n: state.employees.filter((e) => e.departmentId === d.id && e.status !== 'Inactive').length })).sort((a, b) => b.n - a.n)
  const maxDept = Math.max(...byDept.map((x) => x.n))
  const onLeave = state.leaveRequests.filter((l) => l.status === 'Approved' && l.startDate <= today && l.endDate >= today).length
  const vacancies = state.jobOpenings.filter((j) => j.status !== 'Filled').reduce((s, j) => s + j.openings, 0)
  const last = flow[flow.length - 1]

  return (
    <>
      <PageHeader title="Executive overview" description={`${greeting()}, ${firstName(user.name)}. Company performance, pipeline, projects and the decisions waiting for you.`} meta={<Badge tone="brand">CEO / MD</Badge>} actions={<ButtonLink to="/approvals" icon={<ClipboardCheck className="size-4" />}>Final approvals</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (fiscal YTD)" value={formatMoneyCompact(gmYtd.revenue)} trend={revTrend} hint={revTrend === undefined ? `${formatMoneyCompact(sumMinor(state.invoices.filter((i) => i.status === "Paid" && (i.paidDate ?? "") >= fy).map(invoiceTotal)))} collected` : "vs same period last year"} icon={<TrendingUp className="size-5" />} to="/finance" />
        <StatCard label="Gross margin (YTD)" value={`${gmYtd.marginPct.toFixed(1)}%`} hint={`${formatMoneyCompact(gmYtd.grossProfit)} gross profit`} icon={<Gauge className="size-5" />} tone="emerald" to="/finance?tab=revenue" />
        <StatCard label="Cash position (est.)" value={formatMoneyCompact(last.closing)} hint={`${last.net >= 0 ? '+' : ''}${formatMoneyCompact(last.net)} this month`} icon={<Wallet className="size-5" />} tone="purple" to="/finance?tab=cashflow" />
        <StatCard label="Sales pipeline" value={formatMoneyCompact(pipelineValue(opps))} hint={`${formatMoneyCompact(weightedPipeline(opps))} weighted · ${Math.round(wl.winRate * 100)}% win rate`} icon={<Target className="size-5" />} tone="amber" to="/sales" />
        <StatCard label="Staff" value={headcount} hint={`${newHires} new in 90 days · ${onLeave} on leave today`} icon={<Users className="size-5" />} to="/hr" />
        <StatCard label="Active projects" value={activeProjects.length} hint={`${formatMoneyCompact(sumMinor(activeProjects.map((p) => p.contractValueMinor)))} contract value`} icon={<FolderKanban className="size-5" />} tone="emerald" to="/projects" />
        <StatCard label="Inventory & assets" value={formatMoneyCompact(stockValue + assetValue)} hint={`${formatMoneyCompact(stockValue)} stock · ${lowStock} lines low`} icon={<Boxes className="size-5" />} tone="purple" to="/inventory" />
        <StatCard label="OEM & partners" value={state.partners.length} hint={`${partnersDue.length} renewal due or lapsed`} icon={<Handshake className="size-5" />} tone="amber" to="/admin?tab=partners" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue, gross profit and margin" description="Last 12 months · invoiced revenue less cost of sales" />
          <CardBody>
            <div className="h-72" role="img" aria-label="Revenue and gross margin chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={margin} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" {...AXIS_PROPS} />
                  <YAxis yAxisId="m" {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={70} />
                  <YAxis yAxisId="p" orientation="right" {...AXIS_PROPS} unit="%" width={44} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="m" dataKey="Revenue" fill="#e7d9a8" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar yAxisId="m" dataKey="Gross profit" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line yAxisId="p" dataKey="Margin %" stroke="#0d9488" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
        <ApprovalsCard title="Final approvals waiting for you" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Current projects" description="Progress from completed task effort" actions={<ViewAll to="/projects" />} />
          <ul className="divide-y divide-slate-100">
            {activeProjects
              .sort((a, b) => b.contractValueMinor - a.contractValueMinor)
              .slice(0, 6)
              .map((p) => {
                const pct = projectProgress(p, state.tasks)
                return (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_8rem_6rem_auto]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                        <span className="block truncate text-xs text-slate-500">{p.clientName} · {departmentName(state, p.departmentId)}</span>
                      </span>
                      <span className="hidden sm:block"><ProgressBar value={pct} label="Progress" /><span className="text-xs text-slate-500">{pct}%</span></span>
                      <span className="tabular hidden text-right text-sm text-slate-700 sm:block">{formatMoneyCompact(p.contractValueMinor)}</span>
                      <StatusBadge status={p.status === 'Active' ? p.health : p.status} />
                    </Link>
                  </li>
                )
              })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Cash flow" description="Estimated closing cash by month" actions={<ViewAll to="/finance?tab=cashflow" label="Details" />} />
          <CardBody>
            <div className="h-56" role="img" aria-label="Closing cash chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flow.map((f) => ({ month: monthLabel(f.month), 'Net cash': toMajorForDisplay(f.net), 'Closing cash': toMajorForDisplay(f.closing) }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" {...AXIS_PROPS} interval={2} />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={64} />
                  <Tooltip content={<ChartTooltip money />} />
                  <Bar dataKey="Net cash" fill="#d4d4d8" maxBarSize={14} />
                  <Line dataKey="Closing cash" stroke="var(--brand-600)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline by stage" description={`${opps.filter((o) => OPEN_STAGES.includes(o.stage)).length} open opportunities`} actions={<ViewAll to="/sales" />} />
          <CardBody>
            <div className="h-48" role="img" aria-label="Pipeline by stage">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageRows} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" {...AXIS_PROPS} width={104} />
                  <Tooltip content={<ChartTooltip money />} />
                  <Bar dataKey="value" name="Value" fill="var(--brand-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">Won in the last 12 months: {formatMoneyCompact(wl.wonValue)} ({wl.won.length} deals)</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Staff information" actions={<ViewAll to="/hr" />} />
          <CardBody className="space-y-2.5">
            {byDept.map(({ d, n }) => (
              <div key={d.id} className="text-sm">
                <div className="flex justify-between"><span className="truncate text-slate-700">{d.name}</span><span className="tabular text-slate-500">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-ink-900" style={{ width: `${(n / maxDept) * 100}%` }} /></div>
              </div>
            ))}
            <p className="pt-1 text-xs text-slate-500">{vacancies} open vacancies · {onLeave} on leave today</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="OEM & partner information" actions={<ViewAll to="/admin?tab=partners" />} />
          <ul className="divide-y divide-slate-100">
            {state.partners.slice(0, 7).map((p) => {
              const pipe = sumMinor(opps.filter((o) => o.oem === p.name && OPEN_STAGES.includes(o.stage)).map((o) => o.valueMinor))
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">{p.type} · {pipe ? `${formatMoneyCompact(pipe)} pipeline` : p.focus}</span>
                  </span>
                  <StatusBadge status={p.status} />
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">All figures are generated from fictional demonstration data. Finance figures are illustrative summaries, not audited accounts.</p>
    </>
  )
}

// ---------------- Secondary admin ----------------

export function AdminDashboard() {
  const { state, user } = useData()
  const today = todayISO()
  const renewals = state.licences.filter((l) => l.status !== 'Cancelled' && l.renewalDate <= addDays(today, 45)).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate))
  const lastBackup = state.backups.find((b) => b.status === 'Completed')
  const itAssets = state.assets.filter((a) => ['Laptop', 'Monitor', 'Phone', 'Printer', 'Test Equipment'].includes(a.category))
  return (
    <>
      <PageHeader title="System administration" description={`${greeting()}, ${firstName(user.name)}. Accounts, registries, licences, integrations and system health.`} meta={<Badge tone="brand">Secondary admin</Badge>} actions={<ButtonLink to="/admin?tab=users" icon={<UserPlus className="size-4" />}>Create account</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="User accounts" value={state.users.filter((u) => u.status === 'Active').length} hint={`${state.users.filter((u) => u.status !== 'Active').length} suspended`} icon={<Users className="size-5" />} to="/admin?tab=users" />
        <StatCard label="Licence renewals (45 days)" value={renewals.length} hint="including expired" icon={<KeyRound className="size-5" />} tone="amber" to="/admin?tab=licences" />
        <StatCard label="Integrations connected" value={`${state.integrations.filter((i) => i.connected).length} / ${state.integrations.length}`} hint="simulated in the demo" icon={<Plug className="size-5" />} tone="purple" to="/admin?tab=integrations" />
        <StatCard label="Last backup" value={lastBackup ? timeAgo(lastBackup.at) : '—'} hint={`${state.backups.filter((b) => b.status === 'Failed').length} failed this week`} icon={<Database className="size-5" />} tone="emerald" to="/admin?tab=backups" />
        <StatCard label="Vendors pending review" value={state.suppliers.filter((s) => s.registration === 'Pending review').length} icon={<Building2 className="size-5" />} to="/admin?tab=vendors" />
        <StatCard label="Partner renewals" value={state.partners.filter((p) => p.status !== 'Active').length} hint="due or lapsed" icon={<Handshake className="size-5" />} tone="amber" to="/admin?tab=partners" />
        <StatCard label="IT assets" value={itAssets.length} hint={`${itAssets.filter((a) => a.status === 'Under Repair').length} under repair`} icon={<Laptop className="size-5" />} tone="purple" to="/admin?tab=itassets" />
        <StatCard label="Security" value={state.securityPolicy.mfaRequired ? 'MFA on' : 'MFA off'} hint={`${state.securityPolicy.sessionTimeoutMinutes}-min sessions`} icon={<ShieldCheck className="size-5" />} tone={state.securityPolicy.mfaRequired ? 'emerald' : 'rose'} to="/admin?tab=security" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListCard
          title="Licence renewals"
          rows={renewals.slice(0, 6)}
          empty="No renewals due"
          action={<ViewAll to="/admin?tab=licences" />}
          render={(l) => <Row key={l.id} to="/admin?tab=licences" title={l.product} sub={`${l.vendor} · ${formatMoney(l.costPerPeriodMinor)} per ${l.billing === 'Monthly' ? 'month' : 'year'}`} right={<span className={cn('text-xs', l.renewalDate < today ? 'font-medium text-rose-600' : 'text-amber-700')}>{l.renewalDate < today ? 'Expired' : formatDate(l.renewalDate)}</span>} />}
        />
        <ListCard
          title="Recent audit log"
          rows={state.activity.slice(0, 7)}
          empty="No activity"
          action={<ViewAll to="/admin?tab=audit" />}
          render={(a) => <Row key={a.id} to={a.link} title={`${a.actor} ${a.action}`} sub={timeAgo(a.at)} />}
        />
        <Announcements />
      </div>
    </>
  )
}

// ---------------- Sales ----------------

export function SalesDashboard() {
  const { state, user, perms } = useData()
  const today = todayISO()
  const mine = state.opportunities.filter((o) => o.ownerUserId === user.id)
  const wl = winLoss(mine, addDays(today, -365))
  const closing = mine.filter((o) => OPEN_STAGES.includes(o.stage) && o.expectedClose <= addDays(today, 30)).sort((a, b) => a.expectedClose.localeCompare(b.expectedClose))
  const leads = state.leads.filter((l) => l.ownerUserId === user.id && (l.status === 'New' || l.status === 'Contacted'))
  const tenders = state.tenders.filter((t) => ['Received', 'Bid / no-bid', 'Preparing'].includes(t.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const proposals = state.proposals.filter((p) => p.ownerUserId === user.id && (p.status === 'Draft' || p.status === 'In review'))
  const overdueInv = state.invoices.filter((i) => i.status === 'Overdue')
  return (
    <>
      <PageHeader title="My sales" description={`${greeting()}, ${firstName(user.name)}. Your pipeline, follow-ups, tenders and client payments.`} meta={<Badge tone="brand">{perms.role}</Badge>} actions={<ButtonLink to="/sales?tab=leads" icon={<UserPlus className="size-4" />}>Add lead</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My open pipeline" value={formatMoneyCompact(pipelineValue(mine))} hint={`${mine.filter((o) => OPEN_STAGES.includes(o.stage)).length} deals · ${formatMoneyCompact(weightedPipeline(mine))} weighted`} icon={<Target className="size-5" />} to="/sales?owner=me" />
        <StatCard label="Won (12 months)" value={formatMoneyCompact(wl.wonValue)} hint={`${wl.won.length} deals · ${Math.round(wl.winRate * 100)}% win rate`} icon={<Handshake className="size-5" />} tone="emerald" to="/sales?tab=forecast" />
        <StatCard label="Leads to follow up" value={leads.length} hint="new or contacted" icon={<Users className="size-5" />} tone="purple" to="/sales?tab=leads" />
        <StatCard label="Overdue client invoices" value={overdueInv.length} hint={formatMoneyCompact(sumMinor(overdueInv.map(invoiceTotal)))} icon={<Receipt className="size-5" />} tone="rose" to="/sales?tab=invoices&status=Overdue" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListCard title="Closing in the next 30 days" rows={closing.slice(0, 6)} empty="No deals closing soon" action={<ViewAll to="/sales" />} render={(o) => <Row key={o.id} to="/sales" title={o.name} sub={`${o.clientName} · ${formatDate(o.expectedClose)}`} right={<span className="tabular text-sm font-medium">{formatMoneyCompact(o.valueMinor)}</span>} />} />
        <ListCard title="RFQs, tenders & EOIs due" rows={tenders.slice(0, 6)} empty="Nothing due" action={<ViewAll to="/sales?tab=tenders" />} render={(t) => <Row key={t.id} to="/sales?tab=tenders" title={t.title} sub={`${t.ref} · ${t.issuer}`} right={<span className={cn('text-xs', t.dueDate <= addDays(today, 7) ? 'font-medium text-rose-600' : 'text-slate-500')}>{formatDate(t.dueDate)}</span>} />} />
        <ListCard title="My proposals in progress" rows={proposals} empty="No proposals in progress" action={<ViewAll to="/proposals" />} render={(p) => <Row key={p.id} to={`/proposals/${p.id}`} title={p.title} sub={`${p.code} · due ${formatDate(p.dueDate)} · ${formatMoneyCompact(proposalTotal(p))}`} right={<StatusBadge status={p.status} />} />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ListCard title="Leads to follow up" rows={leads.slice(0, 6)} empty="No leads waiting" action={<ViewAll to="/sales?tab=leads" />} render={(l) => <Row key={l.id} to="/sales?tab=leads" title={l.company} sub={`${l.interest} · ${l.contactName}`} right={<StatusBadge status={l.status} />} />} />
        <Announcements />
      </div>
    </>
  )
}

// ---------------- HR ----------------

export function HRDashboard() {
  const { state, user } = useData()
  const today = todayISO()
  const pendingLeave = state.leaveRequests.filter((l) => l.status === 'Pending')
  const expiring = state.certifications.filter((c) => certStatus(c.expires, today) === 'Expiring soon')
  const h2 = state.appraisals.filter((a) => a.period.startsWith('H2'))
  const openings = state.jobOpenings.filter((j) => j.status !== 'Filled')
  const onboarding = state.lifecycleChecklists.filter((l) => l.items.some((i) => !i.done))
  return (
    <>
      <PageHeader title="People overview" description={`${greeting()}, ${firstName(user.name)}. Headcount, leave, hiring, performance and learning.`} meta={<Badge tone="brand">HR</Badge>} actions={<ButtonLink to="/employees/new" icon={<UserPlus className="size-4" />}>Add employee</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active headcount" value={activeHeadcount(state.employees)} hint={`${state.employees.filter((e) => e.joinDate >= addDays(today, -90)).length} joined in 90 days`} icon={<Users className="size-5" />} to="/hr" />
        <StatCard label="Leave awaiting approval" value={pendingLeave.length} icon={<Plane className="size-5" />} tone="amber" to="/approvals?tab=leave" />
        <StatCard label="Open vacancies" value={openings.reduce((s, j) => s + j.openings, 0)} hint={`${state.candidates.filter((c) => !['Hired', 'Rejected'].includes(c.stage)).length} active candidates`} icon={<Briefcase className="size-5" />} tone="purple" to="/hr?tab=recruitment" />
        <StatCard label="H2 appraisals completed" value={`${h2.filter((a) => a.status === 'Completed').length} / ${h2.length}`} hint={`${h2.filter((a) => a.status === 'Manager review').length} with managers`} icon={<ClipboardCheck className="size-5" />} tone="emerald" to="/hr?tab=performance" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListCard title="Leave requests" rows={pendingLeave.slice(0, 6)} empty="No pending leave" action={<ViewAll to="/approvals?tab=leave" label="Review" />} render={(l) => <Row key={l.id} to="/approvals?tab=leave" title={fullName(state.employees.find((e) => e.id === l.employeeId))} sub={`${l.type} · ${l.days} day(s) from ${formatDate(l.startDate)}`} right={<StatusBadge status="Pending" />} />} />
        <ListCard title="Certifications expiring (60 days)" rows={expiring.slice(0, 6)} empty="Nothing expiring" action={<ViewAll to="/hr?tab=learning" />} render={(c) => <Row key={c.id} to="/hr?tab=learning" title={c.name} sub={fullName(state.employees.find((e) => e.id === c.employeeId))} right={<span className="text-xs text-amber-700">{formatDate(c.expires)}</span>} />} />
        <ListCard title="Onboarding & offboarding" rows={onboarding.slice(0, 6)} empty="Nothing in progress" action={<ViewAll to="/hr?tab=lifecycle" />} render={(l) => <Row key={l.id} to="/hr?tab=lifecycle" title={fullName(state.employees.find((e) => e.id === l.employeeId))} sub={`${l.kind} · ${l.items.filter((i) => i.done).length}/${l.items.length} done`} right={<Badge tone={l.kind === 'Onboarding' ? 'success' : 'warning'}>{l.kind}</Badge>} />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ListCard title="Vacancies" rows={openings} empty="No open vacancies" action={<ViewAll to="/hr?tab=recruitment" />} render={(j) => <Row key={j.id} to="/hr?tab=recruitment" title={j.title} sub={`${departmentName(state, j.departmentId)} · ${state.candidates.filter((c) => c.openingId === j.id).length} candidates`} right={<StatusBadge status={j.status} />} />} />
        <Announcements />
      </div>
    </>
  )
}

// ---------------- Manager (HOD) ----------------

export function ManagerDashboard() {
  const { state, user, perms } = useData()
  const today = todayISO()
  const deptId = perms.user.departmentId
  const projects = state.projects.filter((p) => p.departmentId === deptId && p.status !== 'Completed' && p.status !== 'Rejected')
  const team = state.employees.filter((e) => e.departmentId === deptId && e.status !== 'Inactive' && e.id !== user.employeeId)
  const util = utilisation(state, team.map((e) => e.id), 21, today).filter((u) => u.hours > 0)
  const avgUtil = util.length ? util.reduce((s, u) => s + u.rate, 0) / util.length : 0
  const teamTasks = state.tasks.filter((t) => team.some((e) => e.id === t.assigneeId))
  const overdue = teamTasks.filter((t) => isOverdue(t, today))
  const milestones = projects.flatMap((p) => p.milestones.filter((m) => !m.done).map((m) => ({ m, p }))).sort((a, b) => a.m.dueDate.localeCompare(b.m.dueDate)).slice(0, 6)
  const budget = budgetSummary(state, today).rows.find((r) => r.department.id === deptId)
  const isSales = perms.department?.code === 'SBD'
  return (
    <>
      <PageHeader
        title={`${perms.department?.name ?? 'Team'}`}
        description={`${greeting()}, ${firstName(user.name)}. Team projects, tasks, approvals and performance.`}
        meta={<Badge tone="brand">Manager</Badge>}
        actions={<ButtonLink to={isSales ? '/sales' : '/projects'} icon={isSales ? <Target className="size-4" /> : <FolderKanban className="size-4" />}>{isSales ? 'Sales pipeline' : 'Team projects'}</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSales ? (
          <StatCard label="Team pipeline" value={formatMoneyCompact(pipelineValue(state.opportunities))} hint={`${formatMoneyCompact(weightedPipeline(state.opportunities))} weighted`} icon={<Target className="size-5" />} to="/sales" />
        ) : (
          <StatCard label="Active projects" value={projects.filter((p) => p.status === 'Active').length} hint={`${projects.filter((p) => p.health !== 'On track' && p.status === 'Active').length} at risk or off track`} icon={<FolderKanban className="size-5" />} to="/projects" />
        )}
        <StatCard label="Team utilisation" value={`${Math.round(avgUtil * 100)}%`} hint={`${team.length} people · last 3 weeks`} icon={<Gauge className="size-5" />} tone="emerald" to="/team" />
        <StatCard label="Overdue tasks" value={overdue.length} hint={`${teamTasks.filter((t) => t.status !== 'Done').length} open`} icon={<Clock className="size-5" />} tone="rose" to="/team" />
        <StatCard label="Budget used (FYTD)" value={budget ? `${Math.round(budget.utilisation * 100)}%` : '—'} hint={budget ? `${formatMoneyCompact(budget.spentMinor)} of ${formatMoneyCompact(budget.budgetMinor)}` : undefined} icon={<Wallet className="size-5" />} tone="amber" to="/finance" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={isSales ? 'Deals handed over & proposals' : 'Team projects'} actions={<ViewAll to={isSales ? '/proposals' : '/projects'} />} />
          {isSales ? (
            <ul className="divide-y divide-slate-100">
              {state.proposals.filter((p) => p.status === 'Draft' || p.status === 'In review' || p.status === 'Submitted').slice(0, 6).map((p) => (
                <Row key={p.id} to={`/proposals/${p.id}`} title={p.title} sub={`${p.code} · ${state.users.find((u) => u.id === p.ownerUserId)?.name ?? ''} · due ${formatDate(p.dueDate)}`} right={<StatusBadge status={p.status} />} />
              ))}
            </ul>
          ) : projects.length === 0 ? (
            <EmptyState title="No projects" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => {
                const pct = projectProgress(p, state.tasks)
                return (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_8rem_auto]">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{p.name}</span><span className="block truncate text-xs text-slate-500">{p.clientName} · ends {formatDate(p.endDate)}</span></span>
                      <span className="hidden sm:block"><ProgressBar value={pct} label="Progress" /><span className="text-xs text-slate-500">{pct}%</span></span>
                      <StatusBadge status={p.status === 'Active' ? p.health : p.status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <ApprovalsCard />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListCard title="Upcoming milestones" rows={milestones} empty="No upcoming milestones" render={({ m, p }) => <Row key={m.id} to={`/projects/${p.id}`} title={m.name} sub={p.name} right={<span className={cn('text-xs', m.dueDate < today ? 'font-medium text-rose-600' : 'text-slate-500')}>{formatDate(m.dueDate)}</span>} />} />
        <ListCard title="Overdue team tasks" rows={overdue.slice(0, 6)} empty="Nothing overdue" render={(t) => <Row key={t.id} to={`/projects/${t.projectId}`} title={t.title} sub={fullName(state.employees.find((e) => e.id === t.assigneeId))} right={<span className="text-xs font-medium text-rose-600">{formatDate(t.dueDate)}</span>} />} />
        <Announcements />
      </div>
    </>
  )
}

// ---------------- Staff ----------------

export function StaffDashboard() {
  const { state, user, perms } = useData()
  const today = todayISO()
  const empId = user.employeeId ?? ''
  const me = state.employees.find((e) => e.id === empId)
  const tasks = state.tasks.filter((t) => t.assigneeId === empId && t.status !== 'Done').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const weekStart = addDays(today, -((new Date(today + 'T00:00:00').getDay() + 6) % 7))
  const hours = state.timesheets.filter((t) => t.employeeId === empId && t.date >= weekStart).reduce((s, t) => s + t.hours, 0)
  const bal = leaveBalance(state, empId)
  const claims = state.expenseClaims.filter((c) => c.employeeId === empId && (c.status === 'Pending' || c.status === 'Approved'))
  const myProjects = state.projects.filter((p) => p.memberIds.includes(empId) && p.status !== 'Pending approval' && p.status !== 'Rejected')
  const milestones = myProjects.flatMap((p) => p.milestones.filter((m) => !m.done).map((m) => ({ m, p }))).sort((a, b) => a.m.dueDate.localeCompare(b.m.dueDate)).slice(0, 5)
  const proposals = state.proposals.filter((p) => p.ownerUserId === user.id && p.status !== 'Accepted' && p.status !== 'Declined')
  const assets = state.assets.filter((a) => a.assignedToId === empId)
  return (
    <>
      <PageHeader
        title="My dashboard"
        description={`${greeting()}, ${firstName(user.name)}. ${me?.jobTitle ?? user.title} · ${perms.department?.name ?? ''}`}
        actions={<ButtonLink to="/workspace?tab=timesheets" icon={<Clock className="size-4" />}>Log time</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My open tasks" value={tasks.length} hint={`${tasks.filter((t) => isOverdue(t, today)).length} overdue`} icon={<ListChecks className="size-5" />} to="/workspace" />
        <StatCard label="Hours this week" value={`${hours}h`} hint="of 40h" icon={<Clock className="size-5" />} tone="purple" to="/workspace?tab=timesheets" />
        <StatCard label="Annual leave left" value={`${bal.remaining} days`} hint={bal.pending ? `${bal.pending} pending approval` : `${bal.taken} taken`} icon={<Plane className="size-5" />} tone="emerald" to="/workspace?tab=leave" />
        <StatCard label="Claims in progress" value={claims.length} hint={formatMoney(sumMinor(claims.map((c) => c.amountMinor)))} icon={<Receipt className="size-5" />} tone="amber" to="/workspace?tab=leave" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="My tasks" description="Assigned by your manager" actions={<ViewAll to="/workspace" />} />
          {tasks.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-5" />} title="No open tasks" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.slice(0, 6).map((t) => (
                <Row key={t.id} to="/workspace" title={t.title} sub={state.projects.find((p) => p.id === t.projectId)?.name} right={<span className="flex items-center gap-2"><span className={cn('text-xs', isOverdue(t, today) ? 'font-medium text-rose-600' : 'text-slate-500')}>{formatDate(t.dueDate)}</span><StatusBadge status={t.status} /></span>} />
              ))}
            </ul>
          )}
        </Card>
        <ListCard title="Project milestones" rows={milestones} empty="No upcoming milestones" action={<ViewAll to="/workspace?tab=calendar" label="Calendar" />} render={({ m, p }) => <Row key={m.id} title={m.name} sub={p.name} right={<span className="text-xs text-slate-500">{formatDate(m.dueDate)}</span>} />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {proposals.length > 0 ? (
          <ListCard title="My proposals & quotations" rows={proposals} empty="" action={<ViewAll to="/proposals" />} render={(p) => { const done = p.milestones.filter((m) => m.done).length; return <Row key={p.id} to={`/proposals/${p.id}`} title={p.title} sub={`${done}/${p.milestones.length} milestones · due ${formatDate(p.dueDate)}`} right={<StatusBadge status={p.status} />} /> }} />
        ) : (
          <ListCard title="My certifications" rows={state.certifications.filter((c) => c.employeeId === empId)} empty="None recorded" action={<ViewAll to="/workspace?tab=skills" />} render={(c) => <Row key={c.id} to="/workspace?tab=skills" title={c.name} sub={c.issuer} right={<StatusBadge status={certStatus(c.expires, today)} />} />} />
        )}
        <ListCard title="Assets issued to me" rows={assets} empty="No assets assigned" render={(a) => <Row key={a.id} title={a.name} sub={`${a.tag} · S/N ${a.serialNumber}`} right={<StatusBadge status={a.status} />} />} />
        <Announcements />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink to="/workspace?tab=pay" icon={<FileText className="size-4" />} label="Payslips, tax, pension & HMO" />
        <QuickLink to="/workspace?tab=leave" icon={<CalendarDays className="size-4" />} label="Request leave or submit a claim" />
        <QuickLink to="/workspace?tab=skills" icon={<Award className="size-4" />} label="Update skills & certifications" />
      </div>
    </>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-brand-300 hover:bg-brand-50/30">
      <span className="flex size-8 items-center justify-center rounded-lg bg-ink-900 text-brand-500">{icon}</span>
      {label}
    </Link>
  )
}
