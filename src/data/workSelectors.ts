/**
 * Derived figures for the role-based modules. Pages and dashboards read these
 * so the numbers agree everywhere. Finance views here are ILLUSTRATIVE — they
 * summarise demo invoices and expenses and are not an accounting engine.
 */
import { APP_CONFIG } from '../config/app'
import { addDays, monthKey, monthRange, todayISO } from '../lib/dates'
import { lineTotal, sumMinor } from '../lib/money'
import type { DemoState, Employee, Minor, Opportunity, OpportunityStage, Project, Proposal, SalaryGrade, Task } from '../types'
import { invoiceTotal } from './selectors'

const M = APP_CONFIG.minorUnitsPerMajor

// ---------- sales ----------

export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  Qualification: 0.1,
  'Needs analysis': 0.25,
  Proposal: 0.5,
  Negotiation: 0.75,
  Won: 1,
  Lost: 0,
}

export const OPEN_STAGES: OpportunityStage[] = ['Qualification', 'Needs analysis', 'Proposal', 'Negotiation']

export function isOpen(o: Opportunity): boolean {
  return OPEN_STAGES.includes(o.stage)
}

export function pipelineValue(opps: Opportunity[]): Minor {
  return sumMinor(opps.filter(isOpen).map((o) => o.valueMinor))
}

export function weightedPipeline(opps: Opportunity[]): Minor {
  return sumMinor(opps.filter(isOpen).map((o) => Math.round(o.valueMinor * STAGE_PROBABILITY[o.stage])))
}

export function winLoss(opps: Opportunity[], sinceISO: string) {
  const closed = opps.filter((o) => (o.stage === 'Won' || o.stage === 'Lost') && (o.closedAt ?? '') >= sinceISO)
  const won = closed.filter((o) => o.stage === 'Won')
  const lost = closed.filter((o) => o.stage === 'Lost')
  return {
    won,
    lost,
    wonValue: sumMinor(won.map((o) => o.valueMinor)),
    lostValue: sumMinor(lost.map((o) => o.valueMinor)),
    winRate: closed.length ? won.length / closed.length : 0,
  }
}

/** Weighted forecast by expected close month (next n months). */
export function salesForecast(opps: Opportunity[], months = 6, today = todayISO()) {
  const keys = monthRange(today, addDays(today, months * 30)).slice(0, months)
  return keys.map((k) => {
    const inMonth = opps.filter((o) => isOpen(o) && monthKey(o.expectedClose) === k)
    return { month: k, weighted: sumMinor(inMonth.map((o) => Math.round(o.valueMinor * STAGE_PROBABILITY[o.stage]))), total: sumMinor(inMonth.map((o) => o.valueMinor)), count: inMonth.length }
  })
}

export function proposalTotal(p: Pick<Proposal, 'lines'>): Minor {
  return sumMinor(p.lines.map((l) => lineTotal(l.quantity, l.unitPriceMinor)))
}

// ---------- projects ----------

/** Percent complete from task effort (falls back to milestones). */
export function projectProgress(project: Project, tasks: Task[]): number {
  if (project.status === 'Completed') return 100
  const mine = tasks.filter((t) => t.projectId === project.id)
  const total = mine.reduce((s, t) => s + t.estimateHours, 0)
  if (total > 0) return Math.round((mine.filter((t) => t.status === 'Done').reduce((s, t) => s + t.estimateHours, 0) / total) * 100)
  const ms = project.milestones
  return ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : 0
}

export function isOverdue(t: Pick<Task, 'status' | 'dueDate'>, today = todayISO()): boolean {
  return t.status !== 'Done' && t.dueDate < today
}

/** Hours logged ÷ available hours (8h × working days) over the last `days`. */
export function utilisation(state: Pick<DemoState, 'timesheets'>, employeeIds: string[], days = 21, today = todayISO()) {
  const start = addDays(today, -days)
  let working = 0
  for (let d = start; d < today; d = addDays(d, 1)) {
    const wd = new Date(d + 'T00:00:00').getDay()
    if (wd !== 0 && wd !== 6) working++
  }
  return employeeIds.map((id) => {
    const hours = state.timesheets.filter((t) => t.employeeId === id && t.date >= start && t.date < today).reduce((s, t) => s + t.hours, 0)
    const available = working * 8
    return { employeeId: id, hours, available, rate: available ? hours / available : 0 }
  })
}

// ---------- leave & pay ----------

export const ANNUAL_LEAVE_ENTITLEMENT = 20

export function leaveBalance(state: Pick<DemoState, 'leaveRequests'>, employeeId: string, today = todayISO()) {
  const year = today.slice(0, 4)
  const mine = state.leaveRequests.filter((l) => l.employeeId === employeeId && l.startDate.startsWith(year))
  const taken = mine.filter((l) => l.type === 'Annual' && l.status === 'Approved').reduce((s, l) => s + l.days, 0)
  const pending = mine.filter((l) => l.type === 'Annual' && l.status === 'Pending').reduce((s, l) => s + l.days, 0)
  return { entitlement: ANNUAL_LEAVE_ENTITLEMENT, taken, pending, remaining: ANNUAL_LEAVE_ENTITLEMENT - taken - pending }
}

/** ILLUSTRATIVE payslip. Pension uses the configured 8% employee / 10% employer
 *  rates; income tax is a flat illustrative estimate, NOT a PAYE calculation. */
export const PAY_RULES = { pensionEmployee: 0.08, pensionEmployer: 0.1, illustrativeTaxRate: 0.07 }

export function payslipFor(grade: SalaryGrade | undefined) {
  if (!grade) return undefined
  const earnings = [
    { label: 'Basic salary', amountMinor: grade.basicMinor },
    { label: 'Housing allowance', amountMinor: grade.housingMinor },
    { label: 'Transport allowance', amountMinor: grade.transportMinor },
    { label: 'Other allowances', amountMinor: grade.otherAllowanceMinor },
  ]
  const gross = sumMinor(earnings.map((e) => e.amountMinor))
  const pensionable = grade.basicMinor + grade.housingMinor + grade.transportMinor
  const round = (v: number) => Math.round(v / M) * M
  const deductions = [
    { label: 'Pension — employee (8%)', amountMinor: round(pensionable * PAY_RULES.pensionEmployee) },
    { label: 'Income tax (illustrative estimate)', amountMinor: round(gross * PAY_RULES.illustrativeTaxRate) },
  ]
  const totalDeductions = sumMinor(deductions.map((d) => d.amountMinor))
  return { earnings, deductions, gross, totalDeductions, net: gross - totalDeductions, employerPension: round(pensionable * PAY_RULES.pensionEmployer) }
}

export function gradeOf(state: Pick<DemoState, 'salaryGrades' | 'employeeGrades'>, employeeId: string | undefined): SalaryGrade | undefined {
  if (!employeeId) return undefined
  return state.salaryGrades.find((g) => g.code === state.employeeGrades[employeeId])
}

export function payrollByDepartment(state: Pick<DemoState, 'salaryGrades' | 'employeeGrades' | 'employees' | 'departments'>) {
  return state.departments.map((d) => {
    const staff = state.employees.filter((e) => e.departmentId === d.id && e.status !== 'Inactive')
    const slips = staff.map((e) => payslipFor(gradeOf(state, e.id))).filter((s): s is NonNullable<typeof s> => !!s)
    return {
      department: d,
      headcount: staff.length,
      gross: sumMinor(slips.map((s) => s.gross)),
      deductions: sumMinor(slips.map((s) => s.totalDeductions)),
      net: sumMinor(slips.map((s) => s.net)),
      employerPension: sumMinor(slips.map((s) => s.employerPension)),
    }
  })
}

// ---------- finance (illustrative) ----------

const DELIVERY_DEPTS = ['ENG', 'MSS', 'PMO']

/** Revenue (invoices issued) less cost of sales (procurement, field operations and delivery payroll). */
export function grossMargin(state: Pick<DemoState, 'invoices' | 'expenses' | 'departments'>, start: string, end: string) {
  const delivery = new Set(state.departments.filter((d) => DELIVERY_DEPTS.includes(d.code)).map((d) => d.id))
  const revenue = sumMinor(state.invoices.filter((i) => i.status !== 'Draft' && i.issueDate >= start && i.issueDate <= end).map(invoiceTotal))
  const cos = sumMinor(
    state.expenses
      .filter((e) => e.date >= start && e.date <= end && (e.category === 'Procurement' || e.category === 'Field Operations' || (e.category === 'Payroll' && delivery.has(e.departmentId))))
      .map((e) => e.amountMinor),
  )
  return { revenue, costOfSales: cos, grossProfit: revenue - cos, marginPct: revenue ? ((revenue - cos) / revenue) * 100 : 0 }
}

export function monthlyMargin(state: Pick<DemoState, 'invoices' | 'expenses' | 'departments'>, months: string[]) {
  return months.map((m) => {
    const g = grossMargin(state, `${m}-01`, `${m}-31`)
    return { month: m, ...g }
  })
}

/** Illustrative opening cash so the running balance is meaningful. */
export const OPENING_CASH_MINOR = 280_000_000 * M

export function cashFlow(state: Pick<DemoState, 'invoices' | 'expenses'>, months: string[]) {
  let balance = OPENING_CASH_MINOR
  // cash before the first charted month
  const first = months[0] + '-01'
  balance += sumMinor(state.invoices.filter((i) => i.status === 'Paid' && i.paidDate && i.paidDate < first).map(invoiceTotal))
  balance -= sumMinor(state.expenses.filter((e) => e.status === 'Paid' && e.date < first).map((e) => e.amountMinor))
  return months.map((m) => {
    const inflow = sumMinor(state.invoices.filter((i) => i.status === 'Paid' && i.paidDate && monthKey(i.paidDate) === m).map(invoiceTotal))
    const outflow = sumMinor(state.expenses.filter((e) => e.status === 'Paid' && monthKey(e.date) === m).map((e) => e.amountMinor))
    balance += inflow - outflow
    return { month: m, inflow, outflow, net: inflow - outflow, closing: balance }
  })
}

export function receivablesAging(state: Pick<DemoState, 'invoices'>, today = todayISO()) {
  const open = state.invoices.filter((i) => i.status === 'Sent' || i.status === 'Overdue')
  const buckets = [
    { label: 'Not yet due', min: -Infinity, max: 0 },
    { label: '1–30 days', min: 1, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '61–90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Infinity },
  ]
  return buckets.map((b) => {
    const rows = open.filter((i) => {
      const days = Math.round((Date.parse(today) - Date.parse(i.dueDate)) / 86_400_000)
      return days >= b.min && days <= b.max
    })
    return { label: b.label, count: rows.length, amountMinor: sumMinor(rows.map(invoiceTotal)) }
  })
}

/** Stable pseudo-random 0..1 from an id (for illustrative billing figures). */
function hash01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

/** Percentage-of-completion (cost-to-cost) revenue recognition per project. */
export function revenueRecognition(projects: Project[]) {
  return projects
    .filter((p) => p.status !== 'Pending approval' && p.status !== 'Rejected')
    .map((p) => {
      const pct = p.status === 'Completed' ? 1 : Math.min(1, p.budgetMinor ? p.costToDateMinor / p.budgetMinor : 0)
      const recognised = Math.round(p.contractValueMinor * pct)
      const billedPct = p.status === 'Completed' ? 1 : Math.max(0, Math.min(1, pct + (hash01(p.id) - 0.5) * 0.3))
      const billed = Math.round(p.contractValueMinor * billedPct)
      return { project: p, pct, recognised, billed, unbilled: Math.max(0, recognised - billed), deferred: Math.max(0, billed - recognised) }
    })
}

export interface JournalLine {
  id: string
  date: string
  reference: string
  description: string
  account: string
  debit: Minor
  credit: Minor
}

export const GL_ACCOUNTS = ['1000 Bank', '1100 Accounts receivable', '2000 Accounts payable', '4000 Revenue', '5000 Cost of sales', '6000 Payroll', '6100 Operating expenses'] as const

/** Illustrative journal built from invoices and expenses in a date range. */
export function generalLedger(state: Pick<DemoState, 'invoices' | 'expenses'>, start: string, end: string): JournalLine[] {
  const lines: JournalLine[] = []
  const push = (date: string, reference: string, description: string, debitAcct: string, creditAcct: string, amount: Minor, key: string) => {
    lines.push({ id: `${key}_d`, date, reference, description, account: debitAcct, debit: amount, credit: 0 })
    lines.push({ id: `${key}_c`, date, reference, description, account: creditAcct, debit: 0, credit: amount })
  }
  for (const i of state.invoices) {
    if (i.status === 'Draft') continue
    const amt = invoiceTotal(i)
    if (i.issueDate >= start && i.issueDate <= end) push(i.issueDate, i.number, `Invoice to ${i.customer.name}`, '1100 Accounts receivable', '4000 Revenue', amt, `gl_${i.id}_iss`)
    if (i.status === 'Paid' && i.paidDate && i.paidDate >= start && i.paidDate <= end) push(i.paidDate, i.number, `Receipt from ${i.customer.name}`, '1000 Bank', '1100 Accounts receivable', amt, `gl_${i.id}_pay`)
  }
  for (const e of state.expenses) {
    if (e.date < start || e.date > end) continue
    const acct = e.category === 'Payroll' ? '6000 Payroll' : e.category === 'Procurement' || e.category === 'Field Operations' ? '5000 Cost of sales' : '6100 Operating expenses'
    push(e.date, e.code, `${e.description}`, acct, '2000 Accounts payable', e.amountMinor, `gl_${e.id}_acc`)
    if (e.status === 'Paid') push(e.date, e.code, `Payment to ${e.payee}`, '2000 Accounts payable', '1000 Bank', e.amountMinor, `gl_${e.id}_pay`)
  }
  return lines.sort((a, b) => b.date.localeCompare(a.date) || a.reference.localeCompare(b.reference))
}

export function trialBalance(lines: JournalLine[]) {
  return GL_ACCOUNTS.map((account) => {
    const debit = sumMinor(lines.filter((l) => l.account === account).map((l) => l.debit))
    const credit = sumMinor(lines.filter((l) => l.account === account).map((l) => l.credit))
    return { account, debit, credit, balance: debit - credit }
  })
}

// ---------- people helpers ----------

export function teamOf(state: Pick<DemoState, 'employees'>, departmentId: string, excludeId?: string): Employee[] {
  return state.employees.filter((e) => e.departmentId === departmentId && e.status !== 'Inactive' && e.id !== excludeId)
}

export function certStatus(expires: string | undefined, today = todayISO()): 'Valid' | 'Expiring soon' | 'Expired' | 'No expiry' {
  if (!expires) return 'No expiry'
  if (expires < today) return 'Expired'
  if (expires <= addDays(today, 60)) return 'Expiring soon'
  return 'Valid'
}
