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
 * Access levels. Combined with the user's department they decide which
 * modules and records a person can see (see src/features/auth/permissions.ts).
 */
export const ACCESS_LEVELS = ['CEO', 'Administrator', 'Head of Department', 'Staff'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

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

export type EntityType = 'employee' | 'inventory' | 'asset' | 'purchaseRequest' | 'supplier' | 'expense' | 'invoice' | 'system'

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
}
