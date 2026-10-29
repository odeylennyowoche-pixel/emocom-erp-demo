/**
 * Pure state transitions for the demo data store.
 * Each function takes the current state and returns a new state (no mutation).
 * When a backend exists, each of these maps naturally onto an API call.
 */
import { APP_CONFIG } from '../config/app'
import { todayISO } from '../lib/dates'
import { nextCode, uid } from '../lib/utils'
import { TRANSITIONS, checkTransition, type PRAction } from '../features/procurement/workflow'
import type {
  ActivityEntry,
  AppNotification,
  AppUser,
  Asset,
  DemoState,
  Department,
  Employee,
  EntityType,
  Expense,
  InventoryItem,
  Invoice,
  OrganizationProfile,
  PaymentStatus,
  Preferences,
  PurchaseRequest,
  PurchaseRequestLine,
  AccessLevel,
  NotificationAudience,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types'
import { fullName, prTotal } from './selectors'
import { permissionsFor } from '../features/auth/permissions'

export class DomainError extends Error {}

export function currentUser(state: DemoState): AppUser {
  return state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
}

function now(): string {
  return new Date().toISOString()
}

function withActivity(state: DemoState, action: string, entityType: EntityType, entityId?: string, link?: string, departmentId?: string): DemoState {
  const entry: ActivityEntry = { id: uid('act'), at: now(), actor: currentUser(state).name, action, entityType, entityId, link, departmentId: departmentId ?? currentUser(state).departmentId }
  return { ...state, activity: [entry, ...state.activity].slice(0, 200) }
}

function withNotification(state: DemoState, n: Omit<AppNotification, 'id' | 'at' | 'readBy'>): DemoState {
  const entry: AppNotification = { ...n, id: uid('ntf'), at: now(), readBy: [currentUser(state).id] }
  return { ...state, notifications: [entry, ...state.notifications].slice(0, 50) }
}

// ---------- Employees ----------

export type EmployeeInput = Omit<Employee, 'id' | 'employeeNo'>

export function addEmployee(state: DemoState, input: EmployeeInput): { state: DemoState; record: Employee } {
  if (state.employees.some((e) => e.email.toLowerCase() === input.email.toLowerCase())) {
    throw new DomainError('An employee with this email already exists.')
  }
  const record: Employee = { ...input, id: uid('emp'), employeeNo: nextCode(state.employees.map((e) => e.employeeNo), 'EMP-') }
  let next = { ...state, employees: [record, ...state.employees] }
  next = withActivity(next, `added employee ${fullName(record)}`, 'employee', record.id, `/employees/${record.id}`, record.departmentId)
  return { state: next, record }
}

export function updateEmployee(state: DemoState, id: string, input: EmployeeInput): DemoState {
  if (state.employees.some((e) => e.id !== id && e.email.toLowerCase() === input.email.toLowerCase())) {
    throw new DomainError('Another employee already uses this email.')
  }
  const existing = state.employees.find((e) => e.id === id)
  if (!existing) throw new DomainError('Employee not found.')
  const updated: Employee = { ...existing, ...input }
  const next = { ...state, employees: state.employees.map((e) => (e.id === id ? updated : e)) }
  return withActivity(next, `updated employee ${fullName(updated)}`, 'employee', id, `/employees/${id}`, updated.departmentId)
}

export function employeeReferences(state: DemoState, id: string): string[] {
  const refs: string[] = []
  const prs = state.purchaseRequests.filter((p) => p.requesterId === id).length
  if (prs) refs.push(`${prs} purchase request(s)`)
  const assets = state.assets.filter((a) => a.assignedToId === id).length
  if (assets) refs.push(`${assets} assigned asset(s)`)
  if (state.users.some((u) => u.employeeId === id)) refs.push('a system user account')
  if (state.departments.some((d) => d.headEmployeeId === id)) refs.push('a department head role')
  return refs
}

export function deleteEmployee(state: DemoState, id: string): DemoState {
  const refs = employeeReferences(state, id)
  if (refs.length) throw new DomainError(`Cannot delete: linked to ${refs.join(', ')}. Set the status to Inactive instead.`)
  const e = state.employees.find((x) => x.id === id)
  const next = { ...state, employees: state.employees.filter((x) => x.id !== id) }
  return withActivity(next, `deleted employee record ${fullName(e)}`, 'employee')
}

// ---------- Inventory ----------

export type ItemInput = Omit<InventoryItem, 'id' | 'code' | 'updatedAt'>

export function addItem(state: DemoState, input: ItemInput): { state: DemoState; record: InventoryItem } {
  const record: InventoryItem = { ...input, id: uid('itm'), code: nextCode(state.inventory.map((i) => i.code), 'ITM-'), updatedAt: now() }
  const movements: StockMovement[] =
    input.quantity > 0
      ? [{ id: uid('mov'), itemId: record.id, type: 'Adjustment', quantityChange: input.quantity, balanceAfter: input.quantity, date: todayISO(), reference: 'OPENING', note: 'Opening balance on item creation', performedBy: currentUser(state).name }]
      : []
  let next = { ...state, inventory: [record, ...state.inventory], stockMovements: [...state.stockMovements, ...movements] }
  next = withActivity(next, `added inventory item ${record.name}`, 'inventory', record.id, `/inventory/items/${record.id}`)
  return { state: next, record }
}

/** Updates descriptive fields. Quantity changes must go through adjustStock. */
export function updateItem(state: DemoState, id: string, input: Omit<ItemInput, 'quantity'>): DemoState {
  const existing = state.inventory.find((i) => i.id === id)
  if (!existing) throw new DomainError('Item not found.')
  const updated: InventoryItem = { ...existing, ...input, quantity: existing.quantity, updatedAt: now() }
  const next = { ...state, inventory: state.inventory.map((i) => (i.id === id ? updated : i)) }
  return withActivity(next, `updated inventory item ${updated.name}`, 'inventory', id, `/inventory/items/${id}`)
}

export interface StockAdjustmentInput {
  itemId: string
  type: StockMovementType
  /** Receipt/Issue: positive quantity moved. Adjustment: the new counted quantity. */
  quantity: number
  reference: string
  note?: string
}

function applyStockChange(state: DemoState, itemId: string, change: number, type: StockMovementType, reference: string, note?: string): DemoState {
  const item = state.inventory.find((i) => i.id === itemId)
  if (!item) throw new DomainError('Item not found.')
  if (!Number.isInteger(change)) throw new DomainError('Quantities must be whole numbers.')
  const balance = item.quantity + change
  if (balance < 0) throw new DomainError(`Insufficient stock: only ${item.quantity} ${item.unit}(s) available.`)
  const movement: StockMovement = { id: uid('mov'), itemId, type, quantityChange: change, balanceAfter: balance, date: todayISO(), reference, note, performedBy: currentUser(state).name }
  return {
    ...state,
    inventory: state.inventory.map((i) => (i.id === itemId ? { ...i, quantity: balance, updatedAt: now() } : i)),
    stockMovements: [...state.stockMovements, movement],
  }
}

export function adjustStock(state: DemoState, input: StockAdjustmentInput): DemoState {
  const item = state.inventory.find((i) => i.id === input.itemId)
  if (!item) throw new DomainError('Item not found.')
  if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new DomainError('Enter a whole, non-negative quantity.')
  const change = input.type === 'Receipt' ? input.quantity : input.type === 'Issue' ? -input.quantity : input.quantity - item.quantity
  if (change === 0) throw new DomainError('This adjustment does not change the stock level.')
  let next = applyStockChange(state, input.itemId, change, input.type, input.reference || input.type.toUpperCase(), input.note)
  const verb = input.type === 'Receipt' ? 'received' : input.type === 'Issue' ? 'issued' : 'adjusted'
  next = withActivity(next, `${verb} ${Math.abs(change)} × ${item.name}`, 'inventory', item.id, `/inventory/items/${item.id}`)
  const updated = next.inventory.find((i) => i.id === item.id)!
  if (updated.quantity <= updated.reorderLevel && item.quantity > item.reorderLevel) {
    next = withNotification(next, { title: `${item.name} is low on stock`, body: `${updated.quantity} ${item.unit}(s) left (reorder level ${item.reorderLevel}).`, link: `/inventory/items/${item.id}`, tone: 'danger', audience: procurementAudience(next) })
  }
  return next
}

export function deleteItem(state: DemoState, id: string): DemoState {
  const used = state.purchaseRequests.some((p) => p.lines.some((l) => l.inventoryItemId === id))
  if (used) throw new DomainError('Cannot delete: this item appears on purchase requests.')
  const item = state.inventory.find((i) => i.id === id)
  const next = { ...state, inventory: state.inventory.filter((i) => i.id !== id), stockMovements: state.stockMovements.filter((m) => m.itemId !== id) }
  return withActivity(next, `deleted inventory item ${item?.name ?? ''}`, 'inventory')
}

// ---------- Assets ----------

export type AssetInput = Omit<Asset, 'id' | 'tag'>

export function addAsset(state: DemoState, input: AssetInput): { state: DemoState; record: Asset } {
  const record: Asset = { ...input, id: uid('ast'), tag: nextCode(state.assets.map((a) => a.tag), 'AST-') }
  const next = withActivity({ ...state, assets: [record, ...state.assets] }, `registered asset ${record.tag} (${record.name})`, 'asset', record.id, `/inventory?tab=assets`)
  return { state: next, record }
}

export function updateAsset(state: DemoState, id: string, input: AssetInput): DemoState {
  const next = { ...state, assets: state.assets.map((a) => (a.id === id ? { ...a, ...input } : a)) }
  const a = next.assets.find((x) => x.id === id)
  return withActivity(next, `updated asset ${a?.tag ?? ''}`, 'asset', id, `/inventory?tab=assets`)
}

// ---------- Suppliers ----------

export type SupplierInput = Omit<Supplier, 'id' | 'code'>

export function addSupplier(state: DemoState, input: SupplierInput): { state: DemoState; record: Supplier } {
  const record: Supplier = { ...input, id: uid('sup'), code: nextCode(state.suppliers.map((s) => s.code), 'SUP-', 3) }
  const next = withActivity({ ...state, suppliers: [...state.suppliers, record] }, `added supplier ${record.name}`, 'supplier', record.id, '/procurement?tab=suppliers')
  return { state: next, record }
}

export function updateSupplier(state: DemoState, id: string, input: SupplierInput): DemoState {
  const next = { ...state, suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...input } : s)) }
  return withActivity(next, `updated supplier ${input.name}`, 'supplier', id, '/procurement?tab=suppliers')
}

// ---------- Purchase requests ----------

export interface PurchaseRequestInput {
  requesterId: string
  departmentId: string
  supplierId: string
  title: string
  justification: string
  neededBy: string
  lines: Omit<PurchaseRequestLine, 'id'>[]
}

export function savePurchaseRequest(
  state: DemoState,
  input: PurchaseRequestInput,
  options: { submit: boolean; id?: string },
): { state: DemoState; record: PurchaseRequest } {
  if (input.lines.length === 0) throw new DomainError('Add at least one line item.')
  const actor = currentUser(state).name
  const lines = input.lines.map((l) => ({ ...l, id: uid('prl') }))
  let record: PurchaseRequest
  let next: DemoState
  if (options.id) {
    const existing = state.purchaseRequests.find((p) => p.id === options.id)
    if (!existing) throw new DomainError('Request not found.')
    if (existing.status !== 'Draft') throw new DomainError('Only draft requests can be edited.')
    record = { ...existing, ...input, lines }
    next = { ...state, purchaseRequests: state.purchaseRequests.map((p) => (p.id === record.id ? record : p)) }
  } else {
    const today = todayISO()
    const prefix = `PR-${today.slice(0, 4)}-`
    record = {
      ...input,
      lines,
      id: uid('pr'),
      code: nextCode(state.purchaseRequests.map((p) => p.code), prefix),
      createdAt: today,
      status: 'Draft',
      history: [{ status: 'Draft', at: now(), by: actor }],
    }
    next = { ...state, purchaseRequests: [record, ...state.purchaseRequests] }
    next = withActivity(next, `created purchase request ${record.code}`, 'purchaseRequest', record.id, `/procurement/requests/${record.id}`, record.departmentId)
  }
  if (options.submit) {
    next = transitionPurchaseRequest(next, record.id, 'submit')
    record = next.purchaseRequests.find((p) => p.id === record.id)!
  }
  return { state: next, record }
}

export function transitionPurchaseRequest(state: DemoState, id: string, action: PRAction, note?: string): DemoState {
  const pr = state.purchaseRequests.find((p) => p.id === id)
  if (!pr) throw new DomainError('Request not found.')
  const user = currentUser(state)
  const decision = checkTransition(pr, action, permissionsFor(user, state.departments))
  if (!decision.allowed) throw new DomainError(decision.reason ?? 'This action is not allowed.')
  const def = TRANSITIONS[action]
  if (def.requiresNote && !note?.trim()) throw new DomainError('A reason is required.')

  const updated: PurchaseRequest = {
    ...pr,
    status: def.to,
    rejectionReason: action === 'reject' ? note!.trim() : action === 'reopen' ? undefined : pr.rejectionReason,
    history: [...pr.history, { status: def.to, at: now(), by: user.name, note: note?.trim() || undefined }],
  }
  let next: DemoState = { ...state, purchaseRequests: state.purchaseRequests.map((p) => (p.id === id ? updated : p)) }

  if (action === 'receive') {
    // Receiving goods updates stock and records a payable procurement expense.
    for (const line of pr.lines) {
      if (line.inventoryItemId && next.inventory.some((i) => i.id === line.inventoryItemId)) {
        next = applyStockChange(next, line.inventoryItemId, line.quantity, 'Receipt', pr.code, 'Goods received against purchase request')
      }
    }
    const supplier = state.suppliers.find((s) => s.id === pr.supplierId)
    const expense: Expense = {
      id: uid('exp'),
      code: nextCode(next.expenses.map((e) => e.code), 'EXP-', 5),
      date: todayISO(),
      departmentId: pr.departmentId,
      category: 'Procurement',
      description: `${pr.title} (${pr.code})`,
      payee: supplier?.name ?? 'Supplier',
      amountMinor: prTotal(pr),
      status: 'Pending',
      purchaseRequestId: pr.id,
    }
    next = { ...next, expenses: [expense, ...next.expenses] }
  }

  const link = `/procurement/requests/${id}`
  next = withActivity(next, `${def.verb} ${pr.code}`, 'purchaseRequest', id, link, pr.departmentId)
  const tone = action === 'approve' ? 'success' : action === 'reject' ? 'danger' : 'info'
  // The requester's department always hears about it; Procurement is told once goods can be ordered or arrive.
  const requesterUser = next.users.find((u) => u.employeeId === pr.requesterId)
  const prl = next.departments.find((d) => d.code === 'PRL')
  const audience: NotificationAudience = {
    departmentIds: [pr.departmentId, ...(prl && (action === 'approve' || action === 'receive') ? [prl.id] : [])],
    userIds: requesterUser ? [requesterUser.id] : [],
  }
  next = withNotification(next, {
    title: `${pr.code} ${def.verb}`,
    body: action === 'reject' ? `Reason: ${note}` : `${pr.title} is now ${def.to}.`,
    link,
    tone,
    audience,
  })
  return next
}

// ---------- Finance ----------

export type ExpenseInput = Omit<Expense, 'id' | 'code'>

export function addExpense(state: DemoState, input: ExpenseInput): { state: DemoState; record: Expense } {
  const record: Expense = { ...input, id: uid('exp'), code: nextCode(state.expenses.map((e) => e.code), 'EXP-', 5) }
  const next = withActivity({ ...state, expenses: [record, ...state.expenses] }, `recorded expense ${record.code}`, 'expense', record.id, '/finance?tab=expenses', record.departmentId)
  return { state: next, record }
}

export function setExpenseStatus(state: DemoState, id: string, status: PaymentStatus): DemoState {
  const exp = state.expenses.find((e) => e.id === id)
  if (!exp) throw new DomainError('Expense not found.')
  if (exp.status === status) throw new DomainError(`Expense is already ${status}.`)
  const next = { ...state, expenses: state.expenses.map((e) => (e.id === id ? { ...e, status } : e)) }
  return withActivity(next, `marked expense ${exp.code} as ${status.toLowerCase()}`, 'expense', id, '/finance?tab=expenses', exp.departmentId)
}

export function setInvoiceStatus(state: DemoState, id: string, status: Invoice['status']): DemoState {
  const inv = state.invoices.find((i) => i.id === id)
  if (!inv) throw new DomainError('Invoice not found.')
  const allowed: Record<Invoice['status'], Invoice['status'][]> = { Draft: ['Sent'], Sent: ['Paid', 'Overdue'], Overdue: ['Paid'], Paid: [] }
  if (!allowed[inv.status].includes(status)) throw new DomainError(`Cannot change a ${inv.status} invoice to ${status}.`)
  const updated: Invoice = { ...inv, status, paidDate: status === 'Paid' ? todayISO() : inv.paidDate }
  let next = { ...state, invoices: state.invoices.map((i) => (i.id === id ? updated : i)) }
  next = withActivity(next, status === 'Paid' ? `recorded payment for ${inv.number}` : `marked ${inv.number} as ${status.toLowerCase()}`, 'invoice', id, `/finance/invoices/${id}`)
  return next
}

// ---------- Settings ----------

export function updateOrganization(state: DemoState, org: OrganizationProfile): DemoState {
  return withActivity({ ...state, organization: org }, 'updated the organisation profile', 'system', undefined, '/settings')
}

export function updatePreferences(state: DemoState, prefs: Partial<Preferences>): DemoState {
  return { ...state, preferences: { ...state.preferences, ...prefs } }
}

export function saveDepartment(state: DemoState, input: Omit<Department, 'id'>, id?: string): DemoState {
  const code = input.code.trim().toUpperCase()
  if (state.departments.some((d) => d.id !== id && d.code === code)) throw new DomainError('Department code already exists.')
  if (id) {
    const next = { ...state, departments: state.departments.map((d) => (d.id === id ? { ...d, ...input, code } : d)) }
    return withActivity(next, `updated department ${input.name}`, 'system', undefined, '/settings?tab=departments')
  }
  const record: Department = { ...input, code, id: uid('dept') }
  return withActivity({ ...state, departments: [...state.departments, record] }, `created department ${input.name}`, 'system', undefined, '/settings?tab=departments')
}

export function setUserLevel(state: DemoState, userId: string, level: AccessLevel): DemoState {
  const user = state.users.find((u) => u.id === userId)
  if (!user) throw new DomainError('User not found.')
  if (userId === state.currentUserId) throw new DomainError('You cannot change your own access level.')
  const next = { ...state, users: state.users.map((u) => (u.id === userId ? { ...u, level } : u)) }
  return withActivity(next, `changed ${user.name}'s access level to ${level}`, 'system', undefined, '/settings?tab=users')
}

export function setUserStatus(state: DemoState, userId: string, status: AppUser['status']): DemoState {
  if (userId === state.currentUserId && status === 'Suspended') throw new DomainError('You cannot suspend the account you are signed in with.')
  const user = state.users.find((u) => u.id === userId)
  const next = { ...state, users: state.users.map((u) => (u.id === userId ? { ...u, status } : u)) }
  return withActivity(next, `${status === 'Active' ? 'reactivated' : 'suspended'} the account of ${user?.name ?? ''}`, 'system', undefined, '/settings?tab=users')
}

// ---------- Demo sign-in (NOT real authentication) ----------

export function signIn(state: DemoState, username: string, password: string): DemoState {
  const user = state.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())
  if (!user || password !== APP_CONFIG.demoPassword) throw new DomainError('Incorrect username or password.')
  if (user.status !== 'Active') throw new DomainError('This account is suspended. Ask the administrator to reactivate it.')
  return { ...state, currentUserId: user.id, users: state.users.map((u) => (u.id === user.id ? { ...u, lastActiveAt: now() } : u)) }
}

export function signOut(state: DemoState): DemoState {
  return { ...state, currentUserId: null }
}

// ---------- Notifications ----------

export function markNotificationRead(state: DemoState, id: string): DemoState {
  const me = currentUser(state).id
  return { ...state, notifications: state.notifications.map((n) => (n.id === id && !n.readBy.includes(me) ? { ...n, readBy: [...n.readBy, me] } : n)) }
}

export function markAllNotificationsRead(state: DemoState, ids: string[]): DemoState {
  const me = currentUser(state).id
  return { ...state, notifications: state.notifications.map((n) => (ids.includes(n.id) && !n.readBy.includes(me) ? { ...n, readBy: [...n.readBy, me] } : n)) }
}

function procurementAudience(state: DemoState): NotificationAudience {
  return { departmentIds: state.departments.filter((d) => d.code === 'PRL' || d.code === 'ENG').map((d) => d.id) }
}
