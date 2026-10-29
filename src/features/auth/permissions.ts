/**
 * DEMO ACCESS MATRIX.
 *
 * Decides what each signed-in person can see and do, from their access level
 * (CEO, Administrator, Head of Department, Staff) and their department.
 *
 * This runs in the browser only, so it controls what the interface shows; it
 * is NOT security. In production the same rules must be enforced by the server.
 */
import { APP_CONFIG } from '../../config/app'
import type { ActivityEntry, AppNotification, AppUser, DemoState, Department, Employee, Expense, Minor, PurchaseRequest } from '../../types'

const M = APP_CONFIG.minorUnitsPerMajor

/** all = whole company · department = own department · self = own records · none = hidden */
export type Scope = 'all' | 'department' | 'self' | 'none'

export type ModuleKey = 'dashboard' | 'employees' | 'inventory' | 'procurement' | 'finance' | 'reports' | 'settings'
export type FinanceTab = 'overview' | 'expenses' | 'invoices' | 'transactions'
export type ReportTab = 'employees' | 'inventory' | 'procurement' | 'expenses'

export interface Permissions {
  user: AppUser
  department: Department | undefined
  /** CEO or Administrator. */
  isExecutive: boolean
  dashboard: 'executive' | 'department' | 'personal'
  employees: Scope
  canManageEmployees: boolean
  inventory: 'manage' | 'view' | 'none'
  procurement: Scope
  canManageSuppliers: boolean
  canReceiveGoods: boolean
  /** Largest request total this person may approve (0 = cannot approve). */
  approvalLimitMinor: Minor
  /** Whose requests they may approve. */
  approvalScope: 'all' | 'department' | 'none'
  finance: Scope
  financeTabs: FinanceTab[]
  canRecordExpenses: boolean
  canManageInvoices: boolean
  reports: Scope
  reportTabs: ReportTab[]
  settings: boolean
  /** Short sentence shown on the profile menu and login page. */
  summary: string
}

const ALL_FINANCE: FinanceTab[] = ['overview', 'expenses', 'invoices', 'transactions']
const ALL_REPORTS: ReportTab[] = ['employees', 'inventory', 'procurement', 'expenses']

export function permissionsFor(user: AppUser, departments: Department[]): Permissions {
  const department = departments.find((d) => d.id === user.departmentId)
  const code = department?.code ?? ''
  const base = { user, department }

  if (user.level === 'CEO' || user.level === 'Administrator') {
    const isCeo = user.level === 'CEO'
    return {
      ...base,
      isExecutive: true,
      dashboard: 'executive',
      employees: 'all',
      canManageEmployees: true,
      inventory: 'manage',
      procurement: 'all',
      canManageSuppliers: true,
      canReceiveGoods: true,
      // Separation of duties: the administrator runs the system; the CEO approves.
      approvalLimitMinor: isCeo ? Number.POSITIVE_INFINITY : 0,
      approvalScope: isCeo ? 'all' : 'none',
      finance: 'all',
      financeTabs: ALL_FINANCE,
      canRecordExpenses: true,
      canManageInvoices: true,
      reports: 'all',
      reportTabs: ALL_REPORTS,
      settings: true,
      summary: isCeo
        ? 'Full company view; approves any purchase request.'
        : 'Full company view; manages users and settings (no approvals).',
    }
  }

  const isHead = user.level === 'Head of Department'
  const p: Permissions = {
    ...base,
    isExecutive: false,
    dashboard: isHead ? 'department' : 'personal',
    employees: isHead ? 'department' : 'self',
    canManageEmployees: false,
    inventory: 'view',
    procurement: isHead ? 'department' : 'self',
    canManageSuppliers: false,
    canReceiveGoods: false,
    approvalLimitMinor: isHead ? 5_000_000 * M : 0,
    approvalScope: isHead ? 'department' : 'none',
    finance: isHead ? 'department' : 'none',
    financeTabs: isHead ? ['expenses'] : [],
    canRecordExpenses: false,
    canManageInvoices: false,
    reports: isHead ? 'department' : 'none',
    reportTabs: isHead ? ['employees', 'procurement', 'expenses'] : [],
    settings: false,
    summary: isHead
      ? `Leads ${department?.name ?? 'the department'}; approves its requests up to ₦5m.`
      : 'Own profile and requests; can raise purchase requests.',
  }

  // Department-specific responsibilities
  switch (code) {
    case 'HRA':
      p.employees = 'all'
      p.canManageEmployees = true
      if (isHead) p.reportTabs = ['employees', 'procurement', 'expenses']
      p.summary = isHead ? 'Manages all staff records; approves HR & Admin requests up to ₦5m.' : 'Maintains staff records for the whole company.'
      break
    case 'FIN':
      p.finance = 'all'
      p.financeTabs = isHead ? ALL_FINANCE : ['expenses', 'invoices', 'transactions']
      p.canRecordExpenses = true
      p.canManageInvoices = true
      if (isHead) {
        p.dashboard = 'executive'
        p.reports = 'all'
        p.reportTabs = ALL_REPORTS
        p.approvalScope = 'all'
        p.approvalLimitMinor = 20_000_000 * M
        p.summary = 'Company finances and budgets; approves any request up to ₦20m.'
      } else {
        p.summary = 'Records expenses and client payments for the company.'
      }
      break
    case 'PRL':
      p.inventory = 'manage'
      p.procurement = 'all'
      p.canManageSuppliers = true
      p.canReceiveGoods = true
      if (isHead) {
        p.reports = 'all'
        p.reportTabs = ['inventory', 'procurement', 'expenses']
        p.summary = 'All stock, suppliers and requests; approves Procurement requests up to ₦5m.'
      } else {
        p.summary = 'Manages stock, suppliers and goods received.'
      }
      break
    case 'SBD':
      // Sales follow up client payments, so they can read every invoice.
      p.finance = isHead ? 'department' : 'none'
      p.financeTabs = isHead ? ['expenses', 'invoices'] : ['invoices']
      if (isHead) p.summary = 'Client invoices and the sales team; approves Sales requests up to ₦5m.'
      else p.summary = 'Own requests; can check client invoices.'
      break
  }
  return p
}

/** Which sidebar modules a person can open. */
export function canOpen(p: Permissions, module: ModuleKey): boolean {
  switch (module) {
    case 'dashboard':
      return true
    case 'employees':
      return p.employees !== 'none'
    case 'inventory':
      return p.inventory !== 'none'
    case 'procurement':
      return p.procurement !== 'none'
    case 'finance':
      return p.financeTabs.length > 0
    case 'reports':
      return p.reportTabs.length > 0
    case 'settings':
      return p.settings
  }
}

// ---------- record-level scoping ----------

export function visibleEmployees(p: Permissions, employees: Employee[]): Employee[] {
  if (p.employees === 'all') return employees
  if (p.employees === 'department') return employees.filter((e) => e.departmentId === p.user.departmentId)
  if (p.employees === 'self') return employees.filter((e) => e.id === p.user.employeeId)
  return []
}

export function canViewEmployee(p: Permissions, e: Employee): boolean {
  return visibleEmployees(p, [e]).length === 1
}

export function visibleRequests(p: Permissions, requests: PurchaseRequest[]): PurchaseRequest[] {
  if (p.procurement === 'all') return requests
  if (p.procurement === 'department') return requests.filter((r) => r.departmentId === p.user.departmentId)
  if (p.procurement === 'self') return requests.filter((r) => r.requesterId === p.user.employeeId)
  return []
}

export function visibleExpenses(p: Permissions, expenses: Expense[]): Expense[] {
  if (p.finance === 'all') return expenses
  if (p.finance === 'department') return expenses.filter((e) => e.departmentId === p.user.departmentId)
  return []
}

/** Department ids whose figures this person may see in reports/dashboards. */
export function reportDepartmentIds(p: Permissions, state: Pick<DemoState, 'departments'>): string[] {
  return p.reports === 'all' || p.isExecutive ? state.departments.map((d) => d.id) : [p.user.departmentId]
}

/** Notifications addressed to this person (executives see all). */
export function canSeeNotification(p: Permissions, n: AppNotification): boolean {
  if (!n.audience || p.isExecutive) return true
  return !!(n.audience.departmentIds?.includes(p.user.departmentId) || n.audience.userIds?.includes(p.user.id))
}

/** Activity entries this person may see. */
export function canSeeActivity(p: Permissions, a: ActivityEntry): boolean {
  if (p.isExecutive || p.dashboard === 'executive') return true
  return a.departmentId === p.user.departmentId
}
