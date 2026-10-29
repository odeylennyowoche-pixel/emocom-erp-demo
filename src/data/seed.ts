/**
 * Deterministic generator for the fictional demonstration dataset.
 * Dates are generated relative to "today" so the demo always looks current.
 * Records are related: purchase requests reference employees, departments,
 * suppliers and inventory items; received requests create stock receipts and
 * procurement expenses; budgets are derived from generated spending.
 */
import { APP_CONFIG } from '../config/app'
import { addDays, addMonths, monthKey, todayISO } from '../lib/dates'
import { lineTotal, sumMinor } from '../lib/money'
import type {
  ActivityEntry,
  AppNotification,
  AppUser,
  Asset,
  DemoState,
  Department,
  Employee,
  EmploymentStatus,
  Expense,
  InventoryItem,
  Invoice,
  PaymentStatus,
  PurchaseRequest,
  PurchaseRequestStatus,
  StatusHistoryEntry,
  StockMovement,
  Supplier,
} from '../types'
import { WAREHOUSE_LOCATIONS } from '../types'
import { createWorkSeed } from './seedWork'
import {
  ASSET_MODEL_SEEDS,
  CUSTOMER_SEEDS,
  DEPARTMENT_SEEDS,
  FIRST_NAMES,
  INVOICE_SERVICES,
  ITEM_SEEDS,
  LAST_NAMES,
  LOCATIONS,
  PR_TEMPLATES,
  RECURRING_EXPENSES,
  REJECTION_REASONS,
  SUPPLIER_SEEDS,
  USER_SEEDS,
  type PRTemplate,
} from './seedCatalog'

const MINOR = APP_CONFIG.minorUnitsPerMajor

/** A large request above the Manager limit, so only an Administrator can approve it. */
const BIG_REQUEST: PRTemplate = {
  title: 'Laptops for new engineering hires',
  departmentCode: 'ENG',
  supplierCode: 'SUP-011',
  serviceLine: { description: 'Business laptops (16GB RAM, 512GB SSD) with 3-year warranty', priceMajor: 1_650_000, quantity: 15 },
}

/** mulberry32 — tiny deterministic PRNG so every reset produces the same data. */
function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** Random major amount rounded to `step`, returned in minor units. */
    money: (minMajor: number, maxMajor: number, step = 1000) => {
      const v = minMajor + next() * (maxMajor - minMajor)
      return Math.round(v / step) * step * MINOR
    },
  }
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const iso = (date: string, hour = 10, minute = 0) => `${date}T${pad(hour, 2)}:${pad(minute, 2)}:00.000Z`

export function createSeedState(today = todayISO()): DemoState {
  const rng = createRng(20261030)

  // ---------- Departments & employees ----------
  const departments: Department[] = DEPARTMENT_SEEDS.map((d) => ({
    id: `dept_${d.code.toLowerCase()}`,
    code: d.code,
    name: d.name,
    annualBudgetMinor: 0, // filled after expenses are generated
  }))
  const deptByCode = new Map(departments.map((d) => [d.code, d]))

  const employees: Employee[] = []
  const usedEmails = new Set<string>()
  const usedNames = new Set<string>()
  let empSeq = 0
  for (const dSeed of DEPARTMENT_SEEDS) {
    const dept = deptByCode.get(dSeed.code)!
    for (let i = 0; i < dSeed.headcount; i++) {
      empSeq++
      // pick a first/last name combination not used yet so every person is distinct
      let firstName = FIRST_NAMES[(empSeq * 7 + i * 3) % FIRST_NAMES.length]
      let lastName = LAST_NAMES[(empSeq * 11 + i * 5 + dSeed.code.length) % LAST_NAMES.length]
      for (let shift = 1; usedNames.has(`${firstName} ${lastName}`); shift++) {
        firstName = FIRST_NAMES[(empSeq * 7 + i * 3 + shift) % FIRST_NAMES.length]
        lastName = LAST_NAMES[(empSeq * 11 + i * 5 + dSeed.code.length + shift * 3) % LAST_NAMES.length]
      }
      usedNames.add(`${firstName} ${lastName}`)
      let email = `${firstName}.${lastName}`.toLowerCase() + '@emocom.example'
      let n = 2
      while (usedEmails.has(email)) email = `${firstName}.${lastName}${n++}`.toLowerCase() + '@emocom.example'
      usedEmails.add(email)
      const isHead = i === 0
      // joining dates spread over ~8 years; a few in the last 6 months
      const joinDate = empSeq % 9 === 0 ? addDays(today, -rng.int(10, 170)) : addDays(today, -rng.int(200, 2900))
      const roll = rng.next()
      const status: EmploymentStatus = isHead ? 'Active' : roll < 0.07 ? 'On Leave' : roll < 0.12 ? 'Inactive' : 'Active'
      employees.push({
        id: `emp_${pad(empSeq, 4)}`,
        employeeNo: `EMP-${pad(empSeq, 4)}`,
        firstName,
        lastName,
        email,
        phone: `+234 800 ${pad(rng.int(100, 999), 3)} ${pad(rng.int(1000, 9999), 4)}`,
        departmentId: dept.id,
        jobTitle: isHead ? dSeed.headTitle : rng.pick(dSeed.titles),
        status,
        employmentType: isHead ? 'Full-time' : rng.chance(0.82) ? 'Full-time' : rng.chance(0.6) ? 'Contract' : 'Intern',
        joinDate,
        location: dSeed.code === 'ENG' || dSeed.code === 'PMO' || dSeed.code === 'PRL' ? rng.pick(LOCATIONS) : rng.chance(0.75) ? 'Lekki HQ' : rng.pick(LOCATIONS),
      })
      if (isHead) dept.headEmployeeId = `emp_${pad(empSeq, 4)}`
    }
  }
  // managers: each non-head reports to their department head
  for (const e of employees) {
    const head = departments.find((d) => d.id === e.departmentId)?.headEmployeeId
    if (head && head !== e.id) e.managerId = head
  }
  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : 'Unknown'
  }

  // ---------- Users (one demo login per person) ----------
  const users: AppUser[] = USER_SEEDS.map((u, i) => {
    const dept = deptByCode.get(u.departmentCode)!
    const inDept = employees.filter((e) => e.departmentId === dept.id && e.status === 'Active')
    const emp = u.pick === 'head' ? inDept[0] : inDept[u.pick] ?? inDept[inDept.length - 1]
    if (u.title) emp.jobTitle = u.title
    emp.employmentType = 'Full-time'
    return {
      id: `usr_${pad(i + 1, 2)}`,
      username: u.username,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      title: emp.jobTitle,
      level: u.level,
      departmentId: dept.id,
      employeeId: emp.id,
      status: 'Active',
      lastActiveAt: iso(addDays(today, -rng.int(0, 3)), rng.int(8, 17), rng.int(0, 59)),
    }
  })
  const userByName = (username: string) => users.find((u) => u.username === username)!
  const ceoUser = userByName('ceo')
  const headUserOf = (deptId: string) => users.find((u) => u.departmentId === deptId && departments.find((d) => d.id === deptId)?.headEmployeeId === u.employeeId) ?? ceoUser
  const staffUserOf = (deptId: string) => users.find((u) => u.departmentId === deptId && (u.level === 'Staff' || u.level === 'Sales'))

  // ---------- Suppliers ----------
  const suppliers: Supplier[] = SUPPLIER_SEEDS.map((s, i) => {
    const first = FIRST_NAMES[(i * 5 + 3) % FIRST_NAMES.length]
    const last = LAST_NAMES[(i * 7 + 2) % LAST_NAMES.length]
    return {
      id: `sup_${pad(i + 1, 3)}`,
      code: s.code,
      name: s.name,
      category: s.category,
      contactName: `${first} ${last}`,
      email: `sales@${s.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 14)}.example`,
      phone: `+234 801 ${pad(rng.int(100, 999), 3)} ${pad(rng.int(1000, 9999), 4)}`,
      city: s.city,
      rating: rng.int(3, 5),
      active: i !== 8,
    }
  })
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s]))

  // ---------- Inventory items (quantities finalised after movements) ----------
  const inventory: InventoryItem[] = ITEM_SEEDS.map((s, i) => ({
    id: `itm_${pad(i + 1, 3)}`,
    code: `ITM-${pad(1001 + i, 4)}`,
    name: s.name,
    category: s.category,
    unit: s.unit,
    quantity: 0,
    reorderLevel: s.reorderLevel,
    unitCostMinor: s.unitCostMajor * MINOR,
    location: WAREHOUSE_LOCATIONS[i % 3 === 0 ? 1 : i % 5 === 0 ? 2 : i % 7 === 0 ? 3 : 0],
    preferredSupplierId: supplierByCode.get(s.supplierCode)?.id,
    updatedAt: iso(today, 9),
  }))
  const itemByName = new Map(inventory.map((it) => [it.name, it]))

  // ---------- Purchase requests ----------
  const purchaseRequests: PurchaseRequest[] = []
  const procurementOfficer = userByName('finance.accountant')
  const prCount = 30
  // Heads, CEO and admin don't raise requests in the seed, so they can approve them.
  const approverEmployeeIds = new Set(users.filter((u) => u.level !== 'Staff' && u.level !== 'Sales').map((u) => u.employeeId))
  // The newest requests get explicit statuses so the demo always has work in the approval queue.
  // One pending request per department where possible, so every head has something to approve.
  const RECENT: Array<{ status: PurchaseRequestStatus; title?: string }> = [
    { status: 'Pending Approval', title: 'Demo kit for client presentations' },
    { status: 'Draft', title: 'Fibre modules and patch cords' },
    { status: 'Pending Approval' }, // BIG_REQUEST — only the CEO can approve
    { status: 'Pending Approval', title: 'CCTV and NVR for client site' },
    { status: 'Approved', title: 'GPS trackers for fleet management client' },
    { status: 'Pending Approval', title: 'Managed print toner restock' },
    { status: 'Pending Approval', title: 'Safety gear for tower climbs' },
    { status: 'Pending Approval', title: 'Copier paper for head office' },
    { status: 'Pending Approval', title: 'Fleet vehicle servicing' },
    { status: 'Approved', title: 'Wi-Fi rollout stock for bank branches' },
  ]
  for (let i = 0; i < prCount; i++) {
    const fromEnd = prCount - 1 - i
    const recent = fromEnd < RECENT.length ? RECENT.at(fromEnd) : undefined
    const tpl = fromEnd === 2 ? BIG_REQUEST : recent?.title ? PR_TEMPLATES.find((t) => t.title === recent.title)! : PR_TEMPLATES[i % PR_TEMPLATES.length]
    const dept = deptByCode.get(tpl.departmentCode)!
    const deptEmps = employees.filter((e) => e.departmentId === dept.id && e.status !== 'Inactive' && !approverEmployeeIds.has(e.id))
    const staffUser = staffUserOf(dept.id)
    const staffEmp = staffUser && employees.find((e) => e.id === staffUser.employeeId)
    // demo staff accounts own some requests so "My requests" is populated
    const requester = staffEmp && (i % 3 === 0 || fromEnd < RECENT.length) ? staffEmp : deptEmps[(i * 3) % deptEmps.length]
    // older requests first; the newest ones are within the last 2 weeks
    const daysAgo = Math.max(1, Math.round(((prCount - i) / prCount) * 175) - rng.int(0, 4))
    const createdAt = addDays(today, -daysAgo)
    const lines = tpl.itemNames
      ? tpl.itemNames.map((name, li) => {
          const item = itemByName.get(name)!
          const qty = item.unitCostMinor >= 100_000 * MINOR ? rng.int(2, 5) : item.name.startsWith('Diesel') ? rng.int(8, 16) * 100 : rng.int(10, 40)
          return { id: `prl_${i}_${li}`, description: item.name, inventoryItemId: item.id, quantity: qty, unitPriceMinor: item.unitCostMinor }
        })
      : [{ id: `prl_${i}_0`, description: tpl.serviceLine!.description, quantity: tpl.serviceLine!.quantity ?? rng.int(3, 12), unitPriceMinor: tpl.serviceLine!.priceMajor * MINOR }]

    let status: PurchaseRequestStatus
    if (recent) status = recent.status
    else if (daysAgo > 60) status = rng.chance(0.85) ? 'Received' : 'Rejected'
    else status = rng.pick(['Approved', 'Received', 'Received', 'Rejected'] as const)

    const reqName = empName(requester.id)
    const total = sumMinor(lines.map((l) => lineTotal(l.quantity, l.unitPriceMinor)))
    const approverName = total > 5_000_000 * MINOR ? ceoUser.name : headUserOf(dept.id).name
    const history: StatusHistoryEntry[] = [{ status: 'Draft', at: iso(createdAt, 9, 15), by: reqName }]
    if (status !== 'Draft') history.push({ status: 'Pending Approval', at: iso(createdAt, 9, 40), by: reqName, note: 'Submitted for approval' })
    let rejectionReason: string | undefined
    if (status === 'Approved' || status === 'Received') history.push({ status: 'Approved', at: iso(addDays(createdAt, rng.int(1, 3)), 14, 5), by: approverName })
    if (status === 'Rejected') {
      rejectionReason = rng.pick(REJECTION_REASONS)
      history.push({ status: 'Rejected', at: iso(addDays(createdAt, rng.int(1, 4)), 15, 20), by: headUserOf(dept.id).name, note: rejectionReason })
    }
    if (status === 'Received') history.push({ status: 'Received', at: iso(addDays(createdAt, rng.int(6, 14)), 11, 30), by: procurementOfficer.name, note: 'Goods received in full' })

    purchaseRequests.push({
      id: `pr_${pad(i + 1, 4)}`,
      code: `PR-${createdAt.slice(0, 4)}-${pad(i + 1, 4)}`,
      requesterId: requester.id,
      departmentId: dept.id,
      supplierId: supplierByCode.get(tpl.supplierCode)!.id,
      title: tpl.title,
      justification: `${tpl.title} required to support ${dept.name.toLowerCase()} activities for the period.`,
      lines,
      createdAt,
      neededBy: addDays(createdAt, rng.int(10, 30)),
      status,
      rejectionReason,
      history,
    })
  }

  // ---------- Stock movements (forward simulation) ----------
  const stockMovements: StockMovement[] = []
  const start = addMonths(today, -11)
  inventory.forEach((item, idx) => {
    const seed = ITEM_SEEDS[idx]
    type Ev = Omit<StockMovement, 'id' | 'balanceAfter'>
    const events: Ev[] = []
    const opening = seed.reorderLevel * rng.int(3, 5)
    events.push({ itemId: item.id, type: 'Adjustment', quantityChange: opening, date: addDays(start, -1), reference: 'OPENING', note: 'Opening balance (stock count)', performedBy: 'System' })
    // receipts from received purchase requests
    for (const pr of purchaseRequests) {
      if (pr.status !== 'Received') continue
      for (const l of pr.lines) {
        if (l.inventoryItemId !== item.id) continue
        const at = pr.history.find((h) => h.status === 'Received')!.at.slice(0, 10)
        events.push({ itemId: item.id, type: 'Receipt', quantityChange: l.quantity, date: at, reference: pr.code, note: 'Goods received against purchase request', performedBy: procurementOfficer.name })
      }
    }
    // periodic issues to departments
    const issues = rng.int(4, 8)
    for (let k = 0; k < issues; k++) {
      const date = addDays(start, rng.int(5, 330))
      const qty = Math.max(1, Math.round(seed.reorderLevel * (0.3 + rng.next() * 0.6)))
      const dept = rng.pick(departments)
      events.push({ itemId: item.id, type: 'Issue', quantityChange: -qty, date, reference: `ISS-${pad(rng.int(1000, 9999), 4)}`, note: `Issued to ${dept.name}`, performedBy: procurementOfficer.name })
    }
    events.sort((a, b) => a.date.localeCompare(b.date))
    let balance = 0
    const finalEvents: StockMovement[] = []
    for (const ev of events) {
      let change = ev.quantityChange
      if (balance + change < 0) change = -balance
      if (change === 0) continue
      balance += change
      finalEvents.push({ ...ev, quantityChange: change, balanceAfter: balance, id: `mov_${item.id}_${finalEvents.length}` })
    }
    // shape final stock to the intended status for a realistic alert mix
    const target = seed.target === 'out' ? 0 : seed.target === 'low' ? Math.max(1, Math.floor(seed.reorderLevel * 0.6)) : Math.max(balance, seed.reorderLevel * 2)
    if (target !== balance) {
      const change = target - balance
      balance = target
      finalEvents.push({
        id: `mov_${item.id}_${finalEvents.length}`,
        itemId: item.id,
        type: change > 0 ? 'Receipt' : 'Issue',
        quantityChange: change,
        balanceAfter: balance,
        date: addDays(today, -rng.int(1, 9)),
        reference: change > 0 ? `GRN-${pad(rng.int(1000, 9999), 4)}` : `ISS-${pad(rng.int(1000, 9999), 4)}`,
        note: change > 0 ? 'Direct receipt' : `Issued to ${rng.pick(departments).name}`,
        performedBy: procurementOfficer.name,
      })
    }
    item.quantity = balance
    item.updatedAt = iso(finalEvents[finalEvents.length - 1]?.date ?? today, 12)
    stockMovements.push(...finalEvents)
  })

  // ---------- Assets ----------
  const assets: Asset[] = []
  let assetSeq = 0
  const activeEmployees = employees.filter((e) => e.status !== 'Inactive')
  const engineers = activeEmployees.filter((e) => e.departmentId === deptByCode.get('ENG')!.id)
  for (const model of ASSET_MODEL_SEEDS) {
    for (let k = 0; k < model.count; k++) {
      assetSeq++
      const roll = rng.next()
      const status = model.category === 'Vehicle' || model.category === 'Furniture' ? 'In Use' : roll < 0.72 ? 'In Use' : roll < 0.86 ? 'In Storage' : roll < 0.95 ? 'Under Repair' : 'Retired'
      const pool = model.category === 'Test Equipment' ? engineers : activeEmployees
      const assignee = status === 'In Use' && model.category !== 'Furniture' && model.category !== 'Vehicle' && model.category !== 'Printer' ? pool[(assetSeq * 13) % pool.length] : undefined
      const dept = assignee ? departments.find((d) => d.id === assignee.departmentId)! : model.category === 'Vehicle' ? deptByCode.get('PRL')! : rng.pick(departments)
      assets.push({
        id: `ast_${pad(assetSeq, 4)}`,
        tag: `AST-${pad(assetSeq, 4)}`,
        name: model.name,
        category: model.category,
        serialNumber: `${model.prefix}${pad(rng.int(100000, 999999), 6)}${String.fromCharCode(65 + rng.int(0, 25))}`,
        status,
        assignedToId: assignee?.id,
        departmentId: dept.id,
        purchaseDate: addDays(today, -rng.int(60, 1300)),
        costMinor: model.costMajor * MINOR,
        location: model.category === 'Vehicle' ? 'Ikeja Warehouse' : rng.pick(WAREHOUSE_LOCATIONS),
      })
    }
  }

  // every demo account holder has a laptop issued, so "Assets issued to me" is populated
  const laptops = assets.filter((a) => a.category === 'Laptop')
  users.forEach((u, idx) => {
    const lap = laptops.at(idx % laptops.length)
    const emp = employees.find((e) => e.id === u.employeeId)
    if (!lap || !emp || assets.some((a) => a.assignedToId === emp.id)) return
    lap.assignedToId = emp.id
    lap.departmentId = emp.departmentId
    lap.status = 'In Use'
  })

  // ---------- Expenses (12 months) ----------
  const expenses: Expense[] = []
  let expSeq = 0
  const paymentStatus = (date: string): PaymentStatus => {
    const age = (new Date(today).getTime() - new Date(date).getTime()) / 86_400_000
    if (age > 45) return 'Paid'
    if (age > 20) return rng.chance(0.8) ? 'Paid' : 'Overdue'
    return rng.chance(0.55) ? 'Paid' : 'Pending'
  }
  const pushExpense = (e: Omit<Expense, 'id' | 'code'>) => {
    expSeq++
    expenses.push({ ...e, id: `exp_${pad(expSeq, 5)}`, code: `EXP-${pad(expSeq, 5)}` })
  }
  for (let m = 13; m >= 0; m--) {
    const monthStart = monthKey(addMonths(today, -m)) + '-01'
    const isCurrentMonth = m === 0
    const maxDay = isCurrentMonth ? Number(today.slice(8, 10)) : 28
    // payroll per department, paid on the 25th (or skipped if not yet reached)
    if (!isCurrentMonth || maxDay >= 25) {
      for (const dSeed of DEPARTMENT_SEEDS) {
        const dept = deptByCode.get(dSeed.code)!
        const headcount = employees.filter((e) => e.departmentId === dept.id && e.status !== 'Inactive').length
        const amount = Math.round((headcount * dSeed.avgMonthlyPayMajor * (0.98 + rng.next() * 0.04)) / 1000) * 1000 * MINOR
        const date = addDays(monthStart, 24)
        pushExpense({ date, departmentId: dept.id, category: 'Payroll', description: `${dept.name} payroll — ${monthStart.slice(0, 7)}`, payee: 'Staff salaries', amountMinor: amount, status: 'Paid' })
      }
    }
    for (const r of RECURRING_EXPENSES) {
      if (!rng.chance(r.probability)) continue
      const day = rng.int(1, Math.max(1, maxDay))
      const date = addDays(monthStart, day - 1)
      pushExpense({ date, departmentId: deptByCode.get(r.departmentCode)!.id, category: r.category, description: r.description, payee: r.payee, amountMinor: rng.money(r.minMajor, r.maxMajor), status: paymentStatus(date) })
    }
  }
  // procurement expenses for received requests
  for (const pr of purchaseRequests) {
    if (pr.status !== 'Received') continue
    const date = pr.history.find((h) => h.status === 'Received')!.at.slice(0, 10)
    pushExpense({
      date,
      departmentId: pr.departmentId,
      category: 'Procurement',
      description: `${pr.title} (${pr.code})`,
      payee: suppliers.find((s) => s.id === pr.supplierId)!.name,
      amountMinor: sumMinor(pr.lines.map((l) => lineTotal(l.quantity, l.unitPriceMinor))),
      status: paymentStatus(date),
      purchaseRequestId: pr.id,
    })
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date))

  // ---------- Invoices (12 months) ----------
  const invoices: Invoice[] = []
  let invSeq = 0
  // 14 months are generated so the first charted months also receive payments.
  for (let m = 13; m >= 0; m--) {
    const monthStart = monthKey(addMonths(today, -m)) + '-01'
    const maxDay = m === 0 ? Number(today.slice(8, 10)) : 28
    // monthly billing target grows gently (~₦132m → ₦170m) with some noise
    const targetMajor = (132_000_000 + (13 - m) * 2_900_000) * (0.93 + rng.next() * 0.14) * (m === 0 ? maxDay / 30 : 1)
    const count = m === 0 ? Math.max(3, Math.round((maxDay / 30) * 10)) : rng.int(9, 12)
    const weights = Array.from({ length: count }, () => 0.6 + rng.next())
    const weightSum = weights.reduce((a, b) => a + b, 0)
    for (let k = 0; k < count; k++) {
      invSeq++
      const cust = CUSTOMER_SEEDS[(invSeq * 7 + k) % CUSTOMER_SEEDS.length]
      const issueDate = addDays(monthStart, rng.int(0, maxDay - 1))
      const dueDate = addDays(issueDate, 30)
      const invoiceMajor = (targetMajor * weights[k]) / weightSum
      const nLines = rng.int(1, 2)
      const lines = Array.from({ length: nLines }, (_, li) => {
        const svc = rng.pick(INVOICE_SERVICES)
        const share = nLines === 1 ? 1 : li === 0 ? 0.6 : 0.4
        return { id: `invl_${invSeq}_${li}`, description: svc.description, quantity: 1, unitPriceMinor: Math.round((invoiceMajor * share) / 10_000) * 10_000 * MINOR }
      })
      const pastDue = dueDate < today
      let status: Invoice['status']
      let paidDate: string | undefined
      if (m === 0 && k === count - 1) status = 'Draft'
      else if (pastDue) status = m <= 3 && rng.chance(0.18) ? 'Overdue' : 'Paid'
      else status = rng.chance(0.3) ? 'Paid' : 'Sent'
      if (status === 'Paid') {
        paidDate = addDays(issueDate, pastDue ? rng.int(10, 30) : rng.int(3, 12))
        if (paidDate > today) paidDate = today
      }
      invoices.push({
        id: `inv_${pad(invSeq, 5)}`,
        number: `INV-${issueDate.slice(0, 4)}-${pad(invSeq, 4)}`,
        customer: {
          name: cust.name,
          email: `accounts@${cust.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 14)}.example`,
          address: `${rng.int(2, 48)} Industrial Avenue, ${cust.city}`,
        },
        issueDate,
        dueDate,
        paidDate,
        status,
        lines,
        notes: 'Payment by bank transfer within 30 days. Thank you for your business.',
      })
    }
  }
  invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate))

  // ---------- Direct project costs (cost of sales) ----------
  // Equipment from OEM distributors and subcontracted works for client projects,
  // roughly 35% of what is invoiced each month, so gross margin looks realistic.
  const deliveryDepts = ['ENG', 'PMO', 'MSS'].map((c) => deptByCode.get(c)!)
  const distributors = suppliers.filter((s) => s.active)
  for (let m = 13; m >= 0; m--) {
    const key = monthKey(addMonths(today, -m))
    const billed = sumMinor(invoices.filter((i) => i.status !== 'Draft' && i.issueDate.startsWith(key)).flatMap((i) => i.lines.map((l) => l.quantity * l.unitPriceMinor)))
    if (billed === 0) continue
    const maxDay = m === 0 ? Number(today.slice(8, 10)) : 28
    const parts = 3
    for (let k = 0; k < parts; k++) {
      const share = (0.33 + rng.next() * 0.05) / parts
      const date = addDays(key + '-01', Math.min(maxDay - 1, 4 + k * 9 + rng.int(0, 3)))
      const dept = deliveryDepts[k % deliveryDepts.length]
      pushExpense({
        date,
        departmentId: dept.id,
        category: 'Procurement',
        description: k === 2 ? `Subcontracted installation works — ${key}` : `Client project equipment (OEM distributor) — ${key}`,
        payee: distributors[(m * 3 + k) % distributors.length].name,
        amountMinor: Math.round((billed * share) / (1000 * MINOR)) * 1000 * MINOR,
        status: paymentStatus(date),
      })
    }
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date))

  // budgets: trailing-12-month spend plus headroom, rounded to ₦1m
  for (const d of departments) {
    const yearAgo = addMonths(today, -12)
    const spend = sumMinor(expenses.filter((e) => e.departmentId === d.id && e.date > yearAgo).map((e) => e.amountMinor))
    const factor = 1.08 + rng.next() * 0.2
    d.annualBudgetMinor = Math.ceil((spend * factor) / (1_000_000 * MINOR)) * 1_000_000 * MINOR
  }


  // ---------- Activity & notifications ----------
  const activity: ActivityEntry[] = []
  const recentPRs = [...purchaseRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
  for (const pr of recentPRs) {
    const last = pr.history[pr.history.length - 1]
    activity.push({
      id: `act_pr_${pr.id}`,
      at: last.at,
      actor: last.by,
      action: last.status === 'Draft' ? `created draft ${pr.code}` : last.status === 'Pending Approval' ? `submitted ${pr.code} for approval` : `marked ${pr.code} as ${last.status.toLowerCase()}`,
      entityType: 'purchaseRequest',
      entityId: pr.id,
      link: `/procurement/requests/${pr.id}`,
      departmentId: pr.departmentId,
    })
  }
  const newHires = employees.filter((e) => e.joinDate >= addDays(today, -60))
  for (const e of newHires) {
    activity.push({ id: `act_emp_${e.id}`, at: iso(e.joinDate, 8, 30), actor: userByName('hr.manager').name, action: `onboarded ${e.firstName} ${e.lastName}`, entityType: 'employee', entityId: e.id, link: `/employees/${e.id}`, departmentId: e.departmentId })
  }
  const recentPaid = invoices.filter((i) => i.status === 'Paid' && i.paidDate && i.paidDate >= addDays(today, -14)).slice(0, 4)
  for (const inv of recentPaid) {
    activity.push({ id: `act_inv_${inv.id}`, at: iso(inv.paidDate!, 13, 10), actor: userByName('finance.accountant').name, action: `recorded payment for ${inv.number}`, entityType: 'invoice', entityId: inv.id, link: `/finance/invoices/${inv.id}` })
  }
  activity.sort((a, b) => b.at.localeCompare(a.at))

  const pending = purchaseRequests.filter((p) => p.status === 'Pending Approval')
  const lowItems = inventory.filter((i) => i.quantity <= i.reorderLevel)
  const overdueInv = invoices.filter((i) => i.status === 'Overdue')
  const notifications: AppNotification[] = [
    ...departments
      .map((d) => ({ d, count: pending.filter((p) => p.departmentId === d.id).length }))
      .filter((x) => x.count > 0)
      .map(({ d, count }, i): AppNotification => ({
        id: `ntf_pending_${d.code}`,
        at: iso(today, 8, 5 + i),
        title: `${count} ${d.name} request${count === 1 ? '' : 's'} awaiting approval`,
        body: 'Review pending purchase requests.',
        readBy: [],
        link: '/procurement?status=Pending%20Approval',
        tone: 'warning',
        audience: { userIds: users.filter((u) => u.employeeId === d.headEmployeeId || u.username === 'finance.manager').map((u) => u.id) },
      })),
    { id: 'ntf_low', at: iso(addDays(today, -1), 16, 40), title: `${lowItems.length} stock items at or below reorder level`, body: 'Stock alerts need attention.', readBy: [], link: '/inventory?stock=alerts', tone: 'danger', audience: { userIds: users.filter((u) => u.level === 'Finance' || u.level === 'Secondary Admin' || u.username === 'manager.engineering').map((u) => u.id) } },
    { id: 'ntf_overdue', at: iso(addDays(today, -2), 11, 0), title: `${overdueInv.length} client invoices overdue`, body: 'Follow up with clients on outstanding balances.', readBy: [], link: '/finance?tab=receivables&status=Overdue', tone: 'warning', audience: { userIds: users.filter((u) => u.level === 'Finance' || u.level === 'Sales' || u.username === 'manager.sales').map((u) => u.id) } },
    { id: 'ntf_payroll', at: iso(addDays(today, -4), 9, 20), title: 'Monthly payroll processed', body: 'Payroll for all departments was recorded.', readBy: [], link: '/finance?tab=payables&category=Payroll', tone: 'success', audience: { userIds: users.filter((u) => u.level === 'Finance' || u.level === 'HR').map((u) => u.id) } },
    { id: 'ntf_welcome', at: iso(addDays(today, -6), 10, 0), title: 'Welcome to the EMOCOM ERP demo', body: 'Each login sees only what that role and department may access. All data is fictional.', readBy: [], tone: 'info' },
  ]

  const { work, notifications: workNotifications } = createWorkSeed({ today, departments, employees, users })
  // vendor & subcontractor registry details for the admin module
  suppliers.forEach((s, i) => {
    s.kind = i % 4 === 3 ? 'Subcontractor' : 'Vendor'
    s.registration = !s.active ? 'Suspended' : i === 10 ? 'Pending review' : 'Approved'
    s.evaluation =
      i === 10
        ? undefined
        : { quality: Math.min(5, s.rating + (i % 2)), delivery: Math.max(2, s.rating - (i % 3 === 0 ? 1 : 0)), price: 3 + (i % 3), compliance: Math.min(5, 3 + (i % 3)), evaluatedAt: addDays(today, -rng.int(20, 200)), evaluatedBy: userByName('admin').name }
  })
  suppliers.push(
    { id: 'sup_013', code: 'SUP-013', name: 'Towerline Civil Works Ltd', category: 'Tower & civil works', contactName: 'Musa Garba', email: 'projects@towerline.example', phone: '+234 801 455 2190', city: 'Abuja', rating: 4, active: true, kind: 'Subcontractor', registration: 'Approved', evaluation: { quality: 4, delivery: 3, price: 4, compliance: 5, evaluatedAt: addDays(today, -60), evaluatedBy: userByName('admin').name } },
    { id: 'sup_014', code: 'SUP-014', name: 'Fibrelink Installers Nigeria', category: 'Fibre installation', contactName: 'Ebere Nwosu', email: 'ops@fibrelink.example', phone: '+234 801 733 8042', city: 'Lagos', rating: 3, active: true, kind: 'Subcontractor', registration: 'Pending review' },
  )
  notifications.unshift(...workNotifications)
  notifications.sort((a, b) => b.at.localeCompare(a.at))

  return {
    version: APP_CONFIG.storageVersion,
    seededAt: new Date().toISOString(),
    organization: {
      name: 'EMOCOM Technologies and Consulting Ltd',
      shortName: 'EMOCOM',
      industry: 'IT, Communications & Digital Transformation',
      email: 'erp-demo@emocom.example',
      phone: '+234 800 000 0000',
      address: 'Carlton Gate Estate, Chevron Drive, Lekki, Lagos',
      fiscalYearStartMonth: 1,
    },
    preferences: { accent: 'gold', compactTables: false, pageSize: 10, showDemoBanner: true },
    currentUserId: null,
    departments,
    users,
    employees,
    inventory,
    stockMovements,
    assets,
    suppliers,
    purchaseRequests,
    expenses,
    invoices,
    activity,
    notifications,
    ...work,
  }
}
