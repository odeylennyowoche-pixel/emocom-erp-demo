import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Download, FileText, Landmark, Receipt, Scale } from 'lucide-react'
import { useData } from '../../data/store'
import { budgetSummary, deriveTransactions, expensesInRange, invoiceTotal, monthlyFinance, revenueInRange } from '../../data/selectors'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { addMonths, formatDate, monthKey, monthLabel, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor, toMajorForDisplay } from '../../lib/money'
import { cn, includesText } from '../../lib/utils'
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus, type Transaction } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { DateRangeInputs, FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import { ExpensesTab } from './ExpensesTab'
import { visibleExpenses } from '../auth/permissions'

type TabKey = 'overview' | 'expenses' | 'invoices' | 'transactions'

export default function FinancePage() {
  const { state, perms } = useData()
  const allowed = perms.financeTabs
  const [tabParam, setTab] = useTabParam<TabKey>(allowed[0] ?? 'expenses')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  const expenseCount = visibleExpenses(perms, state.expenses).length
  const labels: Record<TabKey, { label: string; count?: number }> = {
    overview: { label: 'Overview & budgets' },
    expenses: { label: perms.finance === 'department' ? 'Department expenses' : 'Expenses', count: expenseCount },
    invoices: { label: 'Client invoices', count: state.invoices.length },
    transactions: { label: 'Transactions' },
  }
  return (
    <>
      <PageHeader
        title={perms.finance === 'all' ? 'Finance' : perms.finance === 'department' ? `${perms.department?.name ?? 'Department'} finance` : 'Client invoices'}
        description={
          perms.finance === 'all'
            ? 'Expenses, client invoices, transaction history and departmental budgets.'
            : perms.finance === 'department'
              ? 'Your department’s spending against budget, plus the views your role allows.'
              : 'Read-only view of client invoices and payment status.'
        }
        meta={<span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Demo module — not an accounting system</span>}
      />
      <Card>
        <div className="px-4 pt-1">
          <Tabs
            label="Finance sections"
            active={tab}
            onChange={setTab}
            tabs={allowed.map((k) => ({ key: k, ...labels[k] }))}
          />
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'transactions' && <TransactionsTab />}
      </Card>
    </>
  )
}

function OverviewTab() {
  const { state } = useData()
  const today = todayISO()
  const budget = useMemo(() => budgetSummary(state, today), [state, today])
  const start = budget.fyStart
  const revenue = revenueInRange(state.invoices, start, today)
  const expenses = expensesInRange(state.expenses, start, today)
  const receivable = sumMinor(state.invoices.filter((i) => i.status === 'Sent' || i.status === 'Overdue').map(invoiceTotal))
  const payable = sumMinor(state.expenses.filter((e) => e.status !== 'Paid').map((e) => e.amountMinor))
  const totalBudget = sumMinor(budget.rows.map((r) => r.budgetMinor))
  const totalSpent = sumMinor(budget.rows.map((r) => r.spentMinor))

  const series = monthlyFinance(state, monthKey(addMonths(today, -11)) + '-01', today).map((p) => ({
    month: monthLabel(p.month),
    Revenue: toMajorForDisplay(p.revenueMinor),
    Expenses: toMajorForDisplay(p.expensesMinor),
  }))

  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (fiscal YTD)" value={formatMoneyCompact(revenue)} icon={<ArrowDownLeft className="size-5" />} tone="emerald" hint={`since ${formatDate(start)}`} />
        <StatCard label="Expenses (fiscal YTD)" value={formatMoneyCompact(expenses)} icon={<ArrowUpRight className="size-5" />} tone="purple" hint={`Net ${formatMoneyCompact(revenue - expenses)}`} />
        <StatCard label="Receivables" value={formatMoneyCompact(receivable)} icon={<FileText className="size-5" />} tone="brand" hint="sent + overdue invoices" to="/finance?tab=invoices" />
        <StatCard label="Payables" value={formatMoneyCompact(payable)} icon={<Receipt className="size-5" />} tone="amber" hint="pending + overdue expenses" to="/finance?tab=expenses" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="min-w-0 rounded-xl border border-slate-200 xl:col-span-3">
          <CardHeader title="Monthly cash view" description="Revenue (paid invoices) vs recorded expenses, last 12 months" />
          <CardBody>
            <div className="h-72" role="img" aria-label="Monthly revenue versus expenses for the last 12 months">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={72} />
                  <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#f1f5f9' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Revenue" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="Expenses" fill="#3f3f46" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 xl:col-span-2">
          <CardHeader
            title="Budget utilisation"
            description={`Fiscal year from ${formatDate(budget.fyStart)} · ${budget.monthsElapsed} of 12 months elapsed`}
            actions={
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Scale className="size-3.5" /> {Math.round((totalSpent / Math.max(1, totalBudget)) * 100)}% used
              </span>
            }
          />
          <ul className="divide-y divide-slate-100">
            {budget.rows.map((r) => {
              const pct = Math.round(r.utilisation * 100)
              const over = r.utilisation > r.expectedUtilisation + 0.05
              return (
                <li key={r.department.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-slate-700">{r.department.name}</span>
                    <span className="tabular text-xs text-slate-500">
                      {formatMoneyCompact(r.spentMinor)} / {formatMoneyCompact(r.budgetMinor)}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
                    <div className={cn('h-2 rounded-full', over ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, pct)}%` }} />
                    <span className="absolute -top-0.5 h-3 w-px bg-slate-500" style={{ left: `${r.expectedUtilisation * 100}%` }} title="Expected utilisation to date" aria-hidden />
                  </div>
                  <p className={cn('mt-1 text-xs', over ? 'text-amber-700' : 'text-slate-500')}>
                    {pct}% used{over ? ' · ahead of plan' : ''} · {formatMoneyCompact(r.remainingMinor)} remaining
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="flex items-center gap-1.5 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            <Landmark className="size-3.5" /> The vertical marker shows expected spend to date.
          </p>
        </div>
      </div>
    </div>
  )
}

function InvoicesTab() {
  const { state } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState<InvoiceStatus | ''>('status')
  const [from, setFrom] = useQueryState('from')
  const [to, setTo] = useQueryState('to')

  const rows = useMemo(
    () =>
      state.invoices.filter(
        (i) => (!status || i.status === status) && (!from || i.issueDate >= from) && (!to || i.issueDate <= to) && includesText([i.number, i.customer.name], q),
      ),
    [state.invoices, status, from, to, q],
  )
  const totals = useMemo(() => {
    const t: Record<InvoiceStatus, number> = { Draft: 0, Sent: 0, Paid: 0, Overdue: 0 }
    for (const i of rows) t[i.status] += invoiceTotal(i)
    return t
  }, [rows])

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      sortValue: (i) => i.number,
      render: (i) => (
        <div>
          <p className="font-medium text-slate-900">{i.number}</p>
          <p className="max-w-56 truncate text-xs text-slate-500">{i.customer.name}</p>
        </div>
      ),
    },
    { key: 'issued', header: 'Issued', sortValue: (i) => i.issueDate, render: (i) => <span className="whitespace-nowrap">{formatDate(i.issueDate)}</span>, hideBelow: 'sm' },
    { key: 'due', header: 'Due', sortValue: (i) => i.dueDate, render: (i) => <span className="whitespace-nowrap">{formatDate(i.dueDate)}</span>, hideBelow: 'md' },
    { key: 'paid', header: 'Paid on', sortValue: (i) => i.paidDate ?? '', render: (i) => formatDate(i.paidDate), hideBelow: 'lg' },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (i) => invoiceTotal(i), render: (i) => <span className="font-medium text-slate-900">{formatMoney(invoiceTotal(i))}</span> },
    { key: 'status', header: 'Status', sortValue: (i) => i.status, render: (i) => <StatusBadge status={i.status} /> },
  ]

  const exportCsv = () =>
    downloadCsv(`invoices-${todayISO()}`, rows, [
      { header: 'Invoice number', value: (i) => i.number },
      { header: 'Customer', value: (i) => i.customer.name },
      { header: 'Issue date', value: (i) => i.issueDate },
      { header: 'Due date', value: (i) => i.dueDate },
      { header: 'Paid date', value: (i) => i.paidDate },
      { header: 'Amount', value: (i) => minorToInput(invoiceTotal(i)) },
      { header: 'Status', value: (i) => i.status },
    ])

  return (
    <>
      <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
        {INVOICE_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? '' : s)} aria-pressed={status === s} className={cn('bg-white px-4 py-3 text-left hover:bg-slate-50', status === s && 'bg-brand-50/60')}>
            <StatusBadge status={s} />
            <span className="tabular mt-1 block text-base font-semibold text-slate-900">{formatMoneyCompact(totals[s])}</span>
          </button>
        ))}
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search invoice number or customer…" label="Search invoices" />
        <FilterSelect label="Filter by invoice status" value={status} onChange={setStatus} options={INVOICE_STATUSES} allLabel="All statuses" />
        <DateRangeInputs from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <Button variant="secondary" size="sm" className="sm:ml-auto" icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        rowLabel={(i) => `Open invoice ${i.number}`}
        onRowClick={(i) => navigate(`/finance/invoices/${i.id}`)}
        initialSort={{ key: 'issued', dir: 'desc' }}
        resetKey={`${q}|${status}|${from}|${to}`}
      />
    </>
  )
}

function TransactionsTab() {
  const { state } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [direction, setDirection] = useQueryState<'In' | 'Out' | ''>('direction')
  const [category, setCategory] = useQueryState('category')
  const [from, setFrom] = useQueryState('from')
  const [to, setTo] = useQueryState('to')
  const all = useMemo(() => deriveTransactions(state), [state])
  const categories = useMemo(() => [...new Set(all.map((t) => t.category))].sort(), [all])
  const rows = useMemo(
    () =>
      all.filter(
        (t) =>
          (!direction || t.direction === direction) &&
          (!category || t.category === category) &&
          (!from || t.date >= from) &&
          (!to || t.date <= to) &&
          includesText([t.description, t.counterparty, t.reference], q),
      ),
    [all, direction, category, from, to, q],
  )
  const moneyIn = sumMinor(rows.filter((t) => t.direction === 'In').map((t) => t.amountMinor))
  const moneyOut = sumMinor(rows.filter((t) => t.direction === 'Out').map((t) => t.amountMinor))

  const columns: Column<Transaction>[] = [
    { key: 'date', header: 'Date', sortValue: (t) => t.date, render: (t) => <span className="whitespace-nowrap">{formatDate(t.date)}</span> },
    {
      key: 'desc',
      header: 'Description',
      sortValue: (t) => t.description,
      render: (t) => (
        <div className="min-w-0">
          <p className="max-w-80 truncate font-medium text-slate-800">{t.description}</p>
          <p className="truncate text-xs text-slate-500">{t.counterparty}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Category', sortValue: (t) => t.category, render: (t) => t.category, hideBelow: 'md' },
    { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-xs">{t.reference}</span>, hideBelow: 'lg' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (t) => (t.direction === 'In' ? t.amountMinor : -t.amountMinor),
      render: (t) => (
        <span className={t.direction === 'In' ? 'font-medium text-emerald-700' : 'font-medium text-slate-800'}>
          {t.direction === 'In' ? '+' : '−'}
          {formatMoney(t.amountMinor)}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-px border-b border-slate-100 bg-slate-100 text-sm">
        <div className="bg-white px-4 py-3">
          <p className="text-slate-500">Money in</p>
          <p className="tabular font-semibold text-emerald-700">{formatMoney(moneyIn)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-slate-500">Money out</p>
          <p className="tabular font-semibold text-slate-800">{formatMoney(moneyOut)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-slate-500">Net</p>
          <p className={cn('tabular font-semibold', moneyIn - moneyOut >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatMoney(moneyIn - moneyOut)}</p>
        </div>
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search description, counterparty…" label="Search transactions" />
        <FilterSelect
          label="Filter by direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'In', label: 'Money in' },
            { value: 'Out', label: 'Money out' },
          ]}
          allLabel="In & out"
        />
        <FilterSelect label="Filter by category" value={category} onChange={setCategory} options={categories} allLabel="All categories" />
        <DateRangeInputs from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <Button
          variant="secondary"
          size="sm"
          className="sm:ml-auto"
          icon={<Download className="size-4" />}
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(`transactions-${todayISO()}`, rows, [
              { header: 'Date', value: (t) => t.date },
              { header: 'Direction', value: (t) => t.direction },
              { header: 'Description', value: (t) => t.description },
              { header: 'Counterparty', value: (t) => t.counterparty },
              { header: 'Category', value: (t) => t.category },
              { header: 'Reference', value: (t) => t.reference },
              { header: 'Amount', value: (t) => minorToInput(t.amountMinor) },
            ])
          }
        >
          Export CSV
        </Button>
      </Toolbar>
      <p className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-500">Derived view: paid invoices (money in) and paid expenses (money out). No bank integration in this demo.</p>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(t) => t.id}
        rowLabel={(t) => `Open source record ${t.reference}`}
        onRowClick={(t) => navigate(t.sourceType === 'Invoice' ? `/finance/invoices/${t.sourceId}` : `/finance?tab=expenses&q=${encodeURIComponent(t.reference)}`)}
        initialSort={{ key: 'date', dir: 'desc' }}
        resetKey={`${q}|${direction}|${category}|${from}|${to}`}
      />
    </>
  )
}
