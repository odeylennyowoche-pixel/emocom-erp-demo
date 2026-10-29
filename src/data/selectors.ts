/**
 * Pure derived-data functions. Every page reads figures through these so the
 * dashboard, modules and reports always agree.
 */
import { monthKey, monthRange, isWithin } from '../lib/dates'
import { lineTotal, sumMinor } from '../lib/money'
import type {
  DemoState,
  Employee,
  Expense,
  InventoryItem,
  Invoice,
  Minor,
  PurchaseRequest,
  StockStatus,
  Transaction,
} from '../types'

export function fullName(e: Pick<Employee, 'firstName' | 'lastName'> | undefined): string {
  return e ? `${e.firstName} ${e.lastName}` : '—'
}

export function stockStatus(item: Pick<InventoryItem, 'quantity' | 'reorderLevel'>): StockStatus {
  if (item.quantity <= 0) return 'Out of Stock'
  if (item.quantity <= item.reorderLevel) return 'Low Stock'
  return 'In Stock'
}

export function itemValue(item: InventoryItem): Minor {
  return lineTotal(item.quantity, item.unitCostMinor)
}

export function prTotal(pr: Pick<PurchaseRequest, 'lines'>): Minor {
  return sumMinor(pr.lines.map((l) => lineTotal(l.quantity, l.unitPriceMinor)))
}

export function invoiceTotal(inv: Pick<Invoice, 'lines'>): Minor {
  return sumMinor(inv.lines.map((l) => lineTotal(l.quantity, l.unitPriceMinor)))
}

/** Ledger-style view: money in from paid invoices, money out from paid expenses. */
export function deriveTransactions(state: Pick<DemoState, 'invoices' | 'expenses'>): Transaction[] {
  const incoming: Transaction[] = state.invoices
    .filter((i) => i.status === 'Paid' && i.paidDate)
    .map((i) => ({
      id: `txn_${i.id}`,
      date: i.paidDate!,
      direction: 'In',
      description: `Payment received — ${i.number}`,
      counterparty: i.customer.name,
      category: 'Customer payment',
      amountMinor: invoiceTotal(i),
      reference: i.number,
      sourceType: 'Invoice',
      sourceId: i.id,
    }))
  const outgoing: Transaction[] = state.expenses
    .filter((e) => e.status === 'Paid')
    .map((e) => ({
      id: `txn_${e.id}`,
      date: e.date,
      direction: 'Out',
      description: e.description,
      counterparty: e.payee,
      category: e.category,
      amountMinor: e.amountMinor,
      reference: e.code,
      sourceType: 'Expense',
      sourceId: e.id,
    }))
  return [...incoming, ...outgoing].sort((a, b) => b.date.localeCompare(a.date))
}

/** Revenue = paid invoice amounts by payment date. */
export function revenueInRange(invoices: Invoice[], start: string, end: string): Minor {
  return sumMinor(invoices.filter((i) => i.status === 'Paid' && i.paidDate && isWithin(i.paidDate, start, end)).map(invoiceTotal))
}

/** Expenses = all recorded expenses (paid or not) by expense date. */
export function expensesInRange(expenses: Expense[], start: string, end: string): Minor {
  return sumMinor(expenses.filter((e) => isWithin(e.date, start, end)).map((e) => e.amountMinor))
}

export interface MonthlyFinancePoint {
  month: string
  revenueMinor: Minor
  expensesMinor: Minor
}

export function monthlyFinance(state: Pick<DemoState, 'invoices' | 'expenses'>, start: string, end: string): MonthlyFinancePoint[] {
  const months = monthRange(start, end)
  const map = new Map<string, MonthlyFinancePoint>(months.map((m) => [m, { month: m, revenueMinor: 0, expensesMinor: 0 }]))
  for (const i of state.invoices) {
    if (i.status !== 'Paid' || !i.paidDate || !isWithin(i.paidDate, start, end)) continue
    const p = map.get(monthKey(i.paidDate))
    if (p) p.revenueMinor += invoiceTotal(i)
  }
  for (const e of state.expenses) {
    if (!isWithin(e.date, start, end)) continue
    const p = map.get(monthKey(e.date))
    if (p) p.expensesMinor += e.amountMinor
  }
  return months.map((m) => map.get(m)!)
}

export function activeHeadcount(employees: Employee[]): number {
  return employees.filter((e) => e.status !== 'Inactive').length
}

export function inventoryAlerts(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => stockStatus(i) !== 'In Stock')
}

export function departmentName(state: Pick<DemoState, 'departments'>, id: string | undefined): string {
  return state.departments.find((d) => d.id === id)?.name ?? '—'
}

export function employeeById(state: Pick<DemoState, 'employees'>, id: string | undefined): Employee | undefined {
  return id ? state.employees.find((e) => e.id === id) : undefined
}

export function supplierName(state: Pick<DemoState, 'suppliers'>, id: string | undefined): string {
  return state.suppliers.find((s) => s.id === id)?.name ?? '—'
}

/** Fiscal-year-to-date spend per department vs annual budget. */
export function budgetSummary(state: Pick<DemoState, 'departments' | 'expenses' | 'organization'>, today: string) {
  const fyStartMonth = state.organization.fiscalYearStartMonth
  const year = Number(today.slice(0, 4))
  const currentMonth = Number(today.slice(5, 7))
  const fyYear = currentMonth >= fyStartMonth ? year : year - 1
  const fyStart = `${fyYear}-${String(fyStartMonth).padStart(2, '0')}-01`
  const monthsElapsed = monthRange(fyStart, today).length
  return {
    fyStart,
    monthsElapsed,
    rows: state.departments.map((d) => {
      const spent = expensesInRange(
        state.expenses.filter((e) => e.departmentId === d.id),
        fyStart,
        today,
      )
      return {
        department: d,
        budgetMinor: d.annualBudgetMinor,
        spentMinor: spent,
        remainingMinor: d.annualBudgetMinor - spent,
        utilisation: d.annualBudgetMinor > 0 ? spent / d.annualBudgetMinor : 0,
        expectedUtilisation: monthsElapsed / 12,
      }
    }),
  }
}
