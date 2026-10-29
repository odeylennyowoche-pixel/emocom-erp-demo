import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Download, Plus } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { addExpense, setExpenseStatus } from '../../data/actions'
import { budgetSummary, departmentName } from '../../data/selectors'
import { visibleExpenses } from '../auth/permissions'
import { useQueryState } from '../../hooks/useQueryState'
import { useAction } from '../../hooks/useAction'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, minorToInput, MONEY_INPUT_PATTERN, parseMoneyToMinor, sumMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES, type Expense, type ExpenseCategory, type PaymentStatus } from '../../types'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { DateRangeInputs, FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'

export function ExpensesTab() {
  const { state, perms, commit } = useData()
  const scoped = useMemo(() => visibleExpenses(perms, state.expenses), [perms, state.expenses])
  const dept = perms.finance === 'department' ? perms.department : undefined
  const budget = useMemo(() => (dept ? budgetSummary(state, todayISO()).rows.find((r) => r.department.id === dept.id) : undefined), [state, dept])
  const run = useAction()
  const [q, setQ] = useQueryState('q')
  const [category, setCategory] = useQueryState<ExpenseCategory | ''>('category')
  const [deptFilter, setDept] = useQueryState('dept')
  const [status, setStatus] = useQueryState<PaymentStatus | ''>('status')
  const [from, setFrom] = useQueryState('from')
  const [to, setTo] = useQueryState('to')
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState<Expense | null>(null)

  const rows = useMemo(
    () =>
      scoped.filter(
        (e) =>
          (!category || e.category === category) &&
          (!deptFilter || e.departmentId === deptFilter) &&
          (!status || e.status === status) &&
          (!from || e.date >= from) &&
          (!to || e.date <= to) &&
          includesText([e.code, e.description, e.payee], q),
      ),
    [scoped, category, deptFilter, status, from, to, q],
  )
  const total = sumMinor(rows.map((e) => e.amountMinor))
  const unpaid = sumMinor(rows.filter((e) => e.status !== 'Paid').map((e) => e.amountMinor))

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'Date', sortValue: (e) => e.date, render: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}</span> },
    {
      key: 'desc',
      header: 'Expense',
      sortValue: (e) => e.description,
      render: (e) => (
        <div className="min-w-0">
          <p className="max-w-72 truncate font-medium text-slate-800">{e.description}</p>
          <p className="truncate text-xs text-slate-500">
            <span className="font-mono">{e.code}</span> · {e.payee}
          </p>
        </div>
      ),
    },
    { key: 'cat', header: 'Category', sortValue: (e) => e.category, render: (e) => e.category, hideBelow: 'md' },
    { key: 'dept', header: 'Department', sortValue: (e) => departmentName(state, e.departmentId), render: (e) => departmentName(state, e.departmentId), hideBelow: 'lg' },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (e) => e.amountMinor, render: (e) => <span className="font-medium text-slate-900">{formatMoney(e.amountMinor)}</span> },
    { key: 'status', header: 'Status', sortValue: (e) => e.status, render: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (e) =>
        e.status !== 'Paid' && perms.canRecordExpenses ? (
          <Button size="sm" variant="ghost" className="text-emerald-700" icon={<CheckCircle2 className="size-4" />} onClick={() => setPaying(e)}>
            Mark paid
          </Button>
        ) : null,
    },
  ]

  const exportCsv = () =>
    downloadCsv(`expenses-${todayISO()}`, rows, [
      { header: 'Expense ID', value: (e) => e.code },
      { header: 'Date', value: (e) => e.date },
      { header: 'Description', value: (e) => e.description },
      { header: 'Payee', value: (e) => e.payee },
      { header: 'Category', value: (e) => e.category },
      { header: 'Department', value: (e) => departmentName(state, e.departmentId) },
      { header: 'Amount', value: (e) => minorToInput(e.amountMinor) },
      { header: 'Status', value: (e) => e.status },
    ])

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search description, payee, ID…" label="Search expenses" />
        <FilterSelect label="Filter by expense category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} allLabel="All categories" />
        {perms.finance === 'all' && (
          <FilterSelect label="Filter by department" value={deptFilter} onChange={setDept} options={state.departments.map((d) => ({ value: d.id, label: d.name }))} allLabel="All departments" />
        )}
        <FilterSelect label="Filter by payment status" value={status} onChange={setStatus} options={PAYMENT_STATUSES} allLabel="All statuses" />
        <DateRangeInputs from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
            Export
          </Button>
          {perms.canRecordExpenses && (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Record expense
            </Button>
          )}
        </div>
      </Toolbar>
      {budget && (
        <div className="grid gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-3">
          <div className="bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Annual budget</p>
            <p className="tabular font-semibold text-slate-900">{formatMoney(budget.budgetMinor)}</p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Spent this fiscal year</p>
            <p className="tabular font-semibold text-slate-900">
              {formatMoney(budget.spentMinor)} <span className="text-xs font-normal text-slate-500">({Math.round(budget.utilisation * 100)}%)</span>
            </p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="tabular font-semibold text-emerald-700">{formatMoney(budget.remainingMinor)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-sm text-slate-600">
        <span>
          Filtered total: <strong className="tabular text-slate-900">{formatMoney(total)}</strong>
        </span>
        <span>
          Unpaid: <strong className="tabular text-amber-700">{formatMoney(unpaid)}</strong>
        </span>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} initialSort={{ key: 'date', dir: 'desc' }} resetKey={`${q}|${category}|${deptFilter}|${status}|${from}|${to}`} />
      <ExpenseModal open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        title="Mark expense as paid?"
        tone="success"
        confirmLabel="Mark as paid"
        message={paying ? `${paying.code} · ${paying.description} — ${formatMoney(paying.amountMinor)} to ${paying.payee}. This records the payment in the demo only; no money is transferred.` : ''}
        onConfirm={() => {
          if (!paying) return
          const ok = run(() => commit((s) => setExpenseStatus(s, paying.id, 'Paid')), { title: 'Expense marked as paid', description: paying.code })
          if (ok) setPaying(null)
        }}
      />
    </>
  )
}

const expenseSchema = z.object({
  date: z.string().min(1, 'Select a date').refine((d) => d <= todayISO(), 'Expense date cannot be in the future'),
  departmentId: z.string().min(1, 'Select a department'),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(4, 'Describe the expense').max(120),
  payee: z.string().trim().min(2, 'Enter the payee').max(80),
  amount: z
    .string()
    .trim()
    .regex(MONEY_INPUT_PATTERN, 'Enter an amount with up to 2 decimal places')
    .refine((v) => (parseMoneyToMinor(v) ?? 0) > 0, 'Amount must be greater than zero'),
  status: z.enum(PAYMENT_STATUSES),
})
type ExpenseForm = z.infer<typeof expenseSchema>

function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, commitWith } = useData()
  const run = useAction()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: todayISO(), departmentId: '', category: 'Travel', description: '', payee: '', amount: '', status: 'Pending' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (v: ExpenseForm) => {
    const ok = run(
      () =>
        void commitWith((s) =>
          addExpense(s, { date: v.date, departmentId: v.departmentId, category: v.category, description: v.description, payee: v.payee, amountMinor: parseMoneyToMinor(v.amount)!, status: v.status }),
        ),
      { title: 'Expense recorded', description: `${v.description} — ${formatMoney(parseMoneyToMinor(v.amount)!)}` },
    )
    if (ok) close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record expense"
      description="Adds a demo expense record. Dashboard, budgets and reports update immediately."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form">
            Record expense
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Description" required error={errors.description?.message} className="sm:col-span-2">
          {(id, d) => <Textarea id={id} rows={2} aria-describedby={d} invalid={!!errors.description} {...register('description')} />}
        </Field>
        <Field label="Payee" required error={errors.payee?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.payee} {...register('payee')} />}
        </Field>
        <Field label={`Amount (${APP_CONFIG.currency})`} required error={errors.amount?.message}>
          {(id, d) => <Input id={id} inputMode="decimal" placeholder="0.00" aria-describedby={d} invalid={!!errors.amount} {...register('amount')} />}
        </Field>
        <Field label="Category" required>
          {(id) => (
            <Select id={id} {...register('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Department" required error={errors.departmentId?.message}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} invalid={!!errors.departmentId} {...register('departmentId')}>
              <option value="">Select department…</option>
              {state.departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Expense date" required error={errors.date?.message}>
          {(id, d) => <Input id={id} type="date" max={todayISO()} aria-describedby={d} invalid={!!errors.date} {...register('date')} />}
        </Field>
        <Field label="Payment status" required>
          {(id) => (
            <Select id={id} {...register('status')}>
              {PAYMENT_STATUSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}
