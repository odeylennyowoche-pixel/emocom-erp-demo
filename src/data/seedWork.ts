/**
 * Deterministic demo data for the role-based modules added after EMOCOM's
 * feedback: partners & OEMs, CRM, tenders, proposals, projects & tasks,
 * timesheets, leave, claims, payroll grades, period close, HR, licences,
 * integrations, security and backups. Every person, figure and record is
 * fictional; partner entries marked `verified: false` are examples to replace.
 */
import { APP_CONFIG } from '../config/app'
import { addDays, addMonths, monthKey, parseISODate, toISODate } from '../lib/dates'
import type {
  Appraisal,
  AppNotification,
  AppUser,
  BackupRecord,
  Candidate,
  Certification,
  ChangeRequest,
  Contact,
  DemoState,
  Department,
  Employee,
  ExpenseClaim,
  Integration,
  JobOpening,
  KPI,
  Lead,
  LeaveRequest,
  LifecycleChecklist,
  Milestone,
  Opportunity,
  OpportunityStage,
  Partner,
  PeriodClose,
  Project,
  ProjectHealth,
  ProjectStatus,
  Proposal,
  ProposalStatus,
  SalaryGrade,
  SkillRecord,
  SoftwareLicence,
  StatusReport,
  Task,
  Tender,
  TimesheetEntry,
  TrainingRecord,
} from '../types'
import { CUSTOMER_SEEDS, FIRST_NAMES, LAST_NAMES } from './seedCatalog'

const M = APP_CONFIG.minorUnitsPerMajor
const naira = (major: number) => Math.round(major) * M
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const at = (date: string, hour = 10, minute = 0) => `${date}T${pad(hour, 2)}:${pad(minute, 2)}:00.000Z`

function rngFrom(seed: number) {
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
  }
}

/** Monday–Friday dates between two ISO dates (inclusive). */
function workdays(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = parseISODate(d).getDay()
    if (wd !== 0 && wd !== 6) out.push(d)
  }
  return out
}

export interface WorkSeedContext {
  today: string
  departments: Department[]
  employees: Employee[]
  users: AppUser[]
}

type WorkState = Pick<
  DemoState,
  | 'partners'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'tenders'
  | 'proposals'
  | 'projects'
  | 'tasks'
  | 'changeRequests'
  | 'statusReports'
  | 'timesheets'
  | 'leaveRequests'
  | 'expenseClaims'
  | 'salaryGrades'
  | 'employeeGrades'
  | 'periodCloses'
  | 'jobOpenings'
  | 'candidates'
  | 'lifecycleChecklists'
  | 'appraisals'
  | 'certifications'
  | 'trainings'
  | 'skills'
  | 'licences'
  | 'integrations'
  | 'securityPolicy'
  | 'backups'
>

export function createWorkSeed(ctx: WorkSeedContext): { work: WorkState; notifications: AppNotification[] } {
  const { today, departments, employees, users } = ctx
  const rng = rngFrom(4242)
  const dept = (code: string) => departments.find((d) => d.code === code)!
  const user = (username: string) => users.find((u) => u.username === username)!
  const empOf = (username: string) => employees.find((e) => e.id === user(username).employeeId)!
  const activeIn = (code: string) => employees.filter((e) => e.departmentId === dept(code).id && e.status !== 'Inactive')
  const salesOwners = ['sales.exec', 'sales.bd', 'manager.sales'].map((u) => user(u).id)

  // ---------- Partners & OEMs ----------
  const partnerSeeds: Array<Omit<Partner, 'id' | 'since' | 'renewalDate' | 'contactName' | 'contactEmail' | 'certifiedStaff' | 'status'>> = [
    { name: 'OpenText', type: 'OEM', focus: 'IT operations & service management software', tier: 'Partner', verified: true, notes: 'Joint ITOM workshop in Lagos reported in the press.' },
    { name: 'Mitsumi Distribution', type: 'Distributor', focus: 'Laptops, servers, storage and cloud distribution', tier: 'Partner', verified: true, notes: 'Co-hosted ITOM workshop with OpenText.' },
    { name: 'Cisco', type: 'OEM', focus: 'Enterprise networking & Wi-Fi', tier: 'Example', verified: false },
    { name: 'Motorola Solutions', type: 'OEM', focus: 'TETRA / LMR radio', tier: 'Example', verified: false },
    { name: 'Cambium Networks', type: 'OEM', focus: 'Microwave & fixed wireless', tier: 'Example', verified: false },
    { name: 'Hikvision', type: 'OEM', focus: 'CCTV & video surveillance', tier: 'Example', verified: false },
    { name: 'Fortinet', type: 'OEM', focus: 'Firewalls & network security', tier: 'Example', verified: false },
    { name: 'Schneider Electric', type: 'OEM', focus: 'SCADA, telemetry & power', tier: 'Example', verified: false },
    { name: 'Teltonika', type: 'OEM', focus: 'GPS trackers & fleet telematics', tier: 'Example', verified: false },
    { name: 'HP Inc.', type: 'OEM', focus: 'Managed print & PCs', tier: 'Example', verified: false },
    { name: 'Microsoft', type: 'Technology alliance', focus: 'Cloud, Microsoft 365 & Azure', tier: 'Example', verified: false },
    { name: 'Dell Technologies', type: 'OEM', focus: 'Servers, storage & data centre', tier: 'Example', verified: false },
  ]
  const partners: Partner[] = partnerSeeds.map((p, i) => {
    const first = FIRST_NAMES[(i * 9 + 4) % FIRST_NAMES.length]
    const last = LAST_NAMES[(i * 5 + 11) % LAST_NAMES.length]
    const renewal = addDays(today, i % 4 === 1 ? rng.int(10, 55) : i % 7 === 3 ? -rng.int(5, 40) : rng.int(90, 400))
    return {
      ...p,
      id: `ptn_${pad(i + 1, 3)}`,
      since: addDays(today, -rng.int(400, 2600)),
      renewalDate: renewal,
      status: renewal < today ? 'Lapsed' : renewal <= addDays(today, 60) ? 'Renewal due' : 'Active',
      certifiedStaff: rng.int(1, 9),
      contactName: `${first} ${last}`,
      contactEmail: `channel@${p.name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
    }
  })

  // ---------- Contacts ----------
  const contactRoles = ['Head of IT', 'Procurement Manager', 'Operations Director', 'Facilities Manager']
  const contacts: Contact[] = []
  CUSTOMER_SEEDS.forEach((c, i) => {
    for (let k = 0; k < 2; k++) {
      const first = FIRST_NAMES[(i * 4 + k * 13 + 7) % FIRST_NAMES.length]
      const last = LAST_NAMES[(i * 3 + k * 7 + 5) % LAST_NAMES.length]
      contacts.push({
        id: `con_${pad(contacts.length + 1, 3)}`,
        name: `${first} ${last}`,
        company: c.name,
        role: contactRoles[(i + k) % contactRoles.length],
        email: `${first}.${last}`.toLowerCase() + `@${c.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 12)}.example`,
        phone: `+234 802 ${pad(rng.int(100, 999), 3)} ${pad(rng.int(1000, 9999), 4)}`,
        relationship: 'Client',
        ownerUserId: salesOwners[(i + k) % salesOwners.length],
        city: c.city,
      })
    }
  })

  // ---------- Leads ----------
  const leadSeeds: Array<[string, string, Lead['source'], number, Lead['status']]> = [
    ['Crestview Specialist Hospital', 'Enterprise Wi-Fi & nurse-call network', 'Referral', 38_000_000, 'Qualified'],
    ['Sahel Haulage & Logistics', 'Fleet telematics for 140 trucks', 'Website', 52_000_000, 'Contacted'],
    ['Lagoon Microfinance Bank', 'Branch connectivity & CCTV', 'Existing client', 27_000_000, 'New'],
    ['Atlas Cement Works', 'SCADA upgrade for kiln line', 'Partner / OEM', 96_000_000, 'Qualified'],
    ['Unity Polytechnic', 'Campus Wi-Fi & data centre', 'Event', 74_000_000, 'Contacted'],
    ['Harbour Freight Terminal', 'Port radio (TETRA) coverage', 'Cold outreach', 120_000_000, 'New'],
    ['Primeway Insurance', 'Managed print & document management', 'Website', 18_500_000, 'Qualified'],
    ['Delta Gas Processing', 'Pipeline telemetry & monitoring', 'Partner / OEM', 140_000_000, 'Converted'],
    ['Coral Hotels & Suites', 'Guest Wi-Fi and IPTV', 'Event', 22_000_000, 'Disqualified'],
    ['Greenfield Estates', 'Estate CCTV & access control', 'Referral', 31_000_000, 'Contacted'],
    ['Zenon Pharmaceuticals', 'Cloud migration & M365', 'Website', 26_000_000, 'New'],
    ['Ikoyi Medical Centre', 'Network refresh & security', 'Referral', 19_000_000, 'Converted'],
    ['Northern Grain Millers', 'Fleet tracking & fuel monitoring', 'Cold outreach', 15_000_000, 'New'],
    ['Bayelsa Marine Services', 'Vessel radio & satellite links', 'Event', 64_000_000, 'Qualified'],
    ['Primewave Schools Group', 'Classroom Wi-Fi rollout (9 schools)', 'Existing client', 29_000_000, 'Contacted'],
    ['Royal Crest Bank', 'NOC managed services', 'Partner / OEM', 88_000_000, 'New'],
  ]
  const leads: Lead[] = leadSeeds.map(([company, interest, source, value, status], i) => {
    const first = FIRST_NAMES[(i * 7 + 2) % FIRST_NAMES.length]
    const last = LAST_NAMES[(i * 11 + 3) % LAST_NAMES.length]
    return {
      id: `led_${pad(i + 1, 3)}`,
      company,
      contactName: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + `@${company.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 12)}.example`,
      phone: `+234 803 ${pad(rng.int(100, 999), 3)} ${pad(rng.int(1000, 9999), 4)}`,
      source,
      interest,
      estValueMinor: naira(value),
      status,
      ownerUserId: salesOwners[i % 2],
      createdAt: addDays(today, -rng.int(2, 75)),
    }
  })
  leads.filter((l) => l.status === 'Qualified' || l.status === 'Contacted').slice(0, 4).forEach((l, i) =>
    contacts.push({ id: `con_${pad(contacts.length + 1, 3)}`, name: l.contactName, company: l.company, role: contactRoles[i % 4], email: l.email, phone: l.phone, relationship: 'Prospect', ownerUserId: l.ownerUserId, city: 'Lagos' }),
  )
  partners.slice(0, 3).forEach((p) =>
    contacts.push({ id: `con_${pad(contacts.length + 1, 3)}`, name: p.contactName, company: p.name, role: 'Channel Account Manager', email: p.contactEmail, phone: `+234 809 ${pad(rng.int(100, 999), 3)} ${pad(rng.int(1000, 9999), 4)}`, relationship: 'Partner', ownerUserId: user('manager.sales').id, city: 'Lagos' }),
  )

  // ---------- Opportunities ----------
  type OppSeed = [string, string, string, OpportunityStage, number, number, string?]
  // [name, client, serviceLine, stage, valueMajor, closeOffsetDays, oem]
  const oppSeeds: OppSeed[] = [
    ['Branch Wi-Fi rollout — 48 branches', 'Harbourline Bank Plc', 'Networking & Wi-Fi', 'Won', 142_000_000, -150, 'Cisco'],
    ['TETRA network expansion — Phase 2', 'Niger Delta Pipelines Ltd', 'Radio & Microwave', 'Won', 185_000_000, -120, 'Motorola Solutions'],
    ['Managed NOC services (3 years)', 'Crestwave Telecom Services', 'Managed services', 'Won', 64_000_000, -95],
    ['Pipeline station SCADA upgrade', 'Riverbend Energy Services', 'SCADA & Instrumentation', 'Won', 118_000_000, -70, 'Schneider Electric'],
    ['Fleet telematics — 220 vehicles', 'Northgate Logistics Ltd', 'Fleet telematics', 'Won', 46_500_000, -12, 'Teltonika'],
    ['Campus network & data centre refresh', 'Meridian Health Clinics', 'Networking & Wi-Fi', 'Won', 96_000_000, -6, 'Dell Technologies'],
    ['Managed print — head office & plants', 'Savannah Cement Manufacturing', 'Managed print', 'Lost', 21_000_000, -45, 'HP Inc.'],
    ['Studio CCTV & access control', 'Lagoon Broadcasting Network', 'Security & CCTV', 'Lost', 34_000_000, -80, 'Hikvision'],
    ['ERP cloud migration', 'Sunrise Foods & Beverages', 'Cloud & digital', 'Lost', 28_000_000, -130, 'Microsoft'],
    ['Pipeline telemetry & monitoring', 'Delta Gas Processing', 'SCADA & Instrumentation', 'Negotiation', 140_000_000, 25, 'Schneider Electric'],
    ['Branch security & firewalls', 'Keystone Microfinance Bank', 'Security & CCTV', 'Negotiation', 37_000_000, 18, 'Fortinet'],
    ['Microwave backhaul — 8 links', 'Crestwave Telecom Services', 'Radio & Microwave', 'Negotiation', 72_000_000, 40, 'Cambium Networks'],
    ['Network refresh & security', 'Ikoyi Medical Centre', 'Networking & Wi-Fi', 'Proposal', 19_000_000, 30, 'Cisco'],
    ['Kiln line SCADA upgrade', 'Atlas Cement Works', 'SCADA & Instrumentation', 'Proposal', 96_000_000, 55, 'Schneider Electric'],
    ['Nurse-call & clinical Wi-Fi', 'Crestview Specialist Hospital', 'Networking & Wi-Fi', 'Proposal', 38_000_000, 35, 'Cisco'],
    ['Document & records management', 'Primeway Insurance', 'Cloud & digital', 'Proposal', 18_500_000, 22, 'OpenText'],
    ['Vessel radio & satellite links', 'Bayelsa Marine Services', 'Radio & Microwave', 'Needs analysis', 64_000_000, 70, 'Motorola Solutions'],
    ['Plant-wide Wi-Fi & CCTV', 'Sunrise Foods & Beverages', 'Networking & Wi-Fi', 'Needs analysis', 41_000_000, 85],
    ['IT operations management suite', 'Harbourline Bank Plc', 'Cloud & digital', 'Needs analysis', 55_000_000, 60, 'OpenText'],
    ['Fleet & fuel monitoring', 'Sahel Haulage & Logistics', 'Fleet telematics', 'Qualification', 52_000_000, 100, 'Teltonika'],
    ['Campus Wi-Fi & data centre', 'Unity Polytechnic', 'Networking & Wi-Fi', 'Qualification', 74_000_000, 120, 'Cisco'],
    ['Estate CCTV & access control', 'Greenfield Estates', 'Security & CCTV', 'Qualification', 31_000_000, 90, 'Hikvision'],
  ]
  const lossReasons = ['Lost on price', 'Client chose an incumbent competitor', 'Project postponed by client']
  const opportunities: Opportunity[] = oppSeeds.map(([name, client, serviceLine, stage, value, closeOffset, oem], i) => {
    const closed = stage === 'Won' || stage === 'Lost'
    const expectedClose = addDays(today, closeOffset)
    return {
      id: `opp_${pad(i + 1, 3)}`,
      code: `OPP-${pad(1001 + i, 4)}`,
      name,
      clientName: client,
      serviceLine,
      stage,
      valueMinor: naira(value),
      expectedClose,
      ownerUserId: salesOwners[i % 3],
      oem,
      createdAt: addDays(expectedClose, -rng.int(45, 110)),
      closedAt: closed ? expectedClose : undefined,
      lossReason: stage === 'Lost' ? lossReasons[i % lossReasons.length] : undefined,
    }
  })

  // ---------- Projects ----------
  type ProjSeed = {
    name: string
    client: string
    dept: string
    value: number
    start: number
    end: number
    status: ProjectStatus
    health: ProjectHealth
    progress: number
    opp?: number
  }
  const projSeeds: ProjSeed[] = [
    { name: 'Branch Wi-Fi rollout — 48 branches', client: 'Harbourline Bank Plc', dept: 'PMO', value: 142_000_000, start: -130, end: 60, status: 'Active', health: 'On track', progress: 0.62, opp: 0 },
    { name: 'TETRA network expansion — Phase 2', client: 'Niger Delta Pipelines Ltd', dept: 'ENG', value: 185_000_000, start: -100, end: 110, status: 'Active', health: 'On track', progress: 0.48, opp: 1 },
    { name: 'Managed NOC services — 24/7', client: 'Crestwave Telecom Services', dept: 'MSS', value: 64_000_000, start: -80, end: 1000, status: 'Active', health: 'On track', progress: 0.3, opp: 2 },
    { name: 'Pipeline station SCADA upgrade', client: 'Riverbend Energy Services', dept: 'ENG', value: 118_000_000, start: -55, end: 95, status: 'Active', health: 'At risk', progress: 0.33, opp: 3 },
    { name: 'Port CCTV & access control upgrade', client: 'Northgate Logistics Ltd', dept: 'PMO', value: 58_000_000, start: -70, end: 25, status: 'Active', health: 'Off track', progress: 0.71 },
    { name: 'Managed print services rollout', client: 'Keystone Microfinance Bank', dept: 'MSS', value: 24_000_000, start: -40, end: 50, status: 'Active', health: 'On track', progress: 0.45 },
    { name: 'Microwave backhaul links — 12 sites', client: 'Crestwave Telecom Services', dept: 'ENG', value: 77_000_000, start: -240, end: -20, status: 'Completed', health: 'On track', progress: 1 },
    { name: 'Cloud migration — ERP & email', client: 'Sunrise Foods & Beverages', dept: 'MSS', value: 19_500_000, start: -60, end: 40, status: 'On hold', health: 'At risk', progress: 0.2 },
    { name: 'Fleet telematics deployment — 220 vehicles', client: 'Northgate Logistics Ltd', dept: 'PMO', value: 46_500_000, start: 7, end: 100, status: 'Planning', health: 'On track', progress: 0, opp: 4 },
    { name: 'Campus network & data centre refresh', client: 'Meridian Health Clinics', dept: 'PMO', value: 96_000_000, start: 14, end: 160, status: 'Pending approval', health: 'On track', progress: 0, opp: 5 },
  ]
  const managerOf = (code: string) => users.find((u) => u.level === 'Manager' && u.departmentId === dept(code).id)!
  const staffLoginOf = (code: string) => users.find((u) => u.level === 'Staff' && u.departmentId === dept(code).id)
  const projects: Project[] = []
  const tasks: Task[] = []
  const milestoneNames = ['Site survey & design sign-off', 'Equipment delivered', 'Installation complete', 'Testing & commissioning', 'Client acceptance & handover']
  const taskTemplates: Record<string, string[]> = {
    PMO: ['Kick-off meeting with client', 'Site survey report', 'Bill of quantities sign-off', 'Delivery scheduling', 'Installation supervision', 'Weekly status report', 'Snag list close-out', 'Acceptance test document', 'As-built drawings', 'Client training session'],
    ENG: ['RF coverage survey', 'Detailed network design', 'Configure core equipment', 'Install base stations', 'Antenna alignment', 'Link budget validation', 'Integration testing', 'Commissioning report', 'Spares & tools list', 'Handover documentation'],
    MSS: ['Service onboarding checklist', 'Monitoring tools configured', 'Escalation matrix agreed', 'Asset inventory baseline', 'SLA reporting template', 'Monthly service review', 'Patch management schedule', 'Backup verification', 'Runbook update', 'User training'],
  }
  projSeeds.forEach((ps, i) => {
    const d = dept(ps.dept)
    const mgr = managerOf(ps.dept)
    const team = activeIn(ps.dept).filter((e) => e.id !== d.headEmployeeId)
    const staffLogin = staffLoginOf(ps.dept)
    const staffEmpId = staffLogin?.employeeId
    // the staff demo login works on most projects of their department
    const members = [...new Set([...(staffEmpId && i % 5 !== 4 ? [staffEmpId] : []), ...Array.from({ length: 4 }, (_, k) => team[(i * 3 + k * 2 + 1) % team.length].id)])]
    const startDate = addDays(today, ps.start)
    const endDate = addDays(today, ps.end)
    const budget = Math.round(ps.value * 0.68)
    const id = `prj_${pad(i + 1, 3)}`
    const span = ps.end - ps.start
    const milestones: Milestone[] = milestoneNames.map((n, k) => {
      const due = addDays(startDate, Math.round((span * (k + 1)) / milestoneNames.length))
      const done = (k + 1) / milestoneNames.length <= ps.progress + 0.01
      return { id: `${id}_ms${k + 1}`, name: n, dueDate: due, done, doneAt: done ? (due < today ? due : today) : undefined }
    })
    projects.push({
      id,
      code: `PRJ-${pad(2401 + i, 4)}`,
      name: ps.name,
      clientName: ps.client,
      departmentId: d.id,
      managerUserId: mgr.id,
      contractValueMinor: naira(ps.value),
      budgetMinor: naira(budget),
      costToDateMinor: naira(budget * ps.progress * (ps.health === 'Off track' ? 1.18 : ps.health === 'At risk' ? 1.07 : 0.94)),
      startDate,
      endDate,
      status: ps.status,
      health: ps.health,
      memberIds: members,
      milestones,
      opportunityId: ps.opp !== undefined ? opportunities[ps.opp].id : undefined,
      createdAt: addDays(startDate, -10),
      approval: ps.value * M > 50_000_000 * M && ps.status !== 'Pending approval' ? { by: user('ceo').name, at: at(addDays(startDate, -7), 11) } : undefined,
    })
    if (ps.status === 'Pending approval') return
    // tasks spread across the project timeline
    const tpls = taskTemplates[ps.dept]
    const count = ps.status === 'Planning' ? 4 : 8
    for (let k = 0; k < count; k++) {
      // tasks run back-to-back; the share already finished matches the project's progress
      const doneShare = Math.round(count * ps.progress)
      const tStart = ps.status === 'Planning' ? addDays(startDate, k * 5) : ps.status === 'Completed' ? addDays(startDate, k * 20) : addDays(today, (k - doneShare) * 6 - 3)
      const due = addDays(tStart, rng.int(5, 10))
      // the staff demo login gets every other task so their workspace is busy
      const assignee = staffEmpId && members.includes(staffEmpId) && k % 2 === 0 ? staffEmpId : members[(k + 1) % members.length]
      let status: Task['status'] = due < today ? (rng.chance(0.85) ? 'Done' : 'In progress') : tStart <= today ? 'In progress' : 'To do'
      if (ps.status === 'Completed') status = 'Done'
      if (ps.status === 'On hold' && status !== 'Done') status = 'To do'
      const ms = milestones.find((m) => m.dueDate >= due) ?? milestones[milestones.length - 1]
      tasks.push({
        id: `tsk_${id}_${k + 1}`,
        projectId: id,
        title: tpls[k % tpls.length],
        assigneeId: assignee,
        startDate: tStart,
        dueDate: due,
        status,
        estimateHours: rng.pick([8, 12, 16, 24, 32]),
        milestoneId: ms.id,
        completedAt: status === 'Done' ? at(due < today ? due : today, 16) : undefined,
        completionNote: status === 'Done' ? 'Completed and documented.' : undefined,
        assignedBy: mgr.name,
      })
    }
  })
  // won deals: two already handed over (projects exist), the newest two waiting for Projects to accept
  opportunities.forEach((o) => {
    const p = projects.find((x) => x.opportunityId === o.id)
    if (p) o.handover = { status: 'Accepted', requestedAt: at(addDays(p.createdAt, -3), 10), requestedBy: users.find((u) => u.id === o.ownerUserId)!.name, notes: 'Signed contract, BoQ and client contacts attached.', acceptedBy: users.find((u) => u.id === p.managerUserId)!.name, projectId: p.id }
  })
  // a fresh win waiting for Projects & Delivery to accept the handover
  opportunities.push({
    id: 'opp_023',
    code: 'OPP-1023',
    name: 'Clinic CCTV & visitor management',
    clientName: 'Meridian Health Clinics',
    serviceLine: 'Security & CCTV',
    stage: 'Won',
    valueMinor: naira(28_400_000),
    expectedClose: addDays(today, -3),
    closedAt: addDays(today, -3),
    ownerUserId: user('sales.exec').id,
    oem: 'Hikvision',
    createdAt: addDays(today, -64),
    handover: { status: 'Pending', requestedAt: at(addDays(today, -2), 15, 20), requestedBy: user('sales.exec').name, notes: 'PO received. Site visit booked for next week; BoQ v3 is final.' },
  })

  // ---------- Change requests ----------
  const crSeeds: Array<[number, string, number, number, ChangeRequest['status'], string]> = [
    [3, 'Add 4 remote terminal units at Station 7', 14_500_000, 21, 'Pending', 'manager.engineering'],
    [1, 'Two additional repeater sites for coverage gaps', 8_200_000, 14, 'Pending', 'staff.engineering'],
    [0, 'Extend rollout to 6 new branches', 16_800_000, 30, 'Pending', 'manager.projects'],
    [2, 'Add weekend on-site support engineer', 3_900_000, 0, 'Pending', 'staff.services'],
    [4, 'Replace faulty barrier gates (client request)', 2_700_000, 7, 'Approved', 'staff.projects'],
    [5, 'Toner level monitoring for 40 extra devices', 1_200_000, 3, 'Rejected', 'staff.services'],
  ]
  const changeRequests: ChangeRequest[] = crSeeds.map(([pi, title, cost, days, status, by], i) => {
    const raiser = user(by)
    const p = projects[pi]
    const raisedAt = at(addDays(today, -rng.int(1, 9)), 9 + i)
    const decider = status === 'Pending' ? undefined : users.find((u) => u.id === p.managerUserId)!.name
    return {
      id: `chr_${pad(i + 1, 3)}`,
      code: `CR-${pad(301 + i, 4)}`,
      projectId: p.id,
      title,
      description: `${title}. Raised during delivery; scope, cost and schedule impact estimated by the delivery team.`,
      costImpactMinor: naira(cost),
      daysImpact: days,
      status,
      raisedBy: raiser.name,
      raisedByUserId: raiser.id,
      raisedAt,
      decidedBy: decider,
      decidedAt: decider ? at(addDays(today, -1), 14) : undefined,
      decisionNote: status === 'Rejected' ? 'Covered by the existing service scope; no change needed.' : undefined,
    }
  })

  // ---------- Status reports ----------
  const statusReports: StatusReport[] = []
  projects
    .filter((p) => p.status === 'Active' || p.status === 'On hold')
    .forEach((p, i) => {
      const mgr = users.find((u) => u.id === p.managerUserId)!
      const pt = tasks.filter((t) => t.projectId === p.id)
      const pct = pt.length ? Math.round((pt.filter((t) => t.status === 'Done').length / pt.length) * 100) : 0
      statusReports.push({
        id: `str_${p.id}_1`,
        projectId: p.id,
        at: at(addDays(today, -rng.int(2, 6)), 16, 10 + i),
        author: mgr.name,
        health: p.health,
        percentComplete: pct,
        summary:
          p.health === 'On track'
            ? 'Work is progressing to plan. Deliveries received and installation crews are on site.'
            : p.health === 'At risk'
              ? 'Equipment lead times have slipped by two weeks; mitigation agreed with the OEM distributor.'
              : 'Behind schedule due to site access restrictions; recovery plan submitted to the client.',
        nextSteps: 'Complete the current milestone, update the client and confirm next week’s site schedule.',
      })
    })

  // ---------- Timesheets (last 3 weeks for every project member) ----------
  const timesheets: TimesheetEntry[] = []
  const sheetDays = workdays(addDays(today, -21), addDays(today, -1))
  const memberProjects = new Map<string, Project[]>()
  projects.filter((p) => p.status === 'Active').forEach((p) => p.memberIds.forEach((m) => memberProjects.set(m, [...(memberProjects.get(m) ?? []), p])))
  memberProjects.forEach((projs, empId) => {
    sheetDays.forEach((day, di) => {
      if (rng.chance(0.08)) return // leave / training day
      const p = projs[di % projs.length]
      const myTasks = tasks.filter((t) => t.projectId === p.id && t.assigneeId === empId)
      const total = rng.pick([6, 7, 8, 8, 8, 9])
      const split = projs.length > 1 && rng.chance(0.4)
      const entries = split ? [[p, total - 3], [projs[(di + 1) % projs.length], 3]] as const : [[p, total]] as const
      entries.forEach(([proj, hours]) => {
        const t = tasks.find((x) => x.projectId === proj.id && x.assigneeId === empId) ?? myTasks[0]
        timesheets.push({ id: `tms_${empId}_${day}_${proj.id}`, employeeId: empId, date: day, projectId: proj.id, taskId: t?.id, hours, note: t ? t.title : 'Project work' })
      })
    })
  })

  // ---------- Leave ----------
  const leaveRequests: LeaveRequest[] = []
  const pushLeave = (e: Employee, type: LeaveRequest['type'], startOffset: number, days: number, status: LeaveRequest['status'], reason: string, decider?: string) => {
    const startDate = addDays(today, startOffset)
    leaveRequests.push({
      id: `lev_${pad(leaveRequests.length + 1, 3)}`,
      employeeId: e.id,
      type,
      startDate,
      endDate: addDays(startDate, days - 1 + Math.floor(days / 5) * 2),
      days,
      reason,
      status,
      createdAt: at(addDays(today, Math.min(-1, startOffset - rng.int(5, 20))), 9),
      decidedBy: status === 'Pending' ? undefined : decider,
      decidedAt: status === 'Pending' ? undefined : at(addDays(today, Math.min(-1, startOffset - 3)), 15),
    })
  }
  for (const code of ['SBD', 'ENG', 'MSS', 'PMO', 'FIN', 'HRA', 'PRL', 'EXO']) {
    const mgrName = users.find((u) => u.departmentId === dept(code).id && dept(code).headEmployeeId === u.employeeId)?.name ?? user('hr.manager').name
    const team = activeIn(code).filter((e) => e.id !== dept(code).headEmployeeId && !users.some((u) => u.employeeId === e.id))
    team.slice(0, 3).forEach((e, k) => {
      if (k === 0) pushLeave(e, 'Annual', rng.int(6, 20), rng.int(3, 8), 'Pending', 'Family travel', mgrName)
      else if (k === 1) pushLeave(e, 'Annual', -rng.int(30, 120), rng.int(3, 10), 'Approved', 'Annual vacation', mgrName)
      else pushLeave(e, rng.pick(['Sick', 'Casual'] as const), -rng.int(5, 60), rng.int(1, 3), 'Approved', 'Personal', mgrName)
    })
  }
  for (const username of ['staff.engineering', 'staff.services', 'staff.projects', 'staff.presales', 'sales.exec', 'sales.bd', 'finance.accountant']) {
    const e = empOf(username)
    const d = departments.find((x) => x.id === e.departmentId)!
    const mgrName = users.find((u) => u.employeeId === d.headEmployeeId)?.name ?? user('hr.manager').name
    pushLeave(e, 'Annual', -rng.int(60, 150), 5, 'Approved', 'Annual vacation', mgrName)
    pushLeave(e, 'Casual', -rng.int(10, 40), 1, 'Approved', 'Personal errand', mgrName)
    if (username.startsWith('staff.')) pushLeave(e, 'Annual', rng.int(14, 30), 4, 'Pending', 'Family event out of town', mgrName)
  }
  // a manager's own leave goes to HR
  pushLeave(empOf('manager.services'), 'Annual', 21, 5, 'Pending', 'Annual vacation')

  // ---------- Expense claims ----------
  const expenseClaims: ExpenseClaim[] = []
  const claimItems: Array<[ExpenseClaim['category'], string, number]> = [
    ['Transport', 'Ride-hailing to client site', 18_500],
    ['Fuel', 'Fuel for site visit (pool vehicle)', 42_000],
    ['Per diem', 'Per diem — 2 nights, Port Harcourt site', 90_000],
    ['Data & airtime', 'Mobile data for remote support', 15_000],
    ['Site materials', 'Cable ties, connectors and labels', 36_700],
    ['Client entertainment', 'Working lunch with client project team', 64_000],
  ]
  const pushClaim = (e: Employee, k: number, status: ExpenseClaim['status'], daysAgo: number, project?: Project) => {
    const [category, description, amount] = claimItems[k % claimItems.length]
    const d = departments.find((x) => x.id === e.departmentId)!
    expenseClaims.push({
      id: `clm_${pad(expenseClaims.length + 1, 3)}`,
      code: `CLM-${pad(501 + expenseClaims.length, 4)}`,
      employeeId: e.id,
      date: addDays(today, -daysAgo),
      category,
      description,
      amountMinor: naira(amount),
      projectId: project?.id,
      status,
      decidedBy: status === 'Pending' ? undefined : users.find((u) => u.employeeId === d.headEmployeeId)?.name ?? user('ceo').name,
      decidedAt: status === 'Pending' ? undefined : at(addDays(today, -daysAgo + 2), 12),
    })
  }
  for (const username of ['staff.engineering', 'staff.services', 'staff.projects', 'staff.presales', 'sales.exec', 'sales.bd']) {
    const e = empOf(username)
    const myProject = projects.find((p) => p.memberIds.includes(e.id) && p.status === 'Active')
    pushClaim(e, expenseClaims.length, 'Pending', rng.int(1, 4), myProject)
    pushClaim(e, expenseClaims.length + 1, 'Approved', rng.int(8, 14), myProject)
    pushClaim(e, expenseClaims.length + 2, 'Paid', rng.int(25, 50), myProject)
  }
  for (const code of ['ENG', 'MSS', 'PMO', 'SBD']) {
    activeIn(code)
      .filter((e) => e.id !== dept(code).headEmployeeId && !users.some((u) => u.employeeId === e.id))
      .slice(0, 2)
      .forEach((e, k) => pushClaim(e, k + 3, 'Pending', rng.int(1, 6)))
  }

  // ---------- Payroll grades (illustrative) ----------
  const salaryGrades: SalaryGrade[] = [
    { code: 'E1', name: 'Executive', basicMinor: naira(1_500_000), housingMinor: naira(600_000), transportMinor: naira(250_000), otherAllowanceMinor: naira(400_000) },
    { code: 'M1', name: 'Manager', basicMinor: naira(900_000), housingMinor: naira(360_000), transportMinor: naira(150_000), otherAllowanceMinor: naira(200_000) },
    { code: 'S2', name: 'Senior Officer / Engineer', basicMinor: naira(520_000), housingMinor: naira(210_000), transportMinor: naira(90_000), otherAllowanceMinor: naira(80_000) },
    { code: 'S1', name: 'Officer / Engineer', basicMinor: naira(330_000), housingMinor: naira(130_000), transportMinor: naira(60_000), otherAllowanceMinor: naira(50_000) },
    { code: 'J1', name: 'Junior / Intern', basicMinor: naira(160_000), housingMinor: naira(60_000), transportMinor: naira(40_000), otherAllowanceMinor: naira(20_000) },
  ]
  const employeeGrades: Record<string, string> = {}
  for (const e of employees) {
    const d = departments.find((x) => x.id === e.departmentId)!
    employeeGrades[e.id] =
      d.headEmployeeId === e.id ? (d.code === 'EXO' ? 'E1' : 'M1') : d.code === 'EXO' ? 'S2' : e.employmentType === 'Intern' ? 'J1' : e.employmentType === 'Contract' ? 'S1' : rng.chance(0.45) ? 'S2' : 'S1'
  }

  // ---------- Period close ----------
  const monthChecklist = ['Bank reconciliations', 'Receivables review & aging', 'Payables cut-off', 'Payroll journal posted', 'Accruals & prepayments', 'Revenue recognition review', 'Management accounts pack']
  const periodCloses: PeriodClose[] = []
  for (let m = 3; m >= 0; m--) {
    const key = monthKey(addMonths(today, -m))
    const status: PeriodClose['status'] = m >= 2 ? 'Closed' : m === 1 ? 'In progress' : 'Open'
    periodCloses.push({
      id: `pcl_${key}`,
      period: key,
      kind: 'Month',
      status,
      checklist: monthChecklist.map((label, k) => ({ label, done: status === 'Closed' || (status === 'In progress' && k < 4) })),
      closedBy: status === 'Closed' ? user('finance.manager').name : undefined,
      closedAt: status === 'Closed' ? at(addDays(key + '-01', 40), 17) : undefined,
    })
  }
  const td = parseISODate(today)
  const prevQ = Math.floor(td.getMonth() / 3) // 0 = Q1 … previous quarter number
  const qYear = prevQ === 0 ? td.getFullYear() - 1 : td.getFullYear()
  const qNum = prevQ === 0 ? 4 : prevQ
  periodCloses.push({
    id: `pcl_${qYear}_q${qNum}`,
    period: `${qYear}-Q${qNum}`,
    kind: 'Quarter',
    status: 'In progress',
    checklist: ['All months in the quarter closed', 'Quarterly management review', 'Budget vs actual variance report', 'Statutory filings reviewed', 'Board pack prepared'].map((label, k) => ({ label, done: k < 2 })),
  })
  periodCloses.push({
    id: `pcl_fy${td.getFullYear() - 1}`,
    period: `FY${td.getFullYear() - 1}`,
    kind: 'Year',
    status: 'Closed',
    checklist: ['All quarters closed', 'Fixed asset register reconciled', 'Inventory count & valuation', 'Audit adjustments posted', 'External audit sign-off', 'Annual report approved'].map((label) => ({ label, done: true })),
    closedBy: user('finance.manager').name,
    closedAt: at(`${td.getFullYear()}-04-15`, 12),
  })

  // ---------- HR: recruitment ----------
  const openingSeeds: Array<[string, string, number, JobOpening['status']]> = [
    ['Network Engineer', 'ENG', 2, 'Interviewing'],
    ['Presales Consultant', 'SBD', 1, 'Open'],
    ['NOC Engineer', 'MSS', 2, 'Offer made'],
    ['Project Coordinator', 'PMO', 1, 'Open'],
    ['Accounts Payable Officer', 'FIN', 1, 'Filled'],
  ]
  const jobOpenings: JobOpening[] = openingSeeds.map(([title, code, openings, status], i) => ({
    id: `job_${pad(i + 1, 3)}`,
    code: `JOB-${pad(61 + i, 3)}`,
    title,
    departmentId: dept(code).id,
    openings,
    status,
    postedAt: addDays(today, -rng.int(10, 60)),
    hiringManagerUserId: users.find((u) => u.employeeId === dept(code).headEmployeeId)?.id ?? user('hr.manager').id,
  }))
  const candidates: Candidate[] = []
  const stageMix: Candidate['stage'][] = ['Applied', 'Applied', 'Screening', 'Interview', 'Interview', 'Offer', 'Rejected', 'Hired']
  jobOpenings.forEach((j, ji) => {
    const n = j.status === 'Filled' ? 3 : 4
    for (let k = 0; k < n; k++) {
      const first = FIRST_NAMES[(ji * 17 + k * 5 + 21) % FIRST_NAMES.length]
      const last = LAST_NAMES[(ji * 13 + k * 7 + 17) % LAST_NAMES.length]
      let stage = stageMix[(ji * 3 + k) % stageMix.length]
      if (j.status === 'Filled') stage = k === 0 ? 'Hired' : 'Rejected'
      if (j.status === 'Offer made' && k === 0) stage = 'Offer'
      if (stage === 'Hired' && j.status !== 'Filled') stage = 'Interview'
      candidates.push({ id: `cnd_${pad(candidates.length + 1, 3)}`, openingId: j.id, name: `${first} ${last}`, email: `${first}.${last}`.toLowerCase() + '@mail.example', source: rng.pick(['LinkedIn', 'Referral', 'Careers page', 'Recruitment agency']), stage, appliedAt: addDays(j.postedAt, rng.int(1, 9)) })
    }
  })

  // ---------- HR: onboarding & offboarding ----------
  const onboardingItems = ['Offer letter signed', 'Laptop & email account issued', 'ERP account created', 'HMO enrolment', 'Pension details captured', 'Induction & HSE training', 'Probation objectives set']
  const offboardingItems = ['Resignation accepted', 'Handover plan completed', 'Company assets returned', 'Accounts & access disabled', 'Final settlement computed', 'Exit interview held']
  const lifecycleChecklists: LifecycleChecklist[] = []
  employees
    .filter((e) => e.joinDate >= addDays(today, -60) && e.status !== 'Inactive')
    .slice(0, 5)
    .forEach((e, i) =>
      lifecycleChecklists.push({ id: `lfc_on_${e.id}`, kind: 'Onboarding', employeeId: e.id, startDate: e.joinDate, items: onboardingItems.map((label, k) => ({ label, done: k < 3 + ((i * 2) % 5) })) }),
    )
  employees
    .filter((e) => e.status === 'Inactive')
    .slice(0, 2)
    .forEach((e, i) =>
      lifecycleChecklists.push({ id: `lfc_off_${e.id}`, kind: 'Offboarding', employeeId: e.id, startDate: addDays(today, -rng.int(3, 20)), items: offboardingItems.map((label, k) => ({ label, done: k < 2 + i * 2 })) }),
    )

  // ---------- HR: appraisals ----------
  const KPI_SETS: Record<string, Array<[string, string]>> = {
    ENG: [['Installations delivered on schedule', '90%'], ['First-time-right commissioning', '95%'], ['Certifications maintained', '2 per year'], ['Client satisfaction score', '4.5 / 5']],
    MSS: [['SLA compliance', '99.5%'], ['Mean time to resolve', '< 4 hours'], ['Ticket backlog', '< 20 open'], ['Client satisfaction score', '4.5 / 5']],
    PMO: [['Milestones hit on time', '90%'], ['Budget variance', '< 5%'], ['Weekly status reports', '100% on time'], ['Client sign-offs obtained', 'All milestones']],
    SBD: [['Revenue booked vs target', '100%'], ['Pipeline coverage', '3× target'], ['Win rate', '35%'], ['Proposals submitted on time', '100%']],
  }
  const appraisals: Appraisal[] = []
  const year = td.getFullYear()
  for (const code of Object.keys(KPI_SETS)) {
    const d = dept(code)
    for (const e of activeIn(code)) {
      if (e.id === d.headEmployeeId) continue
      const kpisFor = (scored: boolean): KPI[] => KPI_SETS[code].map(([name, target]) => ({ name, target, weight: 25, score: scored ? rng.int(2, 5) : undefined }))
      const h1 = kpisFor(true)
      appraisals.push({
        id: `apr_${e.id}_h1`,
        employeeId: e.id,
        period: `H1 ${year}`,
        reviewerId: d.headEmployeeId!,
        status: 'Completed',
        kpis: h1,
        overall: Math.round((h1.reduce((s, k) => s + (k.score ?? 0), 0) / h1.length) * 10) / 10,
        comments: 'Solid half-year. Keep building client-facing skills.',
        completedAt: at(`${year}-07-${pad(rng.int(10, 28), 2)}`, 11),
      })
      const roll = rng.next()
      appraisals.push({ id: `apr_${e.id}_h2`, employeeId: e.id, period: `H2 ${year}`, reviewerId: d.headEmployeeId!, status: roll < 0.4 ? 'Manager review' : roll < 0.75 ? 'Self review' : 'Not started', kpis: kpisFor(false) })
    }
  }

  // ---------- Learning: certifications, training, skills ----------
  const CERTS: Record<string, Array<[string, string, number]>> = {
    ENG: [['CCNA', 'Cisco', 36], ['CCNP Enterprise', 'Cisco', 36], ['TETRA System Technician', 'Motorola Solutions', 24], ['NSE 4 Network Security Professional', 'Fortinet', 24], ['GWO Basic Safety (Working at Heights)', 'GWO', 24]],
    MSS: [['ITIL 4 Foundation', 'PeopleCert', 0], ['Azure Administrator (AZ-104)', 'Microsoft', 12], ['CompTIA Security+', 'CompTIA', 36], ['AWS Solutions Architect – Associate', 'Amazon Web Services', 36]],
    PMO: [['PMP', 'PMI', 36], ['PRINCE2 Practitioner', 'PeopleCert', 36], ['NEBOSH IGC', 'NEBOSH', 0]],
    SBD: [['Cisco Sales Expert', 'Cisco', 24], ['Certified Solution Selling', 'Sales Institute', 0]],
    FIN: [['ACA', 'ICAN', 0]],
    HRA: [['CIPM Associate', 'CIPM', 0]],
  }
  const certifications: Certification[] = []
  const trainings: TrainingRecord[] = []
  const skills: SkillRecord[] = []
  const SKILLS: Record<string, string[]> = {
    ENG: ['IP networking', 'RF planning', 'Microwave alignment', 'TETRA configuration', 'Fibre splicing', 'Firewall configuration', 'SCADA / RTU'],
    MSS: ['Network monitoring', 'Windows Server', 'Linux', 'Microsoft 365 admin', 'Azure', 'ITSM / ticketing', 'Backup & recovery'],
    PMO: ['Project planning', 'MS Project', 'Stakeholder management', 'Risk management', 'HSE supervision', 'Budget tracking'],
    SBD: ['Solution selling', 'Proposal writing', 'Tender documentation', 'Pricing & BoQ', 'Client presentations', 'CRM'],
    FIN: ['Financial reporting', 'Reconciliations', 'IFRS', 'Excel modelling'],
    HRA: ['Recruitment', 'Employee relations', 'Payroll', 'Labour law'],
  }
  const levels: SkillRecord['level'][] = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
  for (const code of Object.keys(CERTS)) {
    activeIn(code).forEach((e, i) => {
      const certList = CERTS[code]
      const nCerts = i % 3 === 2 ? 0 : 1 + (i % 2)
      for (let k = 0; k < nCerts; k++) {
        const [name, issuer, validMonths] = certList[(i + k) % certList.length]
        const issued = addDays(today, -rng.int(120, 900))
        let expires = validMonths ? addMonths(issued, validMonths) : undefined
        if (expires && i % 5 === 1 && k === 0) expires = addDays(today, rng.int(10, 55)) // expiring soon
        certifications.push({ id: `crt_${pad(certifications.length + 1, 4)}`, employeeId: e.id, name, issuer, issued, expires })
      }
      const skillList = SKILLS[code]
      for (let k = 0; k < 3 + (i % 2); k++) skills.push({ id: `skl_${pad(skills.length + 1, 4)}`, employeeId: e.id, name: skillList[(i + k * 2) % skillList.length], level: levels[(i + k) % 4] })
      if (i % 3 === 0) {
        const [course, provider] = rng.pick([
          ['Advanced Wi-Fi design', 'OEM academy'],
          ['Working at heights refresher', 'HSE training partner'],
          ['Customer service excellence', 'In-house'],
          ['Cybersecurity awareness', 'In-house'],
          ['Project risk management', 'PMI chapter'],
        ] as const)
        trainings.push({ id: `trn_${pad(trainings.length + 1, 3)}`, employeeId: e.id, course, provider, dueDate: addDays(today, rng.int(-30, 60)), status: rng.pick(['Enrolled', 'In progress', 'Completed'] as const) })
      }
    })
  }
  // make sure each staff login has visible learning records
  for (const username of ['staff.engineering', 'staff.services', 'staff.projects', 'staff.presales']) {
    const e = empOf(username)
    if (!trainings.some((t) => t.employeeId === e.id)) trainings.push({ id: `trn_${pad(trainings.length + 1, 3)}`, employeeId: e.id, course: 'Cybersecurity awareness', provider: 'In-house', dueDate: addDays(today, 21), status: 'Enrolled' })
  }

  // ---------- Admin: licences, integrations, security, backups ----------
  const adminId = user('admin').id
  const licenceSeeds: Array<[string, string, string, number, number, SoftwareLicence['billing'], number, number]> = [
    ['Microsoft 365 Business Premium', 'Microsoft', 'Productivity', 90, 86, 'Monthly', 1_710_000, 12],
    ['Adobe Acrobat Pro', 'Adobe', 'Productivity', 25, 23, 'Annual', 4_250_000, 140],
    ['AutoCAD LT', 'Autodesk', 'Engineering', 6, 6, 'Annual', 3_900_000, 35],
    ['Zoom Workplace Business', 'Zoom', 'Collaboration', 20, 14, 'Annual', 2_160_000, 210],
    ['Jira Software (Standard)', 'Atlassian', 'Developer tools', 30, 27, 'Monthly', 380_000, 9],
    ['GitHub Team', 'GitHub', 'Developer tools', 12, 9, 'Monthly', 230_000, 9],
    ['Endpoint protection suite', 'Security vendor', 'Security', 110, 98, 'Annual', 5_800_000, 48],
    ['Network monitoring platform (NOC)', 'Monitoring vendor', 'Operations', 1, 1, 'Annual', 9_600_000, 300],
    ['Backup & replication', 'Backup vendor', 'Operations', 40, 31, 'Annual', 3_200_000, -6],
    ['Project scheduling software', 'Scheduling vendor', 'Projects', 8, 8, 'Annual', 1_650_000, 95],
    ['CRM add-on (pilot)', 'CRM vendor', 'Sales', 10, 4, 'Monthly', 150_000, 20],
  ]
  const licences: SoftwareLicence[] = licenceSeeds.map(([product, vendor, category, seats, used, billing, cost, renewIn], i) => {
    const renewalDate = addDays(today, renewIn)
    return {
      id: `lic_${pad(i + 1, 3)}`,
      product,
      vendor,
      category,
      seats,
      seatsUsed: used,
      billing,
      costPerPeriodMinor: naira(cost),
      renewalDate,
      ownerUserId: adminId,
      status: i === 10 ? 'Active' : renewalDate < today ? 'Expired' : renewalDate <= addDays(today, 45) ? 'Renewal due' : 'Active',
    }
  })
  const integrations: Integration[] = [
    { id: 'int_m365', name: 'Microsoft 365', category: 'Productivity', description: 'Calendar, Teams and OneDrive for documents and meetings.', connected: true, lastSync: at(today, 7, 45), account: 'emocom.example tenant' },
    { id: 'int_google', name: 'Google Workspace', category: 'Productivity', description: 'Gmail, Calendar and Drive (alternative to Microsoft 365).', connected: false },
    { id: 'int_email', name: 'Company email (SMTP relay)', category: 'Email', description: 'Send approval notifications and documents by email.', connected: true, lastSync: at(today, 8, 2), account: 'notifications@emocom.example' },
    { id: 'int_sso', name: 'Microsoft Entra ID (SSO)', category: 'Identity', description: 'Sign in with company accounts instead of ERP passwords.', connected: false },
    { id: 'int_paystack', name: 'Paystack', category: 'Payments', description: 'Collect client invoice payments online.', connected: false },
    { id: 'int_flutterwave', name: 'Flutterwave', category: 'Payments', description: 'Collect client invoice payments online.', connected: false },
    { id: 'int_remita', name: 'Remita', category: 'Payments', description: 'Government and statutory payments.', connected: false },
    { id: 'int_github', name: 'GitHub', category: 'Developer tools', description: 'Link development work to projects and tasks.', connected: true, lastSync: at(addDays(today, -1), 18, 30), account: 'emocom (organisation)' },
    { id: 'int_jira', name: 'Jira', category: 'Developer tools', description: 'Sync project tasks with Jira issues.', connected: false },
  ]
  const backups: BackupRecord[] = Array.from({ length: 7 }, (_, i) => ({
    id: `bkp_${i + 1}`,
    at: at(addDays(today, -i), 1, 30),
    kind: 'Automatic' as const,
    sizeKb: 2400 + i * 13,
    status: i === 4 ? ('Failed' as const) : ('Completed' as const),
    by: 'System schedule',
  }))

  // ---------- Notifications for the new modules ----------
  const notifications: AppNotification[] = [
    { id: 'ntf_project_approval', at: at(addDays(today, -1), 9, 15), title: 'Project awaiting your final approval', body: 'Campus network & data centre refresh (₦96m) needs CEO approval.', readBy: [], link: '/approvals', tone: 'warning', audience: { userIds: [user('ceo').id] } },
    { id: 'ntf_cr_ceo', at: at(addDays(today, -1), 11, 40), title: '2 change requests above ₦10m', body: 'Large change requests need the CEO’s decision.', readBy: [], link: '/approvals?tab=changes', tone: 'warning', audience: { userIds: [user('ceo').id] } },
    { id: 'ntf_handover', at: at(addDays(today, -2), 15, 25), title: 'Won deal ready for handover', body: 'Clinic CCTV & visitor management — accept it to set up the project.', readBy: [], link: '/sales?tab=handover', tone: 'info', audience: { departmentIds: [dept('PMO').id, dept('SBD').id] } },
    { id: 'ntf_leave_hr', at: at(addDays(today, -1), 8, 50), title: 'Leave requests waiting', body: 'Review pending leave across the company.', readBy: [], link: '/approvals?tab=leave', tone: 'info', audience: { departmentIds: [dept('HRA').id] } },
    { id: 'ntf_certs', at: at(addDays(today, -3), 10, 5), title: 'Certifications expiring within 60 days', body: 'Plan renewals with team managers.', readBy: [], link: '/hr?tab=learning', tone: 'warning', audience: { departmentIds: [dept('HRA').id] } },
    { id: 'ntf_licences', at: at(addDays(today, -2), 9, 0), title: 'Software renewals due', body: 'Some licences renew within 45 days or have expired.', readBy: [], link: '/admin?tab=licences', tone: 'warning', audience: { userIds: [adminId] } },
    { id: 'ntf_close', at: at(addDays(today, -1), 17, 0), title: `Month-end close in progress`, body: 'Finish the checklist and close last month.', readBy: [], link: '/finance?tab=close', tone: 'info', audience: { departmentIds: [dept('FIN').id] } },
  ]

  return {
    work: {
      partners,
      contacts,
      leads,
      opportunities,
      tenders: createTenders(today, salesOwners, rng),
      proposals: createProposals(today, users, opportunities, departments),
      projects,
      tasks,
      changeRequests,
      statusReports,
      timesheets,
      leaveRequests,
      expenseClaims,
      salaryGrades,
      employeeGrades,
      periodCloses,
      jobOpenings,
      candidates,
      lifecycleChecklists,
      appraisals,
      certifications,
      trainings,
      skills,
      licences,
      integrations,
      securityPolicy: { passwordMinLength: 12, passwordExpiryDays: 90, mfaRequired: true, ssoOnly: false, sessionTimeoutMinutes: 30, lockoutAttempts: 5, ipRestriction: false, updatedAt: at(addDays(today, -40), 10), updatedBy: user('admin').name },
      backups,
    },
    notifications,
  }
}

function createTenders(today: string, owners: string[], rng: ReturnType<typeof rngFrom>): Tender[] {
  const seeds: Array<[Tender['type'], string, string, number, Tender['status'], number]> = [
    ['Tender', 'Statewide emergency radio network', 'Lagos State Emergency Agency (example)', 420_000_000, 'Preparing', 18],
    ['RFQ', 'Supply of 60 enterprise access points', 'Harbourline Bank Plc', 21_000_000, 'Submitted', -4],
    ['EOI', 'Smart city CCTV backbone', 'Abuja Infrastructure Board (example)', 600_000_000, 'Bid / no-bid', 9],
    ['RFQ', 'Fleet tracker renewal — 300 units', 'Northgate Logistics Ltd', 14_000_000, 'Won', -30],
    ['Tender', 'Pipeline SCADA maintenance (3 years)', 'Niger Delta Pipelines Ltd', 156_000_000, 'Submitted', -12],
    ['RFQ', 'Managed print for 4 plants', 'Savannah Cement Manufacturing', 19_000_000, 'Lost', -50],
    ['EOI', 'University campus connectivity', 'Unity Polytechnic', 74_000_000, 'Received', 25],
    ['Tender', 'Hospital network & nurse-call', 'Crestview Specialist Hospital', 38_000_000, 'Preparing', 12],
    ['RFQ', 'Microwave link spares', 'Crestwave Telecom Services', 8_400_000, 'Declined', -8],
    ['Tender', 'Port radio coverage (TETRA)', 'Harbour Freight Terminal', 120_000_000, 'Received', 32],
  ]
  return seeds.map(([type, title, issuer, value, status, dueIn], i) => ({
    id: `tnd_${pad(i + 1, 3)}`,
    ref: `${type === 'Tender' ? 'TND' : type}-${pad(2601 + i, 4)}`,
    type,
    title,
    issuer,
    receivedAt: addDays(today, dueIn - rng.int(14, 35)),
    dueDate: addDays(today, dueIn),
    status,
    valueMinor: naira(value),
    ownerUserId: owners[i % owners.length],
  }))
}

function createProposals(today: string, users: AppUser[], opportunities: Opportunity[], departments: Department[]): Proposal[] {
  const user = (u: string) => users.find((x) => x.username === u)!
  const sbd = departments.find((d) => d.code === 'SBD')!.id
  const stages = ['Requirements gathered', 'Solution design', 'Pricing & bill of quantities', 'Internal review & approval', 'Submitted to client']
  const seeds: Array<[Proposal['kind'], string, string, ProposalStatus, string, number, Array<[string, number, number]>]> = [
    ['Proposal', 'Pipeline telemetry & monitoring', 'Delta Gas Processing', 'Submitted', 'staff.presales', -6, [['RTU & flow meter supply', 24, 2_900_000], ['SCADA software & licences', 1, 31_000_000], ['Installation & commissioning', 1, 38_000_000]]],
    ['Proposal', 'Kiln line SCADA upgrade', 'Atlas Cement Works', 'In review', 'staff.presales', 6, [['PLC & HMI upgrade', 1, 44_000_000], ['Engineering services', 1, 29_000_000], ['Training & documentation', 1, 6_500_000]]],
    ['Quotation', 'Network refresh & security', 'Ikoyi Medical Centre', 'Draft', 'staff.presales', 9, [['Core switch', 2, 2_800_000], ['Next-gen firewall', 2, 2_400_000], ['Access points', 30, 285_000], ['Installation', 1, 2_100_000]]],
    ['Proposal', 'Nurse-call & clinical Wi-Fi', 'Crestview Specialist Hospital', 'Draft', 'staff.presales', 14, [['Wi-Fi design & survey', 1, 3_200_000], ['Access points & licences', 40, 410_000], ['Nurse-call integration', 1, 9_800_000]]],
    ['Quotation', 'Branch security & firewalls', 'Keystone Microfinance Bank', 'Submitted', 'sales.exec', -3, [['Branch firewall', 18, 1_250_000], ['Central management licence', 1, 4_600_000], ['Deployment (18 branches)', 18, 410_000]]],
    ['Quotation', 'Document & records management', 'Primeway Insurance', 'In review', 'sales.bd', 4, [['Document management licences', 120, 85_000], ['Scanning & migration', 1, 4_200_000], ['Implementation', 1, 3_900_000]]],
    ['Proposal', 'Microwave backhaul — 8 links', 'Crestwave Telecom Services', 'Accepted', 'manager.sales', -20, [['Microwave radios & antennas', 16, 2_650_000], ['Tower works & installation', 8, 2_900_000], ['Link planning & licensing support', 1, 6_200_000]]],
    ['Quotation', 'Managed print — head office & plants', 'Savannah Cement Manufacturing', 'Declined', 'sales.bd', -48, [['Multifunction printers (lease)', 24, 520_000], ['Monthly service (12 months)', 12, 640_000]]],
  ]
  return seeds.map(([kind, title, client, status, owner, dueIn, lines], i) => {
    const doneCount = status === 'Draft' ? (i % 2) + 1 : status === 'In review' ? 3 : 5
    const createdAt = addDays(today, dueIn - 21)
    const opp = opportunities.find((o) => o.clientName === client && o.name.startsWith(title.split(' —')[0].slice(0, 12)))
    return {
      id: `prp_${pad(i + 1, 3)}`,
      code: `${kind === 'Proposal' ? 'PRP' : 'QTN'}-${pad(701 + i, 4)}`,
      kind,
      title,
      clientName: client,
      opportunityId: opp?.id,
      ownerUserId: user(owner).id,
      departmentId: sbd,
      lines: lines.map(([description, quantity, price], k) => ({ id: `prpl_${i}_${k}`, description, quantity, unitPriceMinor: naira(price) })),
      milestones: stages.map((name, k) => {
        const due = addDays(createdAt, Math.round(((k + 1) * 21) / stages.length))
        const done = k < doneCount
        return { id: `prp_${i}_ms${k}`, name, dueDate: due, done, doneAt: done ? (due < today ? due : today) : undefined }
      }),
      status,
      dueDate: addDays(today, dueIn),
      createdAt,
      validityDays: kind === 'Quotation' ? 30 : 60,
      notes: 'Prices exclude VAT. Delivery 4–6 weeks from purchase order.',
    }
  })
}

/** Exposed for tests and selectors that need the same calendar helper. */
export { workdays, toISODate }
