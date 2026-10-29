/**
 * Finance sections added for EMOCOM's finance account: cash flow, general
 * ledger, receivables aging, revenue recognition, payroll, purchasing
 * (requisition → purchase order → goods received note) and period close.
 * All figures are ILLUSTRATIVE summaries of demo data — not an accounting engine.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, Circle, Download, Lock, Pencil, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { closePeriod, payClaim, saveSalaryGrade, setEmployeeGrade, toggleCloseItem } from '../../data/workActions'
import { departmentName, fullName, prTotal, supplierName } from '../../data/selectors'
import { cashFlow, generalLedger, gradeOf, grossMargin, payrollByDepartment, payslipFor, receivablesAging, revenueRecognition, trialBalance, OPENING_CASH_MINOR, PAY_RULES } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { useQueryState } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { addMonths, formatDate, monthLabel, monthRange, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor, toMajorForDisplay } from '../../lib/money'
import { cn, includesText } from '../../lib/utils'
import type { SalaryGrade } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { FormModal, formValue } from '../../components/ui/FormModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice, ProgressBar } from '../../components/ui/Progress'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'

const ILLUSTRATIVE = 'Illustrative view built from demo invoices and expenses — not a double-entry accounting system.'

// ---------------- Cash flow ----------------

export function CashflowTab() {
  const { state } = useData()
  const today = todayISO()
  const months = monthRange(addMonths(today, -11), today)
  const flow = cashFlow(state, months)
  const gm = grossMargin(state, addMonths(today, -12), today)
  const last = flow[flow.length - 1]
  const avgBurn = sumMinor(flow.slice(-3).map((f) => f.outflow)) / 3
  const data = flow.map((f) => ({ month: monthLabel(f.month), Inflow: toMajorForDisplay(f.inflow), Outflow: toMajorForDisplay(-f.outflow), 'Closing cash': toMajorForDisplay(f.closing) }))
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <Notice>{ILLUSTRATIVE} Opening cash is assumed at {formatMoneyCompact(OPENING_CASH_MINOR)}.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash position (est.)" value={formatMoneyCompact(last.closing)} icon={<Wallet className="size-5" />} />
        <StatCard label="Net cash this month" value={formatMoneyCompact(last.net)} icon={<Wallet className="size-5" />} tone={last.net >= 0 ? 'emerald' : 'rose'} />
        <StatCard label="Avg monthly outflow (3m)" value={formatMoneyCompact(avgBurn)} hint={`${(last.closing / Math.max(1, avgBurn)).toFixed(1)} months of cover`} icon={<Wallet className="size-5" />} tone="amber" />
        <StatCard label="Gross margin (12m)" value={`${gm.marginPct.toFixed(1)}%`} hint={`${formatMoneyCompact(gm.grossProfit)} gross profit`} icon={<Wallet className="size-5" />} tone="purple" />
      </div>
      <Card>
        <CardHeader title="Cash in, cash out and closing balance" description="Receipts from paid invoices; payments from paid expenses" />
        <CardBody>
          <div className="h-80" role="img" aria-label="Cash flow chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={72} />
                <Tooltip content={<ChartTooltip money />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Inflow" stackId="a" fill="var(--brand-500)" maxBarSize={24} />
                <Bar dataKey="Outflow" stackId="a" fill="#3f3f46" maxBarSize={24} />
                <Line dataKey="Closing cash" stroke="#0d9488" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Monthly cash flow statement" />
        <DataTable
          rows={[...flow].reverse()}
          rowKey={(f) => f.month}
          pageSize={12}
          columns={[
            { key: 'm', header: 'Month', render: (f) => monthLabel(f.month) },
            { key: 'in', header: 'Cash in', align: 'right', render: (f) => formatMoney(f.inflow) },
            { key: 'out', header: 'Cash out', align: 'right', render: (f) => formatMoney(f.outflow) },
            { key: 'net', header: 'Net', align: 'right', render: (f) => <span className={f.net < 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatMoney(f.net)}</span> },
            { key: 'c', header: 'Closing', align: 'right', render: (f) => formatMoney(f.closing), hideBelow: 'sm' },
          ]}
        />
      </Card>
    </div>
  )
}

// ---------------- General ledger ----------------

export function LedgerTab({ transactions }: { transactions?: ReactNode }) {
  const { state } = useData()
  const today = todayISO()
  const [range, setRange] = useQueryState<string>('gl', '3m')
  const start = range === '1m' ? addMonths(today, -1) : range === '12m' ? addMonths(today, -12) : addMonths(today, -3)
  const [account, setAccount] = useQueryState('acct')
  const [q, setQ] = useQueryState('q')
  const lines = useMemo(() => generalLedger(state, start, today), [state, start, today])
  const tb = trialBalance(lines)
  const rows = lines.filter((l) => (!account || l.account === account) && includesText([l.reference, l.description], q))
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <Notice>{ILLUSTRATIVE} Entries are generated automatically: invoices debit receivables and credit revenue; receipts move receivables to bank; expenses are accrued to payables and cleared when paid.</Notice>
      <Card>
        <CardHeader
          title="Trial balance"
          description={`${formatDate(start)} – ${formatDate(today)}`}
          actions={
            <FilterSelect label="Period" value={range === '3m' ? '' : range} onChange={(v) => setRange(v || '3m')} allLabel="Last 3 months" options={[{ value: '1m', label: 'Last month' }, { value: '12m', label: 'Last 12 months' }]} />
          }
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2.5 text-left">Account</th>
                <th className="px-4 py-2.5 text-right">Debit</th>
                <th className="px-4 py-2.5 text-right">Credit</th>
                <th className="px-5 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tb.map((r) => (
                <tr key={r.account}>
                  <td className="px-5 py-2.5">
                    <button className="font-medium text-slate-800 hover:text-brand-700 hover:underline" onClick={() => setAccount(r.account)}>{r.account}</button>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(r.debit)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(r.credit)}</td>
                  <td className="tabular px-5 py-2.5 text-right font-medium">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 font-semibold">
                <td className="px-5 py-2.5">Totals</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(sumMinor(tb.map((r) => r.debit)))}</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(sumMinor(tb.map((r) => r.credit)))}</td>
                <td className="px-5 py-2.5 text-right text-xs font-normal text-emerald-700">{sumMinor(tb.map((r) => r.balance)) === 0 ? 'Balanced ✓' : 'Out of balance'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Journal" description={`${rows.length.toLocaleString()} lines`} />
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search reference or description…" />
          <FilterSelect label="Account" value={account} onChange={setAccount} options={tb.map((r) => r.account)} allLabel="All accounts" />
          <Button
            size="sm"
            variant="secondary"
            className="sm:ml-auto"
            icon={<Download className="size-4" />}
            onClick={() =>
              downloadCsv('general-ledger', rows, [
                { header: 'Date', value: (l) => l.date },
                { header: 'Reference', value: (l) => l.reference },
                { header: 'Description', value: (l) => l.description },
                { header: 'Account', value: (l) => l.account },
                { header: 'Debit (NGN)', value: (l) => (l.debit ? minorToInput(l.debit) : '') },
                { header: 'Credit (NGN)', value: (l) => (l.credit ? minorToInput(l.credit) : '') },
              ])
            }
          >
            Export
          </Button>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(l) => l.id}
          resetKey={account + q + range}
          columns={[
            { key: 'd', header: 'Date', render: (l) => <span className="whitespace-nowrap">{formatDate(l.date)}</span> },
            { key: 'r', header: 'Ref', render: (l) => <span className="font-mono text-xs">{l.reference}</span>, hideBelow: 'sm' },
            { key: 'desc', header: 'Description', render: (l) => (<span><span className="block text-slate-800">{l.description}</span><span className="text-xs text-slate-500">{l.account}</span></span>) },
            { key: 'dr', header: 'Debit', align: 'right', render: (l) => (l.debit ? formatMoney(l.debit) : '') },
            { key: 'cr', header: 'Credit', align: 'right', render: (l) => (l.credit ? formatMoney(l.credit) : '') },
          ]}
        />
      </Card>
      {transactions}
    </div>
  )
}

// ---------------- Receivables aging (header above the invoice list) ----------------

export function ReceivablesSummary() {
  const { state } = useData()
  const aging = receivablesAging(state)
  const total = sumMinor(aging.map((a) => a.amountMinor))
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-5 sm:px-5">
      {aging.map((a, i) => (
        <div key={a.label} className={cn('rounded-lg px-3 py-2 ring-1', i >= 3 ? 'bg-rose-50 ring-rose-200' : i >= 1 ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-200')}>
          <p className="text-xs text-slate-600">{a.label}</p>
          <p className="tabular text-base font-semibold text-slate-900">{formatMoneyCompact(a.amountMinor)}</p>
          <p className="text-xs text-slate-500">{a.count} invoice(s) · {total ? Math.round((a.amountMinor / total) * 100) : 0}%</p>
        </div>
      ))}
    </div>
  )
}

// ---------------- Payables: approved staff claims to pay ----------------

export function ClaimsToPay() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const claims = state.expenseClaims.filter((c) => c.status === 'Approved')
  if (!perms.canPayClaims) return null
  return (
    <div className="border-b border-slate-100">
      <CardHeader title="Approved staff claims to pay" description={`${claims.length} claim(s) · ${formatMoney(sumMinor(claims.map((c) => c.amountMinor)))}`} className="border-b-0" />
      {claims.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-slate-500">Nothing to pay.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {claims.slice(0, 6).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-slate-800">{fullName(state.employees.find((e) => e.id === c.employeeId))} — {c.description}</span>
                <span className="text-xs text-slate-500">{c.code} · approved by {c.decidedBy}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular font-medium">{formatMoney(c.amountMinor)}</span>
                <Button size="sm" variant="success" onClick={() => run(() => commit((s) => payClaim(s, c.id)), { title: 'Claim paid', description: c.code })}>Pay</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------- Revenue recognition ----------------

export function RevenueTab() {
  const { state } = useData()
  const rows = revenueRecognition(state.projects)
  const tot = (k: 'recognised' | 'billed' | 'unbilled' | 'deferred') => sumMinor(rows.map((r) => r[k]))
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice>Percentage-of-completion (cost-to-cost): revenue recognised = contract value × cost to date ÷ budget. Billed-to-date figures are illustrative. Replace with EMOCOM’s IFRS 15 policy before use.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue recognised" value={formatMoneyCompact(tot('recognised'))} icon={<Wallet className="size-5" />} />
        <StatCard label="Billed to date" value={formatMoneyCompact(tot('billed'))} icon={<Wallet className="size-5" />} tone="purple" />
        <StatCard label="Unbilled (contract asset)" value={formatMoneyCompact(tot('unbilled'))} icon={<Wallet className="size-5" />} tone="amber" />
        <StatCard label="Deferred (contract liability)" value={formatMoneyCompact(tot('deferred'))} icon={<Wallet className="size-5" />} tone="rose" />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowKey={(r) => r.project.id}
          initialSort={{ key: 'value', dir: 'desc' }}
          columns={[
            { key: 'p', header: 'Project', render: (r) => (<span><Link to={`/projects/${r.project.id}`} className="block font-medium text-slate-900 hover:underline">{r.project.name}</Link><span className="text-xs text-slate-500">{r.project.code} · {r.project.clientName}</span></span>) },
            { key: 'value', header: 'Contract', align: 'right', sortValue: (r) => r.project.contractValueMinor, render: (r) => formatMoneyCompact(r.project.contractValueMinor) },
            { key: 'pct', header: '% complete', align: 'right', render: (r) => `${Math.round(r.pct * 100)}%`, hideBelow: 'sm' },
            { key: 'rec', header: 'Recognised', align: 'right', render: (r) => formatMoneyCompact(r.recognised) },
            { key: 'bill', header: 'Billed', align: 'right', render: (r) => formatMoneyCompact(r.billed), hideBelow: 'md' },
            { key: 'gap', header: 'Unbilled / (deferred)', align: 'right', render: (r) => (r.unbilled ? <span className="text-amber-700">{formatMoneyCompact(r.unbilled)}</span> : r.deferred ? <span className="text-rose-700">({formatMoneyCompact(r.deferred)})</span> : '—'), hideBelow: 'md' },
          ]}
        />
      </Card>
    </div>
  )
}

// ---------------- Payroll ----------------

export function PayrollTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [editing, setEditing] = useState<SalaryGrade | null>(null)
  const [q, setQ] = useState('')
  const byDept = payrollByDepartment(state)
  const totals = { gross: sumMinor(byDept.map((d) => d.gross)), net: sumMinor(byDept.map((d) => d.net)), ded: sumMinor(byDept.map((d) => d.deductions)), employer: sumMinor(byDept.map((d) => d.employerPension)) }
  const staff = state.employees.filter((e) => e.status !== 'Inactive' && includesText([fullName(e), e.jobTitle, e.employeeNo], q))
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <Notice tone="warning">Illustrative payroll: pension at {PAY_RULES.pensionEmployee * 100}% employee / {PAY_RULES.pensionEmployer * 100}% employer on basic + housing + transport; income tax shown as a flat {PAY_RULES.illustrativeTaxRate * 100}% estimate, not a PAYE calculation. Real payroll needs validated tax rules.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly gross payroll" value={formatMoneyCompact(totals.gross)} icon={<Wallet className="size-5" />} />
        <StatCard label="Net pay to staff" value={formatMoneyCompact(totals.net)} icon={<Wallet className="size-5" />} tone="emerald" />
        <StatCard label="Employee deductions" value={formatMoneyCompact(totals.ded)} icon={<Wallet className="size-5" />} tone="purple" />
        <StatCard label="Employer pension" value={formatMoneyCompact(totals.employer)} icon={<Wallet className="size-5" />} tone="amber" />
      </div>
      <Card>
        <CardHeader title="Salary structure" description="Monthly pay per grade" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2.5 text-left">Grade</th>
                <th className="px-4 py-2.5 text-right">Basic</th>
                <th className="px-4 py-2.5 text-right">Housing</th>
                <th className="px-4 py-2.5 text-right">Transport</th>
                <th className="px-4 py-2.5 text-right">Other</th>
                <th className="px-4 py-2.5 text-right">Gross</th>
                <th className="px-4 py-2.5 text-right">Staff</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.salaryGrades.map((g) => (
                <tr key={g.code}>
                  <td className="px-5 py-2.5"><span className="font-medium text-slate-900">{g.code}</span> <span className="text-slate-500">· {g.name}</span></td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(g.basicMinor)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(g.housingMinor)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(g.transportMinor)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(g.otherAllowanceMinor)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-medium">{formatMoney(payslipFor(g)!.gross)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{Object.values(state.employeeGrades).filter((c) => c === g.code).length}</td>
                  <td className="px-4 py-2.5 text-right">{perms.canRunPayroll && <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(g)}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Payroll by department" description="This month" />
          <DataTable
            rows={byDept}
            rowKey={(d) => d.department.id}
            pageSize={10}
            columns={[
              { key: 'd', header: 'Department', render: (d) => d.department.name },
              { key: 'h', header: 'Staff', align: 'right', render: (d) => d.headcount },
              { key: 'g', header: 'Gross', align: 'right', render: (d) => formatMoneyCompact(d.gross) },
              { key: 'n', header: 'Net', align: 'right', render: (d) => formatMoneyCompact(d.net), hideBelow: 'sm' },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Staff grades" description="Assign each employee to a grade" />
          <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search staff…" /></Toolbar>
          <DataTable
            rows={staff}
            rowKey={(e) => e.id}
            pageSize={8}
            resetKey={q}
            columns={[
              { key: 'n', header: 'Employee', render: (e) => (<span><span className="block text-slate-900">{fullName(e)}</span><span className="text-xs text-slate-500">{e.jobTitle} · {departmentName(state, e.departmentId)}</span></span>) },
              {
                key: 'g',
                header: 'Grade',
                render: (e) =>
                  perms.canRunPayroll ? (
                    <select aria-label={`Grade for ${fullName(e)}`} value={state.employeeGrades[e.id] ?? ''} onChange={(ev) => run(() => commit((s) => setEmployeeGrade(s, e.id, ev.target.value)), { title: 'Grade updated' })} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                      {state.salaryGrades.map((g) => (<option key={g.code} value={g.code}>{g.code} · {g.name}</option>))}
                    </select>
                  ) : (
                    state.employeeGrades[e.id]
                  ),
              },
              { key: 'net', header: 'Net pay', align: 'right', render: (e) => formatMoneyCompact(payslipFor(gradeOf(state, e.id))?.net ?? 0), hideBelow: 'sm' },
            ]}
          />
        </Card>
      </div>
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit grade ${editing.code}` : ''}
        fields={[
          { name: 'name', label: 'Grade name', required: true, full: true },
          { name: 'basic', label: 'Basic salary (₦/month)', type: 'money', required: true },
          { name: 'housing', label: 'Housing allowance', type: 'money', required: true },
          { name: 'transport', label: 'Transport allowance', type: 'money', required: true },
          { name: 'other', label: 'Other allowances', type: 'money', required: true },
        ]}
        initial={editing ? { name: editing.name, basic: minorToInput(editing.basicMinor), housing: minorToInput(editing.housingMinor), transport: minorToInput(editing.transportMinor), other: minorToInput(editing.otherAllowanceMinor) } : {}}
        onSubmit={(v) => run(() => commit((s) => saveSalaryGrade(s, { code: editing!.code, name: v.name, basicMinor: formValue.money(v.basic), housingMinor: formValue.money(v.housing), transportMinor: formValue.money(v.transport), otherAllowanceMinor: formValue.money(v.other) })), { title: 'Salary structure updated' })}
      />
    </div>
  )
}

// ---------------- Purchasing: requisition → PO → GRN ----------------

export function PurchasingTab() {
  const { state } = useData()
  const navigate = useNavigate()
  const [stage, setStage] = useQueryState('stage')
  const po = (code: string) => code.replace('PR-', 'PO-')
  const grn = (code: string) => code.replace('PR-', 'GRN-')
  const rows = state.purchaseRequests
    .filter((p) => p.status !== 'Draft')
    .map((p) => {
      const approved = p.history.find((h) => h.status === 'Approved')
      const received = p.history.find((h) => h.status === 'Received')
      const s = p.status === 'Received' ? 'GRN posted' : p.status === 'Approved' ? 'PO issued' : p.status === 'Rejected' ? 'Rejected' : 'Requisition'
      return { p, approved, received, s }
    })
    .filter((r) => !stage || r.s === stage)
  const count = (s: string) => state.purchaseRequests.filter((p) => (s === 'Requisition' ? p.status === 'Pending Approval' : s === 'PO issued' ? p.status === 'Approved' : p.status === 'Received')).length
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Requisition', 'Purchase requisitions awaiting approval'],
          ['PO issued', 'Approved — purchase order sent to supplier'],
          ['GRN posted', 'Goods received note recorded, stock updated'],
        ].map(([s, d], i) => (
          <button key={s} onClick={() => setStage(stage === s ? '' : s)} className={cn('rounded-xl border p-4 text-left transition', stage === s ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Step {i + 1}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{s} <span className="tabular text-slate-400">· {count(s)}</span></p>
            <p className="text-xs text-slate-500">{d}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title="Purchasing register" description="Click a row to open the requisition, approve it, or record the goods received note (GRN)" actions={<Button size="sm" onClick={() => navigate('/procurement/requests/new')}>New requisition</Button>} />
        <DataTable
          rows={rows}
          rowKey={(r) => r.p.id}
          resetKey={stage}
          onRowClick={(r) => navigate(`/procurement/requests/${r.p.id}`)}
          rowLabel={(r) => `Open ${r.p.code}`}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'req', header: 'Requisition', sortValue: (r) => r.p.code, render: (r) => (<span><span className="block font-mono text-xs">{r.p.code}</span><span className="text-sm text-slate-800">{r.p.title}</span></span>) },
            { key: 'po', header: 'PO', render: (r) => (r.approved ? <span className="font-mono text-xs">{po(r.p.code)}</span> : <span className="text-slate-300">—</span>), hideBelow: 'md' },
            { key: 'grn', header: 'GRN', render: (r) => (r.received ? <span className="font-mono text-xs">{grn(r.p.code)}</span> : <span className="text-slate-300">—</span>), hideBelow: 'md' },
            { key: 'sup', header: 'Supplier', render: (r) => supplierName(state, r.p.supplierId), hideBelow: 'lg' },
            { key: 'amt', header: 'Amount', align: 'right', sortValue: (r) => prTotal(r.p), render: (r) => formatMoneyCompact(prTotal(r.p)) },
            { key: 'date', header: 'Raised', sortValue: (r) => r.p.createdAt, render: (r) => formatDate(r.p.createdAt), hideBelow: 'sm' },
            { key: 's', header: 'Stage', render: (r) => <Badge tone={r.s === 'GRN posted' ? 'success' : r.s === 'PO issued' ? 'info' : r.s === 'Rejected' ? 'danger' : 'warning'} dot>{r.s}</Badge> },
          ]}
        />
      </Card>
    </div>
  )
}

// ---------------- Period close ----------------

export function CloseTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const order = { Month: 0, Quarter: 1, Year: 2 }
  const periods = [...state.periodCloses].sort((a, b) => order[a.kind] - order[b.kind] || b.period.localeCompare(a.period))
  const label = (p: (typeof periods)[number]) => (p.kind === 'Month' ? monthLabel(p.period) : p.period)
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice>Month-end, quarter-end and year-end close checklists. Finance ticks off each step; only the finance manager can close a period, and only when every step is complete.</Notice>
      {(['Month', 'Quarter', 'Year'] as const).map((kind) => (
        <div key={kind}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{kind === 'Month' ? 'Month-end close' : kind === 'Quarter' ? 'Quarterly close' : 'Year-end close'}</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {periods
              .filter((p) => p.kind === kind)
              .map((p) => {
                const done = p.checklist.filter((c) => c.done).length
                const editable = perms.role === 'Finance' && p.status !== 'Closed'
                return (
                  <Card key={p.id}>
                    <CardHeader title={label(p)} actions={<StatusBadge status={p.status} />} />
                    <CardBody>
                      <ProgressBar value={(done / p.checklist.length) * 100} tone={p.status === 'Closed' ? 'emerald' : 'brand'} label="Close progress" />
                      <ul className="mt-3 space-y-0.5">
                        {p.checklist.map((c, i) => (
                          <li key={c.label}>
                            <button disabled={!editable} onClick={() => run(() => commit((s) => toggleCloseItem(s, p.id, i)))} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs', editable && 'hover:bg-slate-50')}>
                              {c.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-slate-300" />}
                              <span className={c.done ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {p.status === 'Closed' ? (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Lock className="size-3.5" /> Closed by {p.closedBy} · {p.closedAt ? formatDate(p.closedAt.slice(0, 10)) : ''}</p>
                      ) : perms.canClosePeriods ? (
                        <Button size="sm" className="mt-3 w-full" disabled={done < p.checklist.length} onClick={() => run(() => commit((s) => closePeriod(s, p.id)), { title: `${label(p)} closed` })}>
                          Close {kind.toLowerCase()}
                        </Button>
                      ) : null}
                    </CardBody>
                  </Card>
                )
              })}
          </div>
        </div>
      ))}
      {periods.length === 0 && <EmptyState title="No periods set up" />}
    </div>
  )
}

