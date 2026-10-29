import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, ClipboardCheck, FileWarning, PackageX, Plus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useData } from '../../data/store'
import {
  activeHeadcount,
  deriveTransactions,
  departmentName,
  expensesInRange,
  inventoryAlerts,
  invoiceTotal,
  monthlyFinance,
  prTotal,
  revenueInRange,
  stockStatus,
} from '../../data/selectors'
import { addDays, DATE_RANGE_OPTIONS, formatDate, monthLabel, parseISODate, resolveRange, timeAgo, todayISO, type DateRangePreset } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, sumMinor, toMajorForDisplay } from '../../lib/money'
import { percent } from '../../lib/utils'
import { useQueryState } from '../../hooks/useQueryState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import { controlClass } from '../../components/ui/Form'
import { canSeeActivity } from '../auth/permissions'
import { greeting } from './greeting'
import { AdminDashboard, CeoDashboard, HRDashboard, ManagerDashboard, SalesDashboard, StaffDashboard } from './RoleDashboards'


function previousRange(start: string, end: string) {
  const days = Math.round((parseISODate(end).getTime() - parseISODate(start).getTime()) / 86_400_000) + 1
  return { start: addDays(start, -days), end: addDays(start, -1) }
}

export function ExecutiveDashboard() {
  const { state, user, perms } = useData()
  const navigate = useNavigate()
  const [preset, setPreset] = useQueryState<DateRangePreset>('range', '6m')
  const today = todayISO()
  const range = resolveRange(preset, today)
  const prev = previousRange(range.start, range.end)

  const metrics = useMemo(() => {
    const revenue = revenueInRange(state.invoices, range.start, range.end)
    const prevRevenue = revenueInRange(state.invoices, prev.start, prev.end)
    const expenses = expensesInRange(state.expenses, range.start, range.end)
    const prevExpenses = expensesInRange(state.expenses, prev.start, prev.end)
    const pending = state.purchaseRequests.filter((p) => p.status === 'Pending Approval')
    const alerts = inventoryAlerts(state.inventory)
    // Only compare when the previous period is fully covered by the dataset.
    const dataStart = state.expenses.reduce((min, e) => (e.date < min ? e.date : min), today)
    const comparable = prev.start >= dataStart.slice(0, 7) + '-01'
    const trend = (cur: number, old: number) => (!comparable || old === 0 ? undefined : ((cur - old) / old) * 100)
    return {
      headcount: activeHeadcount(state.employees),
      onLeave: state.employees.filter((e) => e.status === 'On Leave').length,
      revenue,
      revenueTrend: trend(revenue, prevRevenue),
      expenses,
      expensesTrend: trend(expenses, prevExpenses),
      pending,
      pendingValue: sumMinor(pending.map(prTotal)),
      alerts,
      outOfStock: alerts.filter((a) => stockStatus(a) === 'Out of Stock').length,
    }
  }, [state, range.start, range.end, prev.start, prev.end])

  const series = useMemo(
    () =>
      monthlyFinance(state, range.start, range.end).map((p) => ({
        month: monthLabel(p.month),
        Revenue: toMajorForDisplay(p.revenueMinor),
        Expenses: toMajorForDisplay(p.expensesMinor),
        Net: toMajorForDisplay(p.revenueMinor - p.expensesMinor),
      })),
    [state, range.start, range.end],
  )

  const deptSpend = useMemo(() => {
    return state.departments
      .map((d) => ({
        name: d.name,
        value: expensesInRange(state.expenses.filter((e) => e.departmentId === d.id), range.start, range.end),
      }))
      .sort((a, b) => b.value - a.value)
  }, [state, range.start, range.end])

  const headcountByDept = useMemo(
    () =>
      state.departments.map((d) => {
        const emps = state.employees.filter((e) => e.departmentId === d.id)
        return { name: d.code, full: d.name, Active: emps.filter((e) => e.status === 'Active').length, 'On Leave': emps.filter((e) => e.status === 'On Leave').length }
      }),
    [state],
  )

  const transactions = useMemo(() => deriveTransactions(state).slice(0, 7), [state])
  const overdueInvoices = state.invoices.filter((i) => i.status === 'Overdue')
  const net = metrics.revenue - metrics.expenses
  const rangeLabel = DATE_RANGE_OPTIONS.find((o) => o.value === preset)?.label ?? ''

  return (
    <>
      <PageHeader
        title="Finance dashboard"
        description={`${greeting()}, ${user.name.split(' ')[0]}. Here is how ${state.organization.shortName} is performing — ${formatDate(range.start)} to ${formatDate(range.end)}.`}
        actions={
          <>
            <label className="sr-only" htmlFor="range">
              Date range
            </label>
            <select id="range" value={preset} onChange={(e) => setPreset(e.target.value as DateRangePreset)} className={controlClass(false, 'h-9.5 w-auto pr-8')}>
              {DATE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ButtonLink to="/finance?tab=purchasing" icon={<Plus className="size-4" />}>
              Purchasing
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total employees" value={metrics.headcount.toLocaleString()} icon={<Users className="size-5" />} hint={`${metrics.onLeave} on leave`} to="/employees" />
        <StatCard
          label={`Revenue · ${rangeLabel.toLowerCase()}`}
          value={formatMoneyCompact(metrics.revenue)}
          icon={<TrendingUp className="size-5" />}
          trend={metrics.revenueTrend}
          hint="vs previous period"
          tone="emerald"
          to="/finance"
        />
        <StatCard
          label={`Expenses · ${rangeLabel.toLowerCase()}`}
          value={formatMoneyCompact(metrics.expenses)}
          icon={<TrendingDown className="size-5" />}
          trend={metrics.expensesTrend}
          invertTrend
          hint="vs previous period"
          tone="purple"
          to="/finance?tab=payables"
        />
        <StatCard
          label="Pending approvals (company)"
          value={metrics.pending.length}
          icon={<ClipboardCheck className="size-5" />}
          hint={`${formatMoneyCompact(metrics.pendingValue)} awaiting decision`}
          tone="amber"
          to="/procurement?awaiting=me"
        />
        <StatCard
          label="Inventory alerts"
          value={metrics.alerts.length}
          icon={<PackageX className="size-5" />}
          hint={`${metrics.outOfStock} out of stock`}
          tone="rose"
          to="/inventory?stock=alerts"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue vs expenses"
            description={
              <>
                Net position for the period:{' '}
                <span className={net >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{formatMoney(net)}</span>
              </>
            }
          />
          <CardBody>
            <div className="h-72" role="img" aria-label={`Monthly revenue and expenses chart, ${rangeLabel}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={72} />
                  <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#f1f5f9' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Revenue" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Expenses" fill="#3f3f46" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="Net" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Spend by department" description={rangeLabel} actions={<Link to="/reports?tab=expenses" className="text-sm font-medium text-brand-700 hover:text-brand-800">Details</Link>} />
          <CardBody>
            <ul className="space-y-3">
              {deptSpend.map((d, i) => {
                const max = deptSpend[0]?.value || 1
                return (
                  <li key={d.name}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-600">{d.name}</span>
                      <span className="tabular font-medium text-slate-900">{formatMoneyCompact(d.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent transactions" description="Payments received and expenses paid" actions={<Link to="/finance?tab=ledger" className="text-sm font-medium text-brand-700 hover:text-brand-800">View all</Link>} />
          {transactions.length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => navigate(t.sourceType === 'Invoice' ? `/finance/invoices/${t.sourceId}` : `/finance?tab=payables&q=${encodeURIComponent(t.reference)}`)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                  >
                    <span className={t.direction === 'In' ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600' : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600'}>
                      {t.direction === 'In' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{t.description}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {t.counterparty} · {t.category} · {formatDate(t.date)}
                      </span>
                    </span>
                    <span className={t.direction === 'In' ? 'tabular text-sm font-semibold text-emerald-700' : 'tabular text-sm font-semibold text-slate-800'}>
                      {t.direction === 'In' ? '+' : '−'}
                      {formatMoney(t.amountMinor)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Needs attention" description="Items waiting on a decision or action" />
          <ul className="divide-y divide-slate-100">
            {metrics.pending.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link to={`/procurement/requests/${p.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                  <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">Approve {p.code}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.title} · {departmentName(state, p.departmentId)}
                    </span>
                  </span>
                  <span className="tabular text-xs font-medium text-slate-700">{formatMoneyCompact(prTotal(p))}</span>
                </Link>
              </li>
            ))}
            {metrics.alerts.slice(0, 3).map((i) => (
              <li key={i.id}>
                <Link to={`/inventory/items/${i.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">Restock {i.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {i.quantity} left · reorder at {i.reorderLevel}
                    </span>
                  </span>
                  <StatusBadge status={stockStatus(i)} />
                </Link>
              </li>
            ))}
            {overdueInvoices.slice(0, 2).map((inv) => (
              <li key={inv.id}>
                <Link to={`/finance/invoices/${inv.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                  <FileWarning className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">Follow up {inv.number}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {inv.customer.name} · due {formatDate(inv.dueDate)}
                    </span>
                  </span>
                  <span className="tabular text-xs font-medium text-slate-700">{formatMoneyCompact(invoiceTotal(inv))}</span>
                </Link>
              </li>
            ))}
            {metrics.pending.length + metrics.alerts.length + overdueInvoices.length === 0 && (
              <li>
                <EmptyState title="Nothing needs attention" description="All approvals, stock levels and invoices are in order." />
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Headcount by department" description={`${metrics.headcount} active employees across ${state.departments.length} departments`} />
          <CardBody>
            <div className="h-64" role="img" aria-label="Headcount by department chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headcountByDept} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="name" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} />
                  <Tooltip
                    content={<ChartTooltip labelFormatter={(code) => state.departments.find((d) => d.code === code)?.name ?? code} />}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Active" stackId="a" fill="var(--brand-600)" maxBarSize={36} />
                  <Bar dataKey="On Leave" stackId="a" fill="#a1a1aa" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          <ul className="max-h-[19rem] divide-y divide-slate-100 overflow-y-auto">
            {state.activity.filter((a) => canSeeActivity(perms, a)).slice(0, 10).map((a) => (
              <li key={a.id} className="px-5 py-3">
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">{a.actor}</span>{' '}
                  {a.link ? (
                    <Link to={a.link} className="hover:text-brand-700 hover:underline">
                      {a.action}
                    </Link>
                  ) : (
                    a.action
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{timeAgo(a.at)}</p>
              </li>
            ))}
            {state.activity.length === 0 && <EmptyState title="No activity yet" />}
          </ul>
          <div className="border-t border-slate-100 px-5 py-2.5 text-right">
            <Link to="/reports" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              Open reports <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">
        Figures are generated from fictional demonstration data ({percent(metrics.alerts.length, state.inventory.length)}% of stock lines on alert).
      </p>
    </>
  )
}

/** Each person lands on the dashboard that matches their access. */
export default function DashboardPage() {
  const { perms } = useData()
  switch (perms.dashboard) {
    case 'ceo':
      return <CeoDashboard />
    case 'admin':
      return <AdminDashboard />
    case 'finance':
      return <ExecutiveDashboard />
    case 'sales':
      return <SalesDashboard />
    case 'hr':
      return <HRDashboard />
    case 'manager':
      return <ManagerDashboard />
    default:
      return <StaffDashboard />
  }
}
