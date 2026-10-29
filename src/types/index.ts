/**
 * Business entity types for EMOCOM ERP.
 *
 * Monetary values are always stored as integer minor units (kobo for NGN)
 * in fields ending with `Minor`, to avoid floating-point rounding errors.
 * Dates are ISO strings: `YYYY-MM-DD` for calendar dates, full ISO for timestamps.
 */

export type ID = string

export type Minor = number // integer minor currency units (e.g. kobo)

// ---------- Organisation ----------

export interface Department {
  id: ID
  code: string
  name: string
  headEmployeeId?: ID
  annualBudgetMinor: Minor
}

export interface OrganizationProfile {
  name: string
  shortName: string
  industry: string
  email: string
  phone: string
  address: string
  fiscalYearStartMonth: number // 1-12
}

export type AccentColor = 'gold' | 'bronze' | 'blue'

export interface Preferences {
  accent: AccentColor
  compactTables: boolean
  pageSize: number
  showDemoBanner: boolean
}

// ---------- Users & access (DEMO ONLY) ----------

/**
 * Account types agreed with EMOCOM. Combined with the user's department they
 * decide which modules and records a person can see
 * (see src/features/auth/permissions.ts).
 */
export const ACCESS_LEVELS = ['Main Admin', 'Secondary Admin', 'Finance', 'Sales', 'HR', 'Manager', 'Staff'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  'Main Admin': 'CEO / MD · Main admin',
  'Secondary Admin': 'Secondary admin',
  Finance: 'Finance',
  Sales: 'Sales',
  HR: 'HR',
  Manager: 'Manager (HOD)',
  Staff: 'Staff',
}

export interface AppUser {
  id: ID
  /** Demo sign-in name, e.g. "hod.sales". */
  username: string
  name: string
  email: string
  title: string
  level: AccessLevel
  departmentId: ID
  employeeId?: ID
  status: 'Active' | 'Suspended'
  lastActiveAt: string
}

// ---------- Employees ----------

export const EMPLOYMENT_STATUSES = ['Active', 'On Leave', 'Inactive'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

export const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Intern'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export interface Employee {
  id: ID
  employeeNo: string
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: ID
  jobTitle: string
  status: EmploymentStatus
  employmentType: EmploymentType
  joinDate: string
  location: string
  managerId?: ID
}

// ---------- Inventory & assets ----------

export const INVENTORY_CATEGORIES = [
  'Networking & Wi-Fi',
  'Radio & Microwave',
  'Security & CCTV',
  'SCADA & Instrumentation',
  'Fleet Telematics',
  'Print & Consumables',
  'Power & Accessories',
  'Field Safety',
] as const
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]

export const WAREHOUSE_LOCATIONS = [
  'Lekki HQ Store',
  'Ikeja Warehouse',
  'Abuja Office Store',
  'Port Harcourt Field Depot',
] as const
export type WarehouseLocation = (typeof WAREHOUSE_LOCATIONS)[number]

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock'

export interface InventoryItem {
  id: ID
  code: string
  name: string
  category: InventoryCategory
  unit: string
  quantity: number
  reorderLevel: number
  unitCostMinor: Minor
  location: WarehouseLocation
  preferredSupplierId?: ID
  updatedAt: string
}

export type StockMovementType = 'Receipt' | 'Issue' | 'Adjustment'

export interface StockMovement {
  id: ID
  itemId: ID
  type: StockMovementType
  quantityChange: number // signed
  balanceAfter: number
  date: string
  reference: string
  note?: string
  performedBy: string
}

export const ASSET_CATEGORIES = ['Laptop', 'Monitor', 'Test Equipment', 'Phone', 'Printer', 'Furniture', 'Vehicle'] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSET_STATUSES = ['In Use', 'In Storage', 'Under Repair', 'Retired'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export interface Asset {
  id: ID
  tag: string
  name: string
  category: AssetCategory
  serialNumber: string
  status: AssetStatus
  assignedToId?: ID
  departmentId: ID
  purchaseDate: string
  costMinor: Minor
  location: WarehouseLocation
}

// ---------- Procurement ----------

export interface VendorEvaluation {
  quality: number // 1-5
  delivery: number
  price: number
  compliance: number
  evaluatedAt: string
  evaluatedBy: string
}

export interface Supplier {
  id: ID
  code: string
  name: string
  category: string
  contactName: string
  email: string
  phone: string
  city: string
  rating: number // 1-5
  active: boolean
  /** Vendor (goods) or subcontractor (services/labour). */
  kind?: 'Vendor' | 'Subcontractor'
  registration?: 'Approved' | 'Pending review' | 'Suspended'
  evaluation?: VendorEvaluation
}

export const PR_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Received'] as const
export type PurchaseRequestStatus = (typeof PR_STATUSES)[number]

export interface PurchaseRequestLine {
  id: ID
  description: string
  inventoryItemId?: ID
  quantity: number
  unitPriceMinor: Minor
}

export interface StatusHistoryEntry {
  status: PurchaseRequestStatus
  at: string
  by: string
  note?: string
}

export interface PurchaseRequest {
  id: ID
  code: string
  requesterId: ID // employee
  departmentId: ID
  supplierId: ID
  title: string
  justification: string
  lines: PurchaseRequestLine[]
  createdAt: string
  neededBy: string
  status: PurchaseRequestStatus
  rejectionReason?: string
  history: StatusHistoryEntry[]
}

// ---------- Finance ----------

export const EXPENSE_CATEGORIES = [
  'Payroll',
  'Rent & Utilities',
  'Licences & Cloud',
  'Travel',
  'Marketing',
  'Procurement',
  'Field Operations',
  'Professional Fees',
  'Training',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Overdue'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface Expense {
  id: ID
  code: string
  date: string
  departmentId: ID
  category: ExpenseCategory
  description: string
  payee: string
  amountMinor: Minor
  status: PaymentStatus
  purchaseRequestId?: ID
}

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface InvoiceLine {
  id: ID
  description: string
  quantity: number
  unitPriceMinor: Minor
}

export interface Customer {
  name: string
  email: string
  address: string
}

export interface Invoice {
  id: ID
  number: string
  customer: Customer
  issueDate: string
  dueDate: string
  paidDate?: string
  status: InvoiceStatus
  lines: InvoiceLine[]
  notes?: string
}

/** Derived (never stored): ledger-style view built from invoices and expenses. */
export interface Transaction {
  id: ID
  date: string
  direction: 'In' | 'Out'
  description: string
  counterparty: string
  category: string
  amountMinor: Minor
  reference: string
  sourceType: 'Invoice' | 'Expense'
  sourceId: ID
}

// ---------- Activity & notifications ----------

export type EntityType =
  | 'employee'
  | 'inventory'
  | 'asset'
  | 'purchaseRequest'
  | 'supplier'
  | 'expense'
  | 'invoice'
  | 'system'
  | 'sales'
  | 'project'
  | 'leave'
  | 'claim'
  | 'hr'
  | 'admin'
  | 'finance'

export interface ActivityEntry {
  id: ID
  at: string
  actor: string
  action: string
  entityType: EntityType
  entityId?: ID
  link?: string
  /** Department the action relates to, used to scope activity feeds. */
  departmentId?: ID
}

/** Who should see a notification. Executives (CEO/Administrator) see everything. */
export interface NotificationAudience {
  departmentIds?: ID[]
  userIds?: ID[]
}

export interface AppNotification {
  id: ID
  at: string
  title: string
  body: string
  /** User ids that have read it. */
  readBy: ID[]
  link?: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  /** Omitted = everyone. */
  audience?: NotificationAudience
}


// ---------- Partners & OEMs (Admin registry) ----------

export const PARTNER_TYPES = ['OEM', 'Distributor', 'Technology alliance'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

export interface Partner {
  id: ID
  name: string
  type: PartnerType
  focus: string
  tier: string
  status: 'Active' | 'Renewal due' | 'Lapsed'
  since: string
  renewalDate: string
  certifiedStaff: number
  contactName: string
  contactEmail: string
  /** Public source confirms the relationship; otherwise an example to replace. */
  verified: boolean
  notes?: string
}

// ---------- Sales / CRM ----------

export interface Contact {
  id: ID
  name: string
  company: string
  role: string
  email: string
  phone: string
  /** Client = existing customer; Prospect = not yet buying. */
  relationship: 'Client' | 'Prospect' | 'Partner'
  ownerUserId: ID
  city: string
}

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const LEAD_SOURCES = ['Referral', 'Website', 'Event', 'Partner / OEM', 'Cold outreach', 'Existing client'] as const

export interface Lead {
  id: ID
  company: string
  contactName: string
  email: string
  phone: string
  source: (typeof LEAD_SOURCES)[number]
  interest: string
  estValueMinor: Minor
  status: LeadStatus
  ownerUserId: ID
  createdAt: string
}

export const OPPORTUNITY_STAGES = ['Qualification', 'Needs analysis', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

export interface Handover {
  status: 'Pending' | 'Accepted'
  requestedAt: string
  requestedBy: string
  notes: string
  acceptedBy?: string
  projectId?: ID
}

export interface Opportunity {
  id: ID
  code: string
  name: string
  clientName: string
  serviceLine: string
  stage: OpportunityStage
  valueMinor: Minor
  expectedClose: string
  ownerUserId: ID
  oem?: string
  createdAt: string
  closedAt?: string
  lossReason?: string
  handover?: Handover
}

export const TENDER_TYPES = ['RFQ', 'Tender', 'EOI'] as const
export type TenderType = (typeof TENDER_TYPES)[number]
export const TENDER_STATUSES = ['Received', 'Bid / no-bid', 'Preparing', 'Submitted', 'Won', 'Lost', 'Declined'] as const
export type TenderStatus = (typeof TENDER_STATUSES)[number]

export interface Tender {
  id: ID
  ref: string
  type: TenderType
  title: string
  issuer: string
  receivedAt: string
  dueDate: string
  status: TenderStatus
  valueMinor: Minor
  ownerUserId: ID
}

export const PROPOSAL_STATUSES = ['Draft', 'In review', 'Submitted', 'Accepted', 'Declined'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export interface Milestone {
  id: ID
  name: string
  dueDate: string
  done: boolean
  doneAt?: string
}

export interface Proposal {
  id: ID
  code: string
  kind: 'Proposal' | 'Quotation'
  title: string
  clientName: string
  opportunityId?: ID
  ownerUserId: ID
  departmentId: ID
  lines: InvoiceLine[]
  milestones: Milestone[]
  status: ProposalStatus
  dueDate: string
  createdAt: string
  validityDays: number
  notes?: string
}

// ---------- Projects & tasks ----------

export const PROJECT_STATUSES = ['Pending approval', 'Planning', 'Active', 'On hold', 'Completed', 'Rejected'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectHealth = 'On track' | 'At risk' | 'Off track'

export interface Project {
  id: ID
  code: string
  name: string
  clientName: string
  departmentId: ID
  managerUserId: ID
  contractValueMinor: Minor
  budgetMinor: Minor
  costToDateMinor: Minor
  startDate: string
  endDate: string
  status: ProjectStatus
  health: ProjectHealth
  memberIds: ID[] // employees
  milestones: Milestone[]
  opportunityId?: ID
  createdAt: string
  approval?: { by: string; at: string; note?: string }
  rejectionReason?: string
}

export const TASK_STATUSES = ['To do', 'In progress', 'Done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface Task {
  id: ID
  projectId: ID
  title: string
  assigneeId: ID // employee
  startDate: string
  dueDate: string
  status: TaskStatus
  estimateHours: number
  milestoneId?: ID
  completedAt?: string
  completionNote?: string
  assignedBy: string
}

export interface ChangeRequest {
  id: ID
  code: string
  projectId: ID
  title: string
  description: string
  costImpactMinor: Minor
  daysImpact: number
  status: 'Pending' | 'Approved' | 'Rejected'
  raisedBy: string
  raisedByUserId: ID
  raisedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

export interface StatusReport {
  id: ID
  projectId: ID
  at: string
  author: string
  health: ProjectHealth
  percentComplete: number
  summary: string
  nextSteps: string
}

export interface TimesheetEntry {
  id: ID
  employeeId: ID
  date: string
  projectId: ID
  taskId?: ID
  hours: number
  note: string
}

// ---------- Leave & claims ----------

export const LEAVE_TYPES = ['Annual', 'Sick', 'Casual', 'Study', 'Compassionate'] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export interface LeaveRequest {
  id: ID
  employeeId: ID
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: ApprovalStatus
  createdAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

export const CLAIM_CATEGORIES = ['Transport', 'Fuel', 'Per diem', 'Client entertainment', 'Data & airtime', 'Site materials'] as const

export interface ExpenseClaim {
  id: ID
  code: string
  employeeId: ID
  date: string
  category: (typeof CLAIM_CATEGORIES)[number]
  description: string
  amountMinor: Minor
  projectId?: ID
  status: ApprovalStatus | 'Paid'
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

// ---------- Payroll (illustrative) ----------

export interface SalaryGrade {
  code: string
  name: string
  basicMinor: Minor
  housingMinor: Minor
  transportMinor: Minor
  otherAllowanceMinor: Minor
}

export interface PeriodClose {
  id: ID
  period: string // e.g. 2026-09, 2026-Q3, FY2025
  kind: 'Month' | 'Quarter' | 'Year'
  status: 'Open' | 'In progress' | 'Closed'
  checklist: Array<{ label: string; done: boolean }>
  closedBy?: string
  closedAt?: string
}

// ---------- HR ----------

export interface JobOpening {
  id: ID
  code: string
  title: string
  departmentId: ID
  openings: number
  status: 'Open' | 'Interviewing' | 'Offer made' | 'Filled' | 'On hold'
  postedAt: string
  hiringManagerUserId: ID
}

export const CANDIDATE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] as const
export type CandidateStage = (typeof CANDIDATE_STAGES)[number]

export interface Candidate {
  id: ID
  openingId: ID
  name: string
  email: string
  source: string
  stage: CandidateStage
  appliedAt: string
}

export interface LifecycleChecklist {
  id: ID
  kind: 'Onboarding' | 'Offboarding'
  employeeId: ID
  startDate: string
  items: Array<{ label: string; done: boolean }>
}

export interface KPI {
  name: string
  target: string
  weight: number // percent
  score?: number // 1-5
}

export interface Appraisal {
  id: ID
  employeeId: ID
  period: string
  reviewerId: ID // employee
  status: 'Not started' | 'Self review' | 'Manager review' | 'Completed'
  kpis: KPI[]
  overall?: number
  comments?: string
  completedAt?: string
}

export interface Certification {
  id: ID
  employeeId: ID
  name: string
  issuer: string
  issued: string
  expires?: string
}

export interface TrainingRecord {
  id: ID
  employeeId: ID
  course: string
  provider: string
  dueDate: string
  status: 'Enrolled' | 'In progress' | 'Completed'
}

export interface SkillRecord {
  id: ID
  employeeId: ID
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
}

// ---------- Admin ----------

export interface SoftwareLicence {
  id: ID
  product: string
  vendor: string
  category: string
  seats: number
  seatsUsed: number
  billing: 'Annual' | 'Monthly'
  costPerPeriodMinor: Minor
  renewalDate: string
  ownerUserId: ID
  status: 'Active' | 'Renewal due' | 'Expired' | 'Cancelled'
}

export interface Integration {
  id: ID
  name: string
  category: 'Email' | 'Payments' | 'Productivity' | 'Developer tools' | 'Identity'
  description: string
  connected: boolean
  lastSync?: string
  account?: string
}

export interface SecurityPolicy {
  passwordMinLength: number
  passwordExpiryDays: number
  mfaRequired: boolean
  ssoOnly: boolean
  sessionTimeoutMinutes: number
  lockoutAttempts: number
  ipRestriction: boolean
  updatedAt: string
  updatedBy: string
}

export interface BackupRecord {
  id: ID
  at: string
  kind: 'Automatic' | 'Manual'
  sizeKb: number
  status: 'Completed' | 'Failed'
  by: string
}

// ---------- Root demo state ----------

export interface DemoState {
  version: number
  seededAt: string
  organization: OrganizationProfile
  preferences: Preferences
  /** Signed-in demo user, or null when signed out. */
  currentUserId: ID | null
  departments: Department[]
  users: AppUser[]
  employees: Employee[]
  inventory: InventoryItem[]
  stockMovements: StockMovement[]
  assets: Asset[]
  suppliers: Supplier[]
  purchaseRequests: PurchaseRequest[]
  expenses: Expense[]
  invoices: Invoice[]
  activity: ActivityEntry[]
  notifications: AppNotification[]
  // ---- added for the EMOCOM role-based modules ----
  partners: Partner[]
  contacts: Contact[]
  leads: Lead[]
  opportunities: Opportunity[]
  tenders: Tender[]
  proposals: Proposal[]
  projects: Project[]
  tasks: Task[]
  changeRequests: ChangeRequest[]
  statusReports: StatusReport[]
  timesheets: TimesheetEntry[]
  leaveRequests: LeaveRequest[]
  expenseClaims: ExpenseClaim[]
  salaryGrades: SalaryGrade[]
  /** employeeId → salary grade code */
  employeeGrades: Record<ID, string>
  periodCloses: PeriodClose[]
  jobOpenings: JobOpening[]
  candidates: Candidate[]
  lifecycleChecklists: LifecycleChecklist[]
  appraisals: Appraisal[]
  certifications: Certification[]
  trainings: TrainingRecord[]
  skills: SkillRecord[]
  licences: SoftwareLicence[]
  integrations: Integration[]
  securityPolicy: SecurityPolicy
  backups: BackupRecord[]
}
