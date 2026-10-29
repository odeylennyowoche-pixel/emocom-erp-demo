/**
 * DEMO ACCESS MATRIX.
 *
 * Decides what each signed-in person can see and do, from their account type
 * (Main Admin, Secondary Admin, Finance, Sales, HR, Manager, Staff) and their
 * department.
 *
 * This runs in the browser only, so it controls what the interface shows; it
 * is NOT security. In production the same rules must be enforced by the server.
 */
import { LIMITS } from '../../config/approvals'
import type { AccessLevel, ActivityEntry, AppNotification, AppUser, DemoState, Department, Employee, Expense, Minor, PurchaseRequest } from '../../types'

/** all = whole company · department = own department · self = own records · none = hidden */
export type Scope = 'all' | 'department' | 'self' | 'none'

export type ModuleKey =
  | 'dashboard'
  | 'approvals'
  | 'workspace'
  | 'sales'
  | 'proposals'
  | 'projects'
  | 'team'
  | 'hr'
  | 'employees'
  | 'finance'
  | 'procurement'
  | 'inventory'
  | 'admin'
  | 'reports'
  | 'settings'

export type FinanceTab = 'overview' | 'cashflow' | 'ledger' | 'receivables' | 'payables' | 'revenue' | 'payroll' | 'purchasing' | 'close'
export type ReportTab = 'employees' | 'inventory' | 'procurement' | 'expenses'
export type SalesTab = 'pipeline' | 'leads' | 'clients' | 'tenders' | 'forecast' | 'handover' | 'invoices'
export type HrTab = 'people' | 'recruitment' | 'lifecycle' | 'leave' | 'performance' | 'learning'
export type AdminTab = 'partners' | 'contacts' | 'vendors' | 'licences' | 'itassets' | 'users' | 'integrations' | 'audit' | 'backups' | 'security'
export type WorkspaceTab = 'tasks' | 'calendar' | 'timesheets' | 'leave' | 'pay' | 'skills'
export type DashboardKind = 'ceo' | 'admin' | 'finance' | 'sales' | 'hr' | 'manager' | 'personal'

export interface Permissions {
  user: AppUser
  department: Department | undefined
  role: AccessLevel
  /** CEO / MD or secondary admin — see the whole company. */
  isExecutive: boolean
  isMainAdmin: boolean
  isSecondaryAdmin: boolean
  /** Heads their department (e.g. the finance manager or HR manager). */
  isDeptHead: boolean
  /** Mostly read-only (the CEO): approvals but little data entry. */
  readOnly: boolean
  dashboard: DashboardKind

  employees: Scope
  canManageEmployees: boolean
  inventory: 'manage' | 'view' | 'none'
  procurement: Scope
  canRaiseRequests: boolean
  canManageSuppliers: boolean
  canReceiveGoods: boolean
  /** Largest purchase request this person may approve (0 = cannot approve). */
  approvalLimitMinor: Minor
  approvalScope: 'all' | 'department' | 'none'
  finance: Scope
  financeTabs: FinanceTab[]
  canRecordExpenses: boolean
  canManageInvoices: boolean
  canRunPayroll: boolean
  canClosePeriods: boolean
  reports: Scope
  reportTabs: ReportTab[]
  settings: boolean

  sales: 'manage' | 'edit' | 'view' | 'none'
  salesTabs: SalesTab[]
  proposals: Scope
  projects: Scope
  canManageProjects: boolean
  team: boolean
  workspace: boolean
  workspaceTabs: WorkspaceTab[]
  hrTabs: HrTab[]
  canManageHR: boolean
  adminTabs: AdminTab[]
  canManageAdmin: boolean

  /** Approval rights outside purchasing. */
  leaveApproval: 'all' | 'department' | 'none'
  claimApproval: 'all' | 'department' | 'none'
  canPayClaims: boolean
  changeRequestLimitMinor: Minor
  changeRequestScope: 'all' | 'department' | 'none'
  canApproveProjects: boolean

  /** Short sentence shown on the profile menu and login page. */
  summary: string
}

const ALL_FINANCE: FinanceTab[] = ['overview', 'cashflow', 'ledger', 'receivables', 'payables', 'revenue', 'payroll', 'purchasing', 'close']
const ALL_REPORTS: ReportTab[] = ['employees', 'inventory', 'procurement', 'expenses']
const ALL_SALES: SalesTab[] = ['pipeline', 'leads', 'clients', 'tenders', 'forecast', 'handover', 'invoices']
const ALL_HR: HrTab[] = ['people', 'recruitment', 'lifecycle', 'leave', 'performance', 'learning']
const ALL_ADMIN: AdminTab[] = ['partners', 'contacts', 'vendors', 'licences', 'itassets', 'users', 'integrations', 'audit', 'backups', 'security']
const ALL_WORKSPACE: WorkspaceTab[] = ['tasks', 'calendar', 'timesheets', 'leave', 'pay', 'skills']

/** Everything off — each account type switches on what it needs. */
function baseline(user: AppUser, department: Department | undefined): Permissions {
  return {
    user,
    department,
    role: user.level,
    isExecutive: false,
    isMainAdmin: false,
    isSecondaryAdmin: false,
    isDeptHead: !!department && department.headEmployeeId === user.employeeId,
    readOnly: false,
    dashboard: 'personal',
    employees: 'self',
    canManageEmployees: false,
    inventory: 'none',
    procurement: 'none',
    canRaiseRequests: false,
    canManageSuppliers: false,
    canReceiveGoods: false,
    approvalLimitMinor: 0,
    approvalScope: 'none',
    finance: 'none',
    financeTabs: [],
    canRecordExpenses: false,
    canManageInvoices: false,
    canRunPayroll: false,
    canClosePeriods: false,
    reports: 'none',
    reportTabs: [],
    settings: false,
    sales: 'none',
    salesTabs: [],
    proposals: 'none',
    projects: 'none',
    canManageProjects: false,
    team: false,
    workspace: true,
    workspaceTabs: ALL_WORKSPACE,
    hrTabs: [],
    canManageHR: false,
    adminTabs: [],
    canManageAdmin: false,
    leaveApproval: 'none',
    claimApproval: 'none',
    canPayClaims: false,
    changeRequestLimitMinor: 0,
    changeRequestScope: 'none',
    canApproveProjects: false,
    summary: '',
  }
}

export function permissionsFor(user: AppUser, departments: Department[]): Permissions {
  const department = departments.find((d) => d.id === user.departmentId)
  const p = baseline(user, department)
  const code = department?.code ?? ''

  switch (user.level) {
    case 'Main Admin':
      // CEO / MD: strategic oversight and final approvals; mostly read-only.
      return {
        ...p,
        isExecutive: true,
        isMainAdmin: true,
        readOnly: true,
        dashboard: 'ceo',
        employees: 'all',
        inventory: 'view',
        procurement: 'all',
        approvalLimitMinor: Number.POSITIVE_INFINITY,
        approvalScope: 'all',
        finance: 'all',
        financeTabs: ['overview', 'cashflow', 'receivables', 'revenue', 'ledger'],
        reports: 'all',
        reportTabs: ALL_REPORTS,
        settings: true,
        sales: 'view',
        salesTabs: ['pipeline', 'forecast', 'tenders', 'clients', 'invoices'],
        proposals: 'all',
        projects: 'all',
        workspace: false,
        workspaceTabs: [],
        hrTabs: ['people', 'performance'],
        adminTabs: ['partners', 'itassets', 'audit'],
        claimApproval: 'all',
        changeRequestLimitMinor: Number.POSITIVE_INFINITY,
        changeRequestScope: 'all',
        canApproveProjects: true,
        summary: 'Strategic oversight and final approvals (large contracts, projects, capital). Read-only elsewhere.',
      }

    case 'Secondary Admin':
      // Runs the system: registries, users, integrations, audit, backups, security.
      return {
        ...p,
        isExecutive: true,
        isSecondaryAdmin: true,
        dashboard: 'admin',
        employees: 'all',
        inventory: 'manage',
        procurement: 'all',
        canManageSuppliers: true,
        reports: 'all',
        reportTabs: ['employees', 'inventory'],
        settings: true,
        adminTabs: ALL_ADMIN,
        canManageAdmin: true,
        summary: 'Partner & OEM registry, vendors, licences, IT assets, user accounts, integrations, audit, backups and security.',
      }

    case 'Finance': {
      const isManager = p.isDeptHead
      return {
        ...p,
        dashboard: 'finance',
        inventory: 'view',
        procurement: 'all',
        canRaiseRequests: true,
        canReceiveGoods: true,
        approvalLimitMinor: isManager ? LIMITS.financePurchaseMinor : 0,
        approvalScope: isManager ? 'all' : 'none',
        finance: 'all',
        financeTabs: ALL_FINANCE,
        canRecordExpenses: true,
        canManageInvoices: true,
        canRunPayroll: true,
        canClosePeriods: isManager,
        canPayClaims: true,
        reports: 'all',
        reportTabs: ALL_REPORTS,
        summary: isManager
          ? 'Ledger, receivables, payables, revenue recognition, period close, cash flow, payroll and purchasing; approves purchases up to ₦20m.'
          : 'Ledger, receivables, payables, payroll and purchasing (requisitions, purchase orders, goods received).',
      }
    }

    case 'HR':
      return {
        ...p,
        dashboard: 'hr',
        employees: 'all',
        canManageEmployees: true,
        reports: 'department',
        reportTabs: ['employees'],
        hrTabs: ALL_HR,
        canManageHR: true,
        leaveApproval: 'all',
        summary: 'Employee records, recruitment, onboarding/offboarding, leave & attendance, performance (KPIs, appraisals) and learning.',
      }

    case 'Sales':
      return {
        ...p,
        dashboard: 'sales',
        sales: 'edit',
        salesTabs: ALL_SALES,
        proposals: 'department',
        summary: 'CRM (leads, contacts, clients), pipeline, invoices & payment status, forecast, won-deal handover, RFQ / tender / EOI register.',
      }

    case 'Manager': {
      const m: Permissions = {
        ...p,
        dashboard: 'manager',
        employees: 'department',
        inventory: 'view',
        procurement: 'department',
        canRaiseRequests: true,
        approvalLimitMinor: LIMITS.managerPurchaseMinor,
        approvalScope: 'department',
        finance: 'department',
        financeTabs: ['payables'],
        reports: 'department',
        reportTabs: ['employees', 'procurement', 'expenses'],
        proposals: 'department',
        projects: 'department',
        canManageProjects: true,
        team: true,
        leaveApproval: 'department',
        claimApproval: 'department',
        changeRequestLimitMinor: LIMITS.managerChangeRequestMinor,
        changeRequestScope: 'department',
        summary: `Leads ${department?.name ?? 'the team'}: projects, task allocation, change requests, status reports, approvals for the team, appraisals and IT assets.`,
      }
      if (code === 'SBD') {
        m.sales = 'manage'
        m.salesTabs = ALL_SALES
      }
      return m
    }

    case 'Staff':
    default:
      return {
        ...p,
        proposals: 'self',
        projects: 'self',
        summary: 'Own tasks, timesheets, leave, payslips, skills and certifications; builds proposals and quotations.',
      }
  }
}

/** Which sidebar modules a person can open. */
export function canOpen(p: Permissions, module: ModuleKey): boolean {
  switch (module) {
    case 'dashboard':
      return true
    case 'approvals':
      return p.approvalScope !== 'none' || p.leaveApproval !== 'none' || p.claimApproval !== 'none' || p.changeRequestScope !== 'none' || p.canApproveProjects
    case 'workspace':
      return p.workspace
    case 'sales':
      return p.salesTabs.length > 0
    case 'proposals':
      return p.proposals !== 'none'
    case 'projects':
      return p.projects !== 'none' && p.projects !== 'self'
    case 'team':
      return p.team
    case 'hr':
      return p.hrTabs.length > 0
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
    case 'admin':
      return p.adminTabs.length > 0
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

/** Notifications addressed to this person (the CEO and secondary admin see all). */
export function canSeeNotification(p: Permissions, n: AppNotification): boolean {
  if (!n.audience || p.isExecutive) return true
  return !!(n.audience.departmentIds?.includes(p.user.departmentId) || n.audience.userIds?.includes(p.user.id))
}

/** Activity entries this person may see. */
export function canSeeActivity(p: Permissions, a: ActivityEntry): boolean {
  if (p.isExecutive || p.dashboard === 'finance') return true
  return a.departmentId === p.user.departmentId
}
