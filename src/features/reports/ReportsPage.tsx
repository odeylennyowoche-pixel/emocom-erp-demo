import { useMemo, type ReactNode } from 'react'
import { reportDepartmentIds } from '../auth/permissions'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Printer } from 'lucide-react'
import { useData } from '../../data/store'
import { budgetSummary, inventoryAlerts, itemValue, prTotal, stockStatus, supplierName } from '../../data/selectors'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { downloadCsv, type CsvColumn } from '../../lib/csv'
import { formatDate, isWithin, monthLabel, monthRange, parseISODate, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor, toMajorForDisplay } from '../../lib/money'
import { includesText, percent } from '../../lib/utils'
import { EXPENSE_CATEGORIES, INVENTORY_CATEGORIES, PR_STATUSES } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatusBadge } from '../../components/ui/Badge'
import { DateRangeInputs, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, compactMoneyTick, LegendDot } from '../../components/charts/chartKit'

type TabKey = 'employees' | 'inventory' | 'procurement' | 'expenses'

const TAB_LABELS: Record<TabKey, string> = { employees: 'Employee summary', inventory: 'Inventory summary', procurement: 'Procurement summary', expenses: 'Expense summary' }

/** Report data limited to the departments this person may see. */
function useReportState() {
  const { state, perms } = useData()
  return useMemo(() => {
    const ids = new Set(reportDepartmentIds(perms, state))
    return {
      ...state,
      departments: state.departments.filter((d) => ids.has(d.id)),
      employees: state.employees.filter((e) => ids.has(e.departmentId)),
      purchaseRequests: state.purchaseRequests.filter((p) => ids.has(p.departmentId)),
      expenses: state.expenses.filter((e) => ids.has(e.departmentId)),
    }
  }, [state, perms])
}

export default function ReportsPage() {
  const { state, perms } = useData()
  const allowed = perms.reportTabs
  const [tabParam, setTab] = useTabParam<TabKey>(allowed[0] ?? 'employees')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  const today = todayISO()
  const fyStart = budgetSummary(state, today).fyStart
  const [from, setFrom] = useQueryState('from', fyStart)
  const [to, setTo] = useQueryState('to', today)
  const [q, setQ] = useQueryState('q')
  const range = { start: from || '0000-01-01', end: to || '9999-12-31' }

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description={perms.reports === 'all' ? 'Company-wide summaries from the same live data used across all modules.' : `Summaries for ${perms.department?.name ?? 'your department'}, from the same live data used across all modules.`}
        actions={
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Print report
          </Button>
        }
      />
      <Card className="print-area">
        <div className="px-4 pt-1">
          <Tabs
            label="Report type"
            active={tab}
            onChange={setTab}
            tabs={allowed.map((k) => ({ key: k, label: TAB_LABELS[k] }))}
          />
        </div>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Filter table rows…" label="Filter report rows" />
          <DateRangeInputs from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <span className="text-xs text-slate-500 sm:ml-auto">{tab === 'inventory' ? 'Inventory is a current snapshot (date range not applied).' : `Period: ${formatDate(range.start)} – ${formatDate(range.end)}`}</span>
        </Toolbar>
        <div className="hidden px-5 pt-4 print:block">
          <p className="text-lg font-semibold">
            {state.organization.name} — {TAB_LABELS[tab]}
          </p>
          <p className="text-xs text-slate-500">
            Period {formatDate(range.start)} – {formatDate(range.end)} · generated {formatDate(today)} · demonstration data
          </p>
        </div>
        <div className="space-y-6 p-4 sm:p-5">
          {tab === 'employees' && <EmployeeReport start={range.start} end={range.end} q={q} />}
          {tab === 'inventory' && <InventoryReport q={q} />}
          {tab === 'procurement' && <ProcurementReport start={range.start} end={range.end} q={q} />}
          {tab === 'expenses' && <ExpenseReport start={range.start} end={range.end} q={q} />}
        </div>
      </Card>
    </>
  )
}

// ---------- shared pieces ----------

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

interface ReportColumn<T> extends CsvColumn<T> {
  align?: 'right'
  render?: (row: T) => ReactNode
}

function ReportTable<T>({ title, rows, columns, filename, footer }: { title: string; rows: T[]; columns: ReportColumn<T>[]; filename: string; footer?: Array<ReactNode> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <CardHeader
        title={title}
        description={`${rows.length} row(s)`}
        actions={
          <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadCsv(`${filename}-${todayISO()}`, rows, columns)} disabled={rows.length === 0}>
            CSV
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={`px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No rows match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.header} className={`px-4 py-2.5 text-slate-700 ${c.align === 'right' ? 'tabular text-right' : ''}`}>
                    {c.render ? c.render(r) : c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold text-slate-900">
                {footer.map((f, i) => (
                  <td key={i} className={`px-4 py-2.5 ${i > 0 ? 'tabular text-right' : ''}`}>
                    {f}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ---------- Employees ----------

function EmployeeReport({ start, end, q }: { start: string; end: string; q: string }) {
  const state = useReportState()
  const rows = useMemo(
    () =>
      state.departments
        .map((d) => {
          const emps = state.employees.filter((e) => e.departmentId === d.id)
          return {
            department: d.name,
            active: emps.filter((e) => e.status === 'Active').length,
            onLeave: emps.filter((e) => e.status === 'On Leave').length,
            inactive: emps.filter((e) => e.status === 'Inactive').length,
            total: emps.length,
            newHires: emps.filter((e) => isWithin(e.joinDate, start, end)).length,
            contract: emps.filter((e) => e.employmentType !== 'Full-time').length,
          }
        })
        .filter((r) => includesText([r.department], q)),
    [state, start, end, q],
  )
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + (r[k] as number), 0)
  const types = ['Full-time', 'Contract', 'Intern'].map((t) => ({ name: t, value: state.employees.filter((e) => e.employmentType === t && e.status !== 'Inactive').length }))
  const hires = state.employees.filter((e) => isWithin(e.joinDate, start, end))
  const months = monthRange(start < '2000' ? hires.reduce((m, e) => (e.joinDate < m ? e.joinDate : m), todayISO()) : start, end > todayISO() ? todayISO() : end)
  const hiresByMonth = months.slice(-12).map((m) => ({ month: monthLabel(m), Hires: hires.filter((e) => e.joinDate.startsWith(m)).length }))

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Active headcount" value={sum('active') + sum('onLeave')} hint={`${sum('onLeave')} currently on leave`} />
        <Kpi label="New hires in period" value={sum('newHires')} />
        <Kpi label="Inactive records" value={sum('inactive')} />
        <Kpi label="Non-permanent staff" value={`${percent(sum('contract'), Math.max(1, sum('total')))}%`} hint="contract + intern" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Hires per month (last 12 in range)</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hiresByMonth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="Hires" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 p-4">
          <div className="h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={types} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {types.map((t, i) => (
                    <Cell key={t.name} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-slate-900">Employment type (current staff)</p>
            {types.map((t, i) => (
              <LegendDot key={t.name} color={CHART_COLORS[i]} label={t.name} value={String(t.value)} />
            ))}
          </div>
        </div>
      </div>
      <ReportTable
        title="Headcount by department"
        filename="employee-summary"
        rows={rows}
        columns={[
          { header: 'Department', value: (r) => r.department },
          { header: 'Active', value: (r) => r.active, align: 'right' },
          { header: 'On leave', value: (r) => r.onLeave, align: 'right' },
          { header: 'Inactive', value: (r) => r.inactive, align: 'right' },
          { header: 'Total records', value: (r) => r.total, align: 'right' },
          { header: 'New hires (period)', value: (r) => r.newHires, align: 'right' },
        ]}
        footer={['Total', sum('active'), sum('onLeave'), sum('inactive'), sum('total'), sum('newHires')]}
      />
    </>
  )
}

// ---------- Inventory ----------

function InventoryReport({ q }: { q: string }) {
  const { state } = useData()
  const byCategory = INVENTORY_CATEGORIES.map((c) => {
    const items = state.inventory.filter((i) => i.category === c)
    return {
      category: c,
      lines: items.length,
      units: items.reduce((a, i) => a + i.quantity, 0),
      valueMinor: sumMinor(items.map(itemValue)),
      low: items.filter((i) => stockStatus(i) === 'Low Stock').length,
      out: items.filter((i) => stockStatus(i) === 'Out of Stock').length,
    }
  }).filter((r) => includesText([r.category], q))
  const alerts = inventoryAlerts(state.inventory).filter((i) => includesText([i.name, i.code, i.category, i.location], q))
  const totalValue = sumMinor(byCategory.map((r) => r.valueMinor))
  const assetValue = sumMinor(state.assets.filter((a) => a.status !== 'Retired').map((a) => a.costMinor))
  const chart = byCategory.map((r) => ({ name: r.category, Value: toMajorForDisplay(r.valueMinor) }))

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Stock value" value={formatMoneyCompact(totalValue)} hint="at unit cost" />
        <Kpi label="Stock lines" value={byCategory.reduce((a, r) => a + r.lines, 0)} />
        <Kpi label="Lines on alert" value={alerts.length} hint={`${percent(alerts.length, Math.max(1, state.inventory.length))}% of all lines`} />
        <Kpi label="Fixed assets (cost)" value={formatMoneyCompact(assetValue)} hint={`${state.assets.filter((a) => a.status !== 'Retired').length} assets in service`} />
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Stock value by category</p>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#eef2f7" />
              <XAxis type="number" {...AXIS_PROPS} tickFormatter={compactMoneyTick} />
              <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={120} />
              <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="Value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chart.map((c, i) => (
                  <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ReportTable
        title="Inventory by category"
        filename="inventory-summary"
        rows={byCategory}
        columns={[
          { header: 'Category', value: (r) => r.category },
          { header: 'Lines', value: (r) => r.lines, align: 'right' },
          { header: 'Units on hand', value: (r) => r.units, align: 'right', render: (r) => r.units.toLocaleString() },
          { header: 'Value', value: (r) => minorToInput(r.valueMinor), align: 'right', render: (r) => formatMoney(r.valueMinor) },
          { header: 'Low stock', value: (r) => r.low, align: 'right' },
          { header: 'Out of stock', value: (r) => r.out, align: 'right' },
        ]}
        footer={['Total', byCategory.reduce((a, r) => a + r.lines, 0), byCategory.reduce((a, r) => a + r.units, 0).toLocaleString(), formatMoney(totalValue), byCategory.reduce((a, r) => a + r.low, 0), byCategory.reduce((a, r) => a + r.out, 0)]}
      />
      <ReportTable
        title="Reorder list"
        filename="reorder-list"
        rows={alerts}
        columns={[
          { header: 'Code', value: (i) => i.code },
          { header: 'Item', value: (i) => i.name },
          { header: 'Location', value: (i) => i.location },
          { header: 'On hand', value: (i) => i.quantity, align: 'right' },
          { header: 'Reorder level', value: (i) => i.reorderLevel, align: 'right' },
          { header: 'Preferred supplier', value: (i) => supplierName(state, i.preferredSupplierId) },
          { header: 'Status', value: (i) => stockStatus(i), render: (i) => <StatusBadge status={stockStatus(i)} /> },
        ]}
      />
    </>
  )
}

// ---------- Procurement ----------

function ProcurementReport({ start, end, q }: { start: string; end: string; q: string }) {
  const state = useReportState()
  const inRange = state.purchaseRequests.filter((p) => isWithin(p.createdAt, start, end))
  const byStatus = PR_STATUSES.map((s) => {
    const list = inRange.filter((p) => p.status === s)
    return { status: s, count: list.length, valueMinor: sumMinor(list.map(prTotal)) }
  })
  const decided = inRange.filter((p) => p.history.some((h) => h.status === 'Approved' || h.status === 'Rejected'))
  const approved = decided.filter((p) => p.history.some((h) => h.status === 'Approved'))
  const cycleDays = approved
    .map((p) => {
      const sub = p.history.find((h) => h.status === 'Pending Approval')
      const ok = p.history.find((h) => h.status === 'Approved')
      return sub && ok ? (parseISODate(ok.at).getTime() - parseISODate(sub.at).getTime()) / 86_400_000 : null
    })
    .filter((d): d is number => d !== null)
  const avgCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0

  const bySupplier = state.suppliers
    .map((s) => {
      const list = inRange.filter((p) => p.supplierId === s.id)
      return {
        supplier: s.name,
        requests: list.length,
        approvedMinor: sumMinor(list.filter((p) => p.status === 'Approved' || p.status === 'Received').map(prTotal)),
        receivedMinor: sumMinor(list.filter((p) => p.status === 'Received').map(prTotal)),
        pending: list.filter((p) => p.status === 'Pending Approval').length,
      }
    })
    .filter((r) => r.requests > 0 && includesText([r.supplier], q))
    .sort((a, b) => b.approvedMinor - a.approvedMinor)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Requests raised" value={inRange.length} hint={formatMoneyCompact(sumMinor(inRange.map(prTotal)))} />
        <Kpi label="Approval rate" value={`${percent(approved.length, Math.max(1, decided.length))}%`} hint={`${approved.length} of ${decided.length} decided`} />
        <Kpi label="Avg. approval time" value={`${avgCycle.toFixed(1)} days`} hint="submission → approval" />
        <Kpi label="Awaiting approval" value={byStatus.find((s) => s.status === 'Pending Approval')!.count} hint={formatMoneyCompact(byStatus.find((s) => s.status === 'Pending Approval')!.valueMinor)} />
      </div>
      <ReportTable
        title="Requests by status"
        filename="procurement-by-status"
        rows={byStatus}
        columns={[
          { header: 'Status', value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
          { header: 'Requests', value: (r) => r.count, align: 'right' },
          { header: 'Value', value: (r) => minorToInput(r.valueMinor), align: 'right', render: (r) => formatMoney(r.valueMinor) },
        ]}
        footer={['Total', inRange.length, formatMoney(sumMinor(byStatus.map((s) => s.valueMinor)))]}
      />
      <ReportTable
        title="Spend by supplier"
        filename="procurement-by-supplier"
        rows={bySupplier}
        columns={[
          { header: 'Supplier', value: (r) => r.supplier },
          { header: 'Requests', value: (r) => r.requests, align: 'right' },
          { header: 'Pending', value: (r) => r.pending, align: 'right' },
          { header: 'Approved value', value: (r) => minorToInput(r.approvedMinor), align: 'right', render: (r) => formatMoney(r.approvedMinor) },
          { header: 'Received value', value: (r) => minorToInput(r.receivedMinor), align: 'right', render: (r) => formatMoney(r.receivedMinor) },
        ]}
      />
    </>
  )
}

// ---------- Expenses ----------

function ExpenseReport({ start, end, q }: { start: string; end: string; q: string }) {
  const state = useReportState()
  const inRange = state.expenses.filter((e) => isWithin(e.date, start, end))
  const total = sumMinor(inRange.map((e) => e.amountMinor))
  const byCategory = EXPENSE_CATEGORIES.map((c) => {
    const list = inRange.filter((e) => e.category === c)
    const amount = sumMinor(list.map((e) => e.amountMinor))
    return { category: c, count: list.length, amountMinor: amount, unpaidMinor: sumMinor(list.filter((e) => e.status !== 'Paid').map((e) => e.amountMinor)), share: percent(amount, Math.max(1, total)) }
  })
    .filter((r) => r.count > 0 && includesText([r.category], q))
    .sort((a, b) => b.amountMinor - a.amountMinor)
  const byDept = state.departments
    .map((d) => ({ department: d.name, amountMinor: sumMinor(inRange.filter((e) => e.departmentId === d.id).map((e) => e.amountMinor)), budgetMinor: d.annualBudgetMinor }))
    .filter((r) => includesText([r.department], q))
  const pie = byCategory.map((r) => ({ name: r.category, value: toMajorForDisplay(r.amountMinor) }))
  const unpaid = sumMinor(inRange.filter((e) => e.status !== 'Paid').map((e) => e.amountMinor))

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total expenses" value={formatMoneyCompact(total)} hint={`${inRange.length} records`} />
        <Kpi label="Unpaid" value={formatMoneyCompact(unpaid)} hint="pending + overdue" />
        <Kpi label="Largest category" value={byCategory[0]?.category ?? '—'} hint={byCategory[0] ? `${byCategory[0].share}% of spend` : undefined} />
        <Kpi label="Overdue payables" value={inRange.filter((e) => e.status === 'Overdue').length} hint="records" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row lg:col-span-2">
          <div className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={1.5} stroke="none">
                  {pie.map((p, i) => (
                    <Cell key={p.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip money />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full min-w-0 flex-1 space-y-1.5">
            {byCategory.map((r, i) => (
              <LegendDot key={r.category} color={CHART_COLORS[i % CHART_COLORS.length]} label={r.category} value={`${r.share}%`} />
            ))}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <ReportTable
            title="Expenses by category"
            filename="expenses-by-category"
            rows={byCategory}
            columns={[
              { header: 'Category', value: (r) => r.category },
              { header: 'Records', value: (r) => r.count, align: 'right' },
              { header: 'Amount', value: (r) => minorToInput(r.amountMinor), align: 'right', render: (r) => formatMoney(r.amountMinor) },
              { header: 'Unpaid', value: (r) => minorToInput(r.unpaidMinor), align: 'right', render: (r) => formatMoney(r.unpaidMinor) },
              { header: 'Share', value: (r) => `${r.share}%`, align: 'right' },
            ]}
            footer={['Total', inRange.length, formatMoney(total), formatMoney(unpaid), '100%']}
          />
        </div>
      </div>
      <ReportTable
        title="Expenses by department"
        filename="expenses-by-department"
        rows={byDept}
        columns={[
          { header: 'Department', value: (r) => r.department },
          { header: 'Spend in period', value: (r) => minorToInput(r.amountMinor), align: 'right', render: (r) => formatMoney(r.amountMinor) },
          { header: 'Annual budget', value: (r) => minorToInput(r.budgetMinor), align: 'right', render: (r) => formatMoney(r.budgetMinor) },
          { header: '% of annual budget', value: (r) => `${percent(r.amountMinor, Math.max(1, r.budgetMinor))}%`, align: 'right' },
        ]}
      />
    </>
  )
}
