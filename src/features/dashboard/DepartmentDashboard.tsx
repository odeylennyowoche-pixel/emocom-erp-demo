import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ClipboardCheck, FileText, Plus, ShoppingCart, Users, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { budgetSummary, fullName, invoiceTotal, prTotal, revenueInRange, employeeById } from '../../data/selectors'
import { addMonths, formatDate, monthKey, monthLabel, monthRange, timeAgo, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, sumMinor, toMajorForDisplay } from '../../lib/money'
import { initials } from '../../lib/utils'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import { canSeeActivity, visibleRequests } from '../auth/permissions'
import { checkTransition } from '../procurement/workflow'
import { greeting } from './greeting'

/** Dashboard for heads of department: their team, spend, requests and approvals. */
export function DepartmentDashboard() {
  const { state, user, perms } = useData()
  const dept = perms.department
  const deptId = user.departmentId
  const today = todayISO()

  const data = useMemo(() => {
    const team = state.employees.filter((e) => e.departmentId === deptId)
    const requests = visibleRequests(perms, state.purchaseRequests)
    const deptRequests = state.purchaseRequests.filter((p) => p.departmentId === deptId)
    const awaiting = state.purchaseRequests.filter((p) => p.status === 'Pending Approval' && checkTransition(p, 'approve', perms).allowed)
    const budget = budgetSummary(state, today).rows.find((r) => r.department.id === deptId)
    const months = monthRange(monthKey(addMonths(today, -5)) + '-01', today)
    const spendByMonth = months.map((m) => ({
      month: monthLabel(m),
      Spend: toMajorForDisplay(sumMinor(state.expenses.filter((e) => e.departmentId === deptId && e.date.startsWith(m)).map((e) => e.amountMinor))),
    }))
    return { team, requests, deptRequests, awaiting, budget, spendByMonth }
  }, [state, perms, deptId, today])

  const isSales = dept?.code === 'SBD'
  const fyStart = budgetSummary(state, today).fyStart
  const salesRevenue = isSales ? revenueInRange(state.invoices, fyStart, today) : 0
  const receivables = isSales ? sumMinor(state.invoices.filter((i) => i.status === 'Sent' || i.status === 'Overdue').map(invoiceTotal)) : 0
  const overdue = isSales ? state.invoices.filter((i) => i.status === 'Overdue') : []

  const open = data.deptRequests.filter((p) => p.status === 'Pending Approval' || p.status === 'Approved')
  const activity = state.activity.filter((a) => canSeeActivity(perms, a)).slice(0, 8)

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} dashboard`}
        description={`${greeting()}, ${user.name.split(' ')[0]}. ${perms.summary}`}
        actions={
          <ButtonLink to="/procurement/requests/new" icon={<Plus className="size-4" />}>
            New request
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Team members"
          value={data.team.filter((e) => e.status !== 'Inactive').length}
          icon={<Users className="size-5" />}
          hint={`${data.team.filter((e) => e.status === 'On Leave').length} on leave`}
          to="/employees"
        />
        <StatCard
          label="Awaiting my approval"
          value={data.awaiting.length}
          icon={<ClipboardCheck className="size-5" />}
          hint={`${formatMoneyCompact(sumMinor(data.awaiting.map(prTotal)))} · limit ${perms.approvalScope === 'all' ? 'any dept' : 'own dept'} ≤ ${formatMoneyCompact(perms.approvalLimitMinor)}`}
          tone="amber"
          to="/procurement?awaiting=me"
        />
        {isSales ? (
          <StatCard label="Client revenue (fiscal YTD)" value={formatMoneyCompact(salesRevenue)} icon={<FileText className="size-5" />} hint={`${formatMoneyCompact(receivables)} receivable`} tone="emerald" to="/finance?tab=invoices" />
        ) : (
          <StatCard label="Open requests" value={open.length} icon={<ShoppingCart className="size-5" />} hint={`${formatMoneyCompact(sumMinor(open.map(prTotal)))} pending or approved`} tone="purple" to="/procurement" />
        )}
        <StatCard
          label="Budget used (fiscal YTD)"
          value={data.budget ? `${Math.round(data.budget.utilisation * 100)}%` : '—'}
          icon={<Wallet className="size-5" />}
          hint={data.budget ? `${formatMoneyCompact(data.budget.spentMinor)} of ${formatMoneyCompact(data.budget.budgetMinor)}` : undefined}
          tone={data.budget && data.budget.utilisation > data.budget.expectedUtilisation + 0.05 ? 'rose' : 'brand'}
          to="/finance?tab=expenses"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Awaiting my approval" description="Requests you can approve within your limit" actions={<Link to="/procurement?awaiting=me" className="text-sm font-medium text-brand-700 hover:text-brand-800">View all</Link>} />
          {data.awaiting.length === 0 ? (
            <EmptyState title="Nothing waiting for you" description="New requests from your department will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.awaiting.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/procurement/requests/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {p.code} — {p.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {fullName(employeeById(state, p.requesterId))} · {formatDate(p.createdAt)}
                      </span>
                    </span>
                    <span className="tabular text-sm font-semibold text-slate-900">{formatMoney(prTotal(p))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Department spend" description="Last 6 months" />
          <CardBody>
            <div className="h-56" role="img" aria-label="Department spend by month">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.spendByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={64} />
                  <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#f8f5ec' }} />
                  <Bar dataKey="Spend" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="My team" description={`${data.team.length} people`} actions={<Link to="/employees" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open</Link>} />
          <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
            {data.team.map((e) => (
              <li key={e.id}>
                <Link to={`/employees/${e.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">{initials(fullName(e))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{fullName(e)}</span>
                    <span className="block truncate text-xs text-slate-500">{e.jobTitle}</span>
                  </span>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Department requests" description="Latest purchase requests" actions={<Link to="/procurement" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open</Link>} />
          {data.requests.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...data.requests]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 6)
                .map((p) => (
                  <li key={p.id}>
                    <Link to={`/procurement/requests/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.code}</span>
                        <span className="block truncate text-xs text-slate-500">{p.title}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        {isSales ? (
          <Card>
            <CardHeader title="Overdue client invoices" description="Follow up with these clients" actions={<Link to="/finance?tab=invoices&status=Overdue" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open</Link>} />
            {overdue.length === 0 ? (
              <EmptyState title="No overdue invoices" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {overdue.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <Link to={`/finance/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{i.customer.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {i.number} · due {formatDate(i.dueDate)}
                        </span>
                      </span>
                      <span className="tabular text-sm font-semibold text-rose-700">{formatMoneyCompact(invoiceTotal(i))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Department activity" />
            {activity.length === 0 ? (
              <EmptyState title="No recent activity" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium text-slate-900">{a.actor}</span>{' '}
                      {a.link ? (
                        <Link to={a.link} className="hover:text-brand-700 hover:underline">
                          {a.action}
                        </Link>
                      ) : (
                        a.action
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
