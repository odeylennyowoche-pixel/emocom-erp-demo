/**
 * Pure state transitions for the role-based modules (sales, proposals,
 * projects, workspace, HR, payroll/close and admin registries).
 * Each takes the current state and returns a new one; business-rule
 * violations throw DomainError so the UI can show a clear message.
 */
import { LIMITS } from '../config/approvals'
import { addDays, todayISO } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { nextCode, uid } from '../lib/utils'
import type {
  AccessLevel,
  Appraisal,
  AppUser,
  Candidate,
  CandidateStage,
  Certification,
  ChangeRequest,
  Contact,
  DemoState,
  ExpenseClaim,
  JobOpening,
  KPI,
  Lead,
  LeaveRequest,
  Opportunity,
  OpportunityStage,
  Partner,
  Project,
  ProjectHealth,
  ProjectStatus,
  Proposal,
  ProposalStatus,
  SalaryGrade,
  SecurityPolicy,
  SkillRecord,
  SoftwareLicence,
  StatusReport,
  Supplier,
  Task,
  TaskStatus,
  Tender,
  TenderStatus,
  TimesheetEntry,
  TrainingRecord,
  VendorEvaluation,
} from '../types'
import { DomainError, currentUser, now, withActivity, withNotification } from './actions'
import { permissionsFor, type Permissions } from '../features/auth/permissions'
import { canDecideChangeRequest, canDecideClaim, canDecideLeave, canDecideProject, projectNeedsCeo } from '../features/approvals/rules'

function perms(state: DemoState): Permissions {
  return permissionsFor(currentUser(state), state.departments)
}

function ensure(cond: unknown, message: string): asserts cond {
  if (!cond) throw new DomainError(message)
}

function upsert<T extends { id: string }>(list: T[], record: T): T[] {
  return list.some((x) => x.id === record.id) ? list.map((x) => (x.id === record.id ? record : x)) : [record, ...list]
}

function myEmployeeId(state: DemoState): string {
  const id = currentUser(state).employeeId
  ensure(id, 'Your account is not linked to an employee record.')
  return id
}

function canEditSales(p: Permissions, ownerUserId?: string): boolean {
  return p.sales === 'manage' || (p.sales === 'edit' && (!ownerUserId || ownerUserId === p.user.id))
}

// ======================= Sales / CRM =======================

export type LeadInput = Omit<Lead, 'id' | 'createdAt'>

export function saveLead(state: DemoState, input: LeadInput, id?: string): DemoState {
  const p = perms(state)
  const existing = id ? state.leads.find((l) => l.id === id) : undefined
  ensure(canEditSales(p, existing?.ownerUserId), 'You can only edit your own leads.')
  const record: Lead = { ...input, id: id ?? uid('led'), createdAt: existing?.createdAt ?? todayISO() }
  const next = { ...state, leads: upsert(state.leads, record) }
  return withActivity(next, `${id ? 'updated' : 'added'} lead ${record.company}`, 'sales', record.id, '/sales?tab=leads')
}

/** Qualified lead → new opportunity in the pipeline (plus a prospect contact). */
export function convertLead(state: DemoState, id: string): DemoState {
  const p = perms(state)
  const lead = state.leads.find((l) => l.id === id)
  ensure(lead, 'Lead not found.')
  ensure(canEditSales(p, lead.ownerUserId), 'You can only convert your own leads.')
  ensure(lead.status !== 'Converted' && lead.status !== 'Disqualified', `This lead is ${lead.status.toLowerCase()}.`)
  const opp: Opportunity = {
    id: uid('opp'),
    code: nextCode(state.opportunities.map((o) => o.code), 'OPP-'),
    name: lead.interest,
    clientName: lead.company,
    serviceLine: 'To be confirmed',
    stage: 'Qualification',
    valueMinor: lead.estValueMinor,
    expectedClose: addDays(todayISO(), 90),
    ownerUserId: lead.ownerUserId,
    createdAt: todayISO(),
  }
  const contact: Contact = { id: uid('con'), name: lead.contactName, company: lead.company, role: 'Primary contact', email: lead.email, phone: lead.phone, relationship: 'Prospect', ownerUserId: lead.ownerUserId, city: '—' }
  const next: DemoState = {
    ...state,
    leads: state.leads.map((l) => (l.id === id ? { ...l, status: 'Converted' } : l)),
    opportunities: [opp, ...state.opportunities],
    contacts: state.contacts.some((c) => c.email === lead.email) ? state.contacts : [contact, ...state.contacts],
  }
  return withActivity(next, `converted lead ${lead.company} into ${opp.code}`, 'sales', opp.id, '/sales')
}

export type OpportunityInput = Pick<Opportunity, 'name' | 'clientName' | 'serviceLine' | 'valueMinor' | 'expectedClose' | 'ownerUserId' | 'oem'>

export function saveOpportunity(state: DemoState, input: OpportunityInput, id?: string): DemoState {
  const p = perms(state)
  const existing = id ? state.opportunities.find((o) => o.id === id) : undefined
  ensure(canEditSales(p, existing?.ownerUserId), 'You can only edit your own opportunities.')
  const record: Opportunity = existing
    ? { ...existing, ...input }
    : { ...input, id: uid('opp'), code: nextCode(state.opportunities.map((o) => o.code), 'OPP-'), stage: 'Qualification', createdAt: todayISO() }
  return withActivity({ ...state, opportunities: upsert(state.opportunities, record) }, `${id ? 'updated' : 'created'} opportunity ${record.code}`, 'sales', record.id, '/sales')
}

export function setOpportunityStage(state: DemoState, id: string, stage: OpportunityStage, lossReason?: string): DemoState {
  const p = perms(state)
  const opp = state.opportunities.find((o) => o.id === id)
  ensure(opp, 'Opportunity not found.')
  ensure(canEditSales(p, opp.ownerUserId), 'You can only move your own opportunities.')
  ensure(opp.stage !== 'Won' && opp.stage !== 'Lost', `This deal is already ${opp.stage.toLowerCase()}.`)
  if (stage === 'Lost') ensure(lossReason && lossReason.trim().length >= 3, 'Give a reason for the loss.')
  const closed = stage === 'Won' || stage === 'Lost'
  const updated: Opportunity = { ...opp, stage, closedAt: closed ? todayISO() : undefined, lossReason: stage === 'Lost' ? lossReason!.trim() : undefined }
  let next = withActivity({ ...state, opportunities: upsert(state.opportunities, updated) }, `moved ${opp.code} to ${stage}`, 'sales', id, '/sales')
  if (stage === 'Won') {
    next = withNotification(next, { title: `Deal won: ${opp.name}`, body: `${opp.clientName} · ${formatMoney(opp.valueMinor)}. Hand it over to delivery next.`, link: '/sales?tab=handover', tone: 'success' })
  }
  return next
}

export function requestHandover(state: DemoState, id: string, notes: string): DemoState {
  const p = perms(state)
  const opp = state.opportunities.find((o) => o.id === id)
  ensure(opp && opp.stage === 'Won', 'Only won deals can be handed over.')
  ensure(canEditSales(p, opp.ownerUserId), 'Only the deal owner or sales manager can hand over this deal.')
  ensure(!opp.handover, 'This deal has already been handed over.')
  ensure(notes.trim().length >= 5, 'Add handover notes (scope, contacts, documents).')
  const updated: Opportunity = { ...opp, handover: { status: 'Pending', requestedAt: now(), requestedBy: currentUser(state).name, notes: notes.trim() } }
  let next = withActivity({ ...state, opportunities: upsert(state.opportunities, updated) }, `handed over ${opp.code} to delivery`, 'sales', id, '/sales?tab=handover')
  const pmo = state.departments.find((d) => d.code === 'PMO')
  next = withNotification(next, { title: 'Won deal ready for handover', body: `${opp.name} (${opp.clientName}) — accept it to set up the project.`, link: '/sales?tab=handover', tone: 'info', audience: { departmentIds: pmo ? [pmo.id] : [] } })
  return next
}

/** A manager accepts a handover: the project is created (CEO approval needed above the threshold). */
export function acceptHandover(state: DemoState, id: string): DemoState {
  const p = perms(state)
  ensure(p.canManageProjects && p.department?.code !== 'SBD', 'Only a delivery manager can accept a handover.')
  const opp = state.opportunities.find((o) => o.id === id)
  ensure(opp?.handover?.status === 'Pending', 'This handover is not waiting for acceptance.')
  const { state: withProject, record: project } = createProject(state, {
    name: opp.name,
    clientName: opp.clientName,
    contractValueMinor: opp.valueMinor,
    budgetMinor: Math.round((opp.valueMinor * 0.68) / 100) * 100,
    startDate: addDays(todayISO(), 7),
    endDate: addDays(todayISO(), 120),
    memberIds: [],
    opportunityId: opp.id,
  })
  const updated: Opportunity = { ...opp, handover: { ...opp.handover, status: 'Accepted', acceptedBy: currentUser(state).name, projectId: project.id } }
  return withActivity({ ...withProject, opportunities: upsert(withProject.opportunities, updated) }, `accepted handover of ${opp.code}`, 'project', project.id, `/projects/${project.id}`)
}

export type TenderInput = Omit<Tender, 'id' | 'ref'>

export function saveTender(state: DemoState, input: TenderInput, id?: string): DemoState {
  const p = perms(state)
  const existing = id ? state.tenders.find((t) => t.id === id) : undefined
  ensure(canEditSales(p, existing?.ownerUserId), 'You can only edit your own tenders.')
  const prefix = input.type === 'Tender' ? 'TND-' : `${input.type}-`
  const record: Tender = { ...input, id: id ?? uid('tnd'), ref: existing?.ref ?? nextCode(state.tenders.map((t) => t.ref), prefix) }
  return withActivity({ ...state, tenders: upsert(state.tenders, record) }, `${id ? 'updated' : 'registered'} ${record.type} ${record.ref}`, 'sales', record.id, '/sales?tab=tenders')
}

export function setTenderStatus(state: DemoState, id: string, status: TenderStatus): DemoState {
  const t = state.tenders.find((x) => x.id === id)
  ensure(t, 'Tender not found.')
  ensure(canEditSales(perms(state), t.ownerUserId), 'You can only update your own tenders.')
  return withActivity({ ...state, tenders: upsert(state.tenders, { ...t, status }) }, `marked ${t.ref} as ${status.toLowerCase()}`, 'sales', id, '/sales?tab=tenders')
}

export type ContactInput = Omit<Contact, 'id'>

export function saveContact(state: DemoState, input: ContactInput, id?: string): DemoState {
  const p = perms(state)
  ensure(p.sales === 'manage' || p.sales === 'edit' || p.canManageAdmin, 'Your account cannot edit contacts.')
  const record: Contact = { ...input, id: id ?? uid('con') }
  return withActivity({ ...state, contacts: upsert(state.contacts, record) }, `${id ? 'updated' : 'added'} contact ${record.name}`, 'sales', record.id, '/sales?tab=clients')
}

// ======================= Proposals & quotations =======================

export type ProposalInput = Pick<Proposal, 'kind' | 'title' | 'clientName' | 'opportunityId' | 'lines' | 'dueDate' | 'validityDays' | 'notes'>

const PROPOSAL_STAGES = ['Requirements gathered', 'Solution design', 'Pricing & bill of quantities', 'Internal review & approval', 'Submitted to client']

function canEditProposal(p: Permissions, pr: Proposal): boolean {
  if (pr.ownerUserId === p.user.id) return true
  return p.proposals === 'department' && pr.departmentId === p.user.departmentId && (p.role === 'Manager' || p.sales === 'manage')
}

export function saveProposal(state: DemoState, input: ProposalInput, id?: string): { state: DemoState; record: Proposal } {
  const p = perms(state)
  ensure(p.proposals !== 'none' && !p.readOnly, 'Your account cannot build proposals.')
  ensure(input.lines.length > 0, 'Add at least one line item.')
  const existing = id ? state.proposals.find((x) => x.id === id) : undefined
  if (existing) {
    ensure(canEditProposal(p, existing), 'You can only edit your own proposals.')
    ensure(existing.status === 'Draft' || existing.status === 'In review', `A ${existing.status.toLowerCase()} proposal cannot be edited.`)
  }
  const today = todayISO()
  const record: Proposal = existing
    ? { ...existing, ...input }
    : {
        ...input,
        id: uid('prp'),
        code: nextCode(state.proposals.filter((x) => x.kind === input.kind).map((x) => x.code), input.kind === 'Proposal' ? 'PRP-' : 'QTN-'),
        ownerUserId: p.user.id,
        departmentId: p.user.departmentId,
        status: 'Draft',
        createdAt: today,
        milestones: PROPOSAL_STAGES.map((name, k) => ({ id: uid('ms'), name, dueDate: addDays(today, Math.max(1, Math.round(((k + 1) * (Math.max(5, (Date.parse(input.dueDate) - Date.parse(today)) / 86_400_000))) / PROPOSAL_STAGES.length))), done: false })),
      }
  const next = withActivity({ ...state, proposals: upsert(state.proposals, record) }, `${id ? 'updated' : 'created'} ${record.kind.toLowerCase()} ${record.code}`, 'sales', record.id, `/proposals/${record.id}`)
  return { state: next, record }
}

export function toggleProposalMilestone(state: DemoState, id: string, milestoneId: string): DemoState {
  const pr = state.proposals.find((x) => x.id === id)
  ensure(pr, 'Proposal not found.')
  ensure(canEditProposal(perms(state), pr), 'You can only update your own proposals.')
  const updated: Proposal = { ...pr, milestones: pr.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done, doneAt: !m.done ? todayISO() : undefined } : m)) }
  return { ...state, proposals: upsert(state.proposals, updated) }
}

export function setProposalStatus(state: DemoState, id: string, status: ProposalStatus): DemoState {
  const pr = state.proposals.find((x) => x.id === id)
  ensure(pr, 'Proposal not found.')
  ensure(canEditProposal(perms(state), pr), 'You can only update your own proposals.')
  const allowed: Record<ProposalStatus, ProposalStatus[]> = { Draft: ['In review'], 'In review': ['Draft', 'Submitted'], Submitted: ['Accepted', 'Declined'], Accepted: [], Declined: [] }
  ensure(allowed[pr.status].includes(status), `Cannot move a ${pr.status.toLowerCase()} proposal to ${status.toLowerCase()}.`)
  const p = perms(state)
  // internal review: the manager (or sales manager) signs off before it goes to the client
  if (pr.status === 'In review' && status === 'Submitted') ensure(p.role === 'Manager' || p.sales === 'manage', 'Internal review is signed off by your manager before submission.')
  const milestones = status === 'Submitted' ? pr.milestones.map((m) => (m.done ? m : { ...m, done: true, doneAt: todayISO() })) : pr.milestones
  return withActivity({ ...state, proposals: upsert(state.proposals, { ...pr, status, milestones }) }, `marked ${pr.code} as ${status.toLowerCase()}`, 'sales', id, `/proposals/${id}`)
}

// ======================= Projects, tasks, change requests =======================

export type ProjectInput = Pick<Project, 'name' | 'clientName' | 'contractValueMinor' | 'budgetMinor' | 'startDate' | 'endDate' | 'memberIds' | 'opportunityId'>

export function createProject(state: DemoState, input: ProjectInput): { state: DemoState; record: Project } {
  const p = perms(state)
  ensure(p.canManageProjects, 'Only managers can set up projects.')
  ensure(input.endDate > input.startDate, 'The end date must be after the start date.')
  const needsCeo = projectNeedsCeo(input.contractValueMinor)
  const span = (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86_400_000
  const names = ['Design sign-off', 'Equipment delivered', 'Installation complete', 'Testing & commissioning', 'Client acceptance']
  const record: Project = {
    ...input,
    id: uid('prj'),
    code: nextCode(state.projects.map((x) => x.code), 'PRJ-'),
    departmentId: p.user.departmentId,
    managerUserId: p.user.id,
    costToDateMinor: 0,
    status: needsCeo ? 'Pending approval' : 'Planning',
    health: 'On track',
    milestones: names.map((name, k) => ({ id: uid('ms'), name, dueDate: addDays(input.startDate, Math.round((span * (k + 1)) / names.length)), done: false })),
    createdAt: todayISO(),
  }
  let next = withActivity({ ...state, projects: [record, ...state.projects] }, `set up project ${record.code}`, 'project', record.id, `/projects/${record.id}`)
  if (needsCeo) {
    const ceo = state.users.filter((u) => u.level === 'Main Admin').map((u) => u.id)
    next = withNotification(next, { title: 'Project awaiting your final approval', body: `${record.name} (${formatMoney(record.contractValueMinor)}) is above ${formatMoney(LIMITS.ceoProjectThresholdMinor)}.`, link: '/approvals?tab=projects', tone: 'warning', audience: { userIds: ceo } })
  }
  return { state: next, record }
}

export function decideProject(state: DemoState, id: string, approve: boolean, note?: string): DemoState {
  const project = state.projects.find((x) => x.id === id)
  ensure(project, 'Project not found.')
  const d = canDecideProject(perms(state), project)
  ensure(d.allowed, d.reason ?? 'Not allowed.')
  if (!approve) ensure(note && note.trim().length >= 5, 'Give a reason for rejecting.')
  const updated: Project = approve ? { ...project, status: 'Planning', approval: { by: currentUser(state).name, at: now(), note } } : { ...project, status: 'Rejected', rejectionReason: note!.trim() }
  let next = withActivity({ ...state, projects: upsert(state.projects, updated) }, `${approve ? 'approved' : 'rejected'} project ${project.code}`, 'project', id, `/projects/${id}`, project.departmentId)
  next = withNotification(next, { title: `${project.code} ${approve ? 'approved' : 'rejected'}`, body: approve ? `${project.name} can start planning.` : `Reason: ${note}`, link: `/projects/${id}`, tone: approve ? 'success' : 'danger', audience: { userIds: [project.managerUserId] } })
  return next
}

function canManageProject(p: Permissions, project: Project): boolean {
  return p.canManageProjects && project.departmentId === p.user.departmentId
}

export function updateProjectStatus(state: DemoState, id: string, status: ProjectStatus, health: ProjectHealth): DemoState {
  const project = state.projects.find((x) => x.id === id)
  ensure(project, 'Project not found.')
  ensure(canManageProject(perms(state), project), 'Only the project’s manager can change its status.')
  ensure(project.status !== 'Pending approval' && project.status !== 'Rejected', 'This project has not been approved.')
  ensure(status !== 'Pending approval' && status !== 'Rejected', 'Choose Planning, Active, On hold or Completed.')
  return withActivity({ ...state, projects: upsert(state.projects, { ...project, status, health }) }, `set ${project.code} to ${status} (${health})`, 'project', id, `/projects/${id}`, project.departmentId)
}

export function setProjectMembers(state: DemoState, id: string, memberIds: string[]): DemoState {
  const project = state.projects.find((x) => x.id === id)
  ensure(project, 'Project not found.')
  ensure(canManageProject(perms(state), project), 'Only the project’s manager can assign the team.')
  return withActivity({ ...state, projects: upsert(state.projects, { ...project, memberIds }) }, `updated the team on ${project.code}`, 'project', id, `/projects/${id}`, project.departmentId)
}

export function toggleProjectMilestone(state: DemoState, id: string, milestoneId: string): DemoState {
  const project = state.projects.find((x) => x.id === id)
  ensure(project, 'Project not found.')
  ensure(canManageProject(perms(state), project), 'Only the project’s manager can update milestones.')
  const milestones = project.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done, doneAt: !m.done ? todayISO() : undefined } : m))
  return { ...state, projects: upsert(state.projects, { ...project, milestones }) }
}

export type TaskInput = Pick<Task, 'projectId' | 'title' | 'assigneeId' | 'startDate' | 'dueDate' | 'estimateHours' | 'milestoneId'>

export function saveTask(state: DemoState, input: TaskInput, id?: string): DemoState {
  const project = state.projects.find((x) => x.id === input.projectId)
  ensure(project, 'Project not found.')
  ensure(canManageProject(perms(state), project), 'Only the project’s manager can assign tasks.')
  ensure(input.dueDate >= input.startDate, 'The due date must be on or after the start date.')
  const existing = id ? state.tasks.find((t) => t.id === id) : undefined
  const record: Task = existing ? { ...existing, ...input } : { ...input, id: uid('tsk'), status: 'To do', assignedBy: currentUser(state).name }
  let next = withActivity({ ...state, tasks: upsert(state.tasks, record) }, `${id ? 'reassigned' : 'assigned'} task “${record.title}”`, 'project', project.id, `/projects/${project.id}`, project.departmentId)
  // keep the assignee on the project team
  if (!project.memberIds.includes(input.assigneeId)) next = { ...next, projects: upsert(next.projects, { ...project, memberIds: [...project.memberIds, input.assigneeId] }) }
  const assigneeUser = state.users.find((u) => u.employeeId === input.assigneeId)
  if (assigneeUser && !id) next = withNotification(next, { title: 'New task assigned to you', body: `${record.title} · ${project.name}`, link: '/workspace', tone: 'info', audience: { userIds: [assigneeUser.id] } })
  return next
}

/** The assignee (or their manager) updates progress; completion requires a note. */
export function setTaskStatus(state: DemoState, id: string, status: TaskStatus, note?: string): DemoState {
  const task = state.tasks.find((t) => t.id === id)
  ensure(task, 'Task not found.')
  const p = perms(state)
  const project = state.projects.find((x) => x.id === task.projectId)
  const mine = task.assigneeId === p.user.employeeId
  ensure(mine || (project && canManageProject(p, project)), 'You can only update tasks assigned to you.')
  if (status === 'Done') ensure(note && note.trim().length >= 3, 'Add a short completion note.')
  const updated: Task = { ...task, status, completedAt: status === 'Done' ? now() : undefined, completionNote: status === 'Done' ? note!.trim() : task.completionNote }
  let next = withActivity({ ...state, tasks: upsert(state.tasks, updated) }, status === 'Done' ? `completed task “${task.title}”` : `moved task “${task.title}” to ${status.toLowerCase()}`, 'project', task.projectId, `/projects/${task.projectId}`, project?.departmentId)
  if (status === 'Done' && project && mine) next = withNotification(next, { title: 'Task completed', body: `${task.title} · ${project.name}`, link: `/projects/${project.id}`, tone: 'success', audience: { userIds: [project.managerUserId] } })
  return next
}

export type ChangeRequestInput = Pick<ChangeRequest, 'projectId' | 'title' | 'description' | 'costImpactMinor' | 'daysImpact'>

export function raiseChangeRequest(state: DemoState, input: ChangeRequestInput): DemoState {
  const project = state.projects.find((x) => x.id === input.projectId)
  ensure(project, 'Project not found.')
  const p = perms(state)
  ensure(canManageProject(p, project) || project.memberIds.includes(p.user.employeeId ?? ''), 'Only the project team can raise change requests.')
  const me = currentUser(state)
  const record: ChangeRequest = { ...input, id: uid('chr'), code: nextCode(state.changeRequests.map((c) => c.code), 'CR-'), status: 'Pending', raisedBy: me.name, raisedByUserId: me.id, raisedAt: now() }
  let next = withActivity({ ...state, changeRequests: [record, ...state.changeRequests] }, `raised change request ${record.code}`, 'project', project.id, `/projects/${project.id}`, project.departmentId)
  const toCeo = record.costImpactMinor > LIMITS.managerChangeRequestMinor
  next = withNotification(next, {
    title: `Change request ${record.code} needs a decision`,
    body: `${record.title} · ${formatMoney(record.costImpactMinor)}${toCeo ? ' (above the manager limit — CEO decides)' : ''}`,
    link: '/approvals?tab=changes',
    tone: 'warning',
    audience: { userIds: toCeo ? state.users.filter((u) => u.level === 'Main Admin').map((u) => u.id) : [project.managerUserId] },
  })
  return next
}

export function decideChangeRequest(state: DemoState, id: string, approve: boolean, note?: string): DemoState {
  const cr = state.changeRequests.find((c) => c.id === id)
  ensure(cr, 'Change request not found.')
  const project = state.projects.find((x) => x.id === cr.projectId)
  const d = canDecideChangeRequest(perms(state), cr, project)
  ensure(d.allowed, d.reason ?? 'Not allowed.')
  if (!approve) ensure(note && note.trim().length >= 5, 'Give a reason for rejecting.')
  const updated: ChangeRequest = { ...cr, status: approve ? 'Approved' : 'Rejected', decidedBy: currentUser(state).name, decidedAt: now(), decisionNote: note?.trim() || undefined }
  let next: DemoState = { ...state, changeRequests: upsert(state.changeRequests, updated) }
  if (approve && project) {
    // approved scope changes adjust contract value, budget and end date
    next = { ...next, projects: upsert(next.projects, { ...project, contractValueMinor: project.contractValueMinor + cr.costImpactMinor, budgetMinor: project.budgetMinor + Math.round(cr.costImpactMinor * 0.7), endDate: addDays(project.endDate, cr.daysImpact) }) }
  }
  next = withActivity(next, `${approve ? 'approved' : 'rejected'} change request ${cr.code}`, 'project', cr.projectId, `/projects/${cr.projectId}`, project?.departmentId)
  return withNotification(next, { title: `${cr.code} ${approve ? 'approved' : 'rejected'}`, body: approve ? cr.title : `Reason: ${note}`, link: `/projects/${cr.projectId}`, tone: approve ? 'success' : 'danger', audience: { userIds: [cr.raisedByUserId] } })
}

export type StatusReportInput = Pick<StatusReport, 'health' | 'summary' | 'nextSteps'>

export function addStatusReport(state: DemoState, projectId: string, input: StatusReportInput, percentComplete: number): DemoState {
  const project = state.projects.find((x) => x.id === projectId)
  ensure(project, 'Project not found.')
  ensure(canManageProject(perms(state), project), 'Only the project’s manager can publish status reports.')
  const record: StatusReport = { ...input, id: uid('str'), projectId, at: now(), author: currentUser(state).name, percentComplete }
  const next: DemoState = { ...state, statusReports: [record, ...state.statusReports], projects: upsert(state.projects, { ...project, health: input.health }) }
  return withActivity(next, `published a status report for ${project.code}`, 'project', projectId, `/projects/${projectId}`, project.departmentId)
}

// ======================= My workspace =======================

export type TimesheetInput = Pick<TimesheetEntry, 'date' | 'projectId' | 'taskId' | 'hours' | 'note'>

export function addTimesheetEntry(state: DemoState, input: TimesheetInput): DemoState {
  const empId = myEmployeeId(state)
  ensure(input.hours > 0 && input.hours <= 12, 'Hours must be between 0.5 and 12.')
  ensure(input.date <= todayISO(), 'You cannot log time for a future date.')
  const dayTotal = state.timesheets.filter((t) => t.employeeId === empId && t.date === input.date).reduce((s, t) => s + t.hours, 0)
  ensure(dayTotal + input.hours <= 14, `You already logged ${dayTotal}h on this day; the daily maximum is 14h.`)
  const project = state.projects.find((p) => p.id === input.projectId)
  ensure(project?.memberIds.includes(empId), 'You can only log time on projects you are assigned to.')
  const record: TimesheetEntry = { ...input, id: uid('tms'), employeeId: empId }
  return { ...state, timesheets: [record, ...state.timesheets] }
}

export function deleteTimesheetEntry(state: DemoState, id: string): DemoState {
  const entry = state.timesheets.find((t) => t.id === id)
  ensure(entry && entry.employeeId === currentUser(state).employeeId, 'You can only remove your own entries.')
  return { ...state, timesheets: state.timesheets.filter((t) => t.id !== id) }
}

export type LeaveInput = Pick<LeaveRequest, 'type' | 'startDate' | 'endDate' | 'reason'>

/** Working days between two dates (Mon–Fri). */
export function workingDays(start: string, end: string): number {
  let n = 0
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = new Date(d + 'T00:00:00').getDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}

export function requestLeave(state: DemoState, input: LeaveInput): DemoState {
  const empId = myEmployeeId(state)
  ensure(input.endDate >= input.startDate, 'The end date must be on or after the start date.')
  const days = workingDays(input.startDate, input.endDate)
  ensure(days > 0, 'The selected dates contain no working days.')
  const overlap = state.leaveRequests.some((l) => l.employeeId === empId && l.status !== 'Rejected' && l.startDate <= input.endDate && l.endDate >= input.startDate)
  ensure(!overlap, 'You already have leave booked on some of these dates.')
  const record: LeaveRequest = { ...input, id: uid('lev'), employeeId: empId, days, status: 'Pending', createdAt: now() }
  let next = withActivity({ ...state, leaveRequests: [record, ...state.leaveRequests] }, `requested ${days} day(s) of ${input.type.toLowerCase()} leave`, 'leave', record.id, '/workspace?tab=leave')
  const me = currentUser(state)
  const dept = state.departments.find((d) => d.id === me.departmentId)
  const manager = state.users.find((u) => u.employeeId === dept?.headEmployeeId && u.id !== me.id)
  const hr = state.users.filter((u) => u.level === 'HR').map((u) => u.id)
  next = withNotification(next, { title: 'Leave request to review', body: `${me.name}: ${days} day(s) ${input.type.toLowerCase()} leave from ${input.startDate}.`, link: '/approvals?tab=leave', tone: 'info', audience: { userIds: [...(manager ? [manager.id] : []), ...hr] } })
  return next
}

export function cancelLeave(state: DemoState, id: string): DemoState {
  const leave = state.leaveRequests.find((l) => l.id === id)
  ensure(leave && leave.employeeId === currentUser(state).employeeId, 'You can only cancel your own leave.')
  ensure(leave.status === 'Pending', 'Only pending requests can be cancelled.')
  return { ...state, leaveRequests: state.leaveRequests.filter((l) => l.id !== id) }
}

export function decideLeave(state: DemoState, id: string, approve: boolean, note?: string): DemoState {
  const leave = state.leaveRequests.find((l) => l.id === id)
  ensure(leave, 'Leave request not found.')
  const d = canDecideLeave(perms(state), leave, state)
  ensure(d.allowed, d.reason ?? 'Not allowed.')
  if (!approve) ensure(note && note.trim().length >= 5, 'Give a reason for declining.')
  const updated: LeaveRequest = { ...leave, status: approve ? 'Approved' : 'Rejected', decidedBy: currentUser(state).name, decidedAt: now(), decisionNote: note?.trim() || undefined }
  const emp = state.employees.find((e) => e.id === leave.employeeId)
  let next = withActivity({ ...state, leaveRequests: upsert(state.leaveRequests, updated) }, `${approve ? 'approved' : 'declined'} leave for ${emp ? `${emp.firstName} ${emp.lastName}` : 'an employee'}`, 'leave', id, '/approvals?tab=leave', emp?.departmentId)
  const u = state.users.find((x) => x.employeeId === leave.employeeId)
  if (u) next = withNotification(next, { title: `Leave ${approve ? 'approved' : 'declined'}`, body: `${leave.type} leave from ${leave.startDate}${approve ? '' : ` — ${note}`}`, link: '/workspace?tab=leave', tone: approve ? 'success' : 'danger', audience: { userIds: [u.id] } })
  return next
}

export type ClaimInput = Pick<ExpenseClaim, 'date' | 'category' | 'description' | 'amountMinor' | 'projectId'>

export function submitClaim(state: DemoState, input: ClaimInput): DemoState {
  const empId = myEmployeeId(state)
  ensure(input.amountMinor > 0, 'Enter an amount.')
  ensure(input.date <= todayISO(), 'The expense date cannot be in the future.')
  const record: ExpenseClaim = { ...input, id: uid('clm'), code: nextCode(state.expenseClaims.map((c) => c.code), 'CLM-'), employeeId: empId, status: 'Pending' }
  return withActivity({ ...state, expenseClaims: [record, ...state.expenseClaims] }, `submitted expense claim ${record.code}`, 'claim', record.id, '/workspace?tab=leave')
}

export function decideClaim(state: DemoState, id: string, approve: boolean, note?: string): DemoState {
  const claim = state.expenseClaims.find((c) => c.id === id)
  ensure(claim, 'Claim not found.')
  const d = canDecideClaim(perms(state), claim, state)
  ensure(d.allowed, d.reason ?? 'Not allowed.')
  if (!approve) ensure(note && note.trim().length >= 5, 'Give a reason for rejecting.')
  const updated: ExpenseClaim = { ...claim, status: approve ? 'Approved' : 'Rejected', decidedBy: currentUser(state).name, decidedAt: now(), decisionNote: note?.trim() || undefined }
  const emp = state.employees.find((e) => e.id === claim.employeeId)
  return withActivity({ ...state, expenseClaims: upsert(state.expenseClaims, updated) }, `${approve ? 'approved' : 'rejected'} claim ${claim.code}`, 'claim', id, '/approvals?tab=claims', emp?.departmentId)
}

export function payClaim(state: DemoState, id: string): DemoState {
  ensure(perms(state).canPayClaims, 'Only Finance can pay claims.')
  const claim = state.expenseClaims.find((c) => c.id === id)
  ensure(claim?.status === 'Approved', 'Only approved claims can be paid.')
  return withActivity({ ...state, expenseClaims: upsert(state.expenseClaims, { ...claim, status: 'Paid' }) }, `paid claim ${claim.code}`, 'claim', id, '/finance?tab=payables')
}

export function addSkill(state: DemoState, name: string, level: SkillRecord['level']): DemoState {
  const empId = myEmployeeId(state)
  ensure(name.trim().length >= 2, 'Enter a skill name.')
  ensure(!state.skills.some((s) => s.employeeId === empId && s.name.toLowerCase() === name.trim().toLowerCase()), 'This skill is already on your profile.')
  return { ...state, skills: [{ id: uid('skl'), employeeId: empId, name: name.trim(), level }, ...state.skills] }
}

export function removeSkill(state: DemoState, id: string): DemoState {
  const s = state.skills.find((x) => x.id === id)
  ensure(s && s.employeeId === currentUser(state).employeeId, 'You can only edit your own skills.')
  return { ...state, skills: state.skills.filter((x) => x.id !== id) }
}

export type CertificationInput = Pick<Certification, 'name' | 'issuer' | 'issued' | 'expires'>

export function saveCertification(state: DemoState, input: CertificationInput, id?: string): DemoState {
  const empId = myEmployeeId(state)
  if (id) ensure(state.certifications.find((c) => c.id === id)?.employeeId === empId, 'You can only edit your own certifications.')
  ensure(!input.expires || input.expires > input.issued, 'The expiry date must be after the issue date.')
  const record: Certification = { ...input, id: id ?? uid('crt'), employeeId: empId }
  return withActivity({ ...state, certifications: upsert(state.certifications, record) }, `${id ? 'updated' : 'added'} certification ${input.name}`, 'hr', record.id, '/workspace?tab=skills')
}

export function removeCertification(state: DemoState, id: string): DemoState {
  const c = state.certifications.find((x) => x.id === id)
  ensure(c && c.employeeId === currentUser(state).employeeId, 'You can only remove your own certifications.')
  return { ...state, certifications: state.certifications.filter((x) => x.id !== id) }
}

// ======================= HR =======================

function requireHR(state: DemoState) {
  ensure(perms(state).canManageHR, 'Only HR can do this.')
}

export type OpeningInput = Pick<JobOpening, 'title' | 'departmentId' | 'openings' | 'status' | 'hiringManagerUserId'>

export function saveOpening(state: DemoState, input: OpeningInput, id?: string): DemoState {
  requireHR(state)
  const existing = id ? state.jobOpenings.find((j) => j.id === id) : undefined
  const record: JobOpening = { ...input, id: id ?? uid('job'), code: existing?.code ?? nextCode(state.jobOpenings.map((j) => j.code), 'JOB-', 3), postedAt: existing?.postedAt ?? todayISO() }
  return withActivity({ ...state, jobOpenings: upsert(state.jobOpenings, record) }, `${id ? 'updated' : 'opened'} vacancy ${record.title}`, 'hr', record.id, '/hr?tab=recruitment')
}

export function addCandidate(state: DemoState, input: Pick<Candidate, 'openingId' | 'name' | 'email' | 'source'>): DemoState {
  requireHR(state)
  const record: Candidate = { ...input, id: uid('cnd'), stage: 'Applied', appliedAt: todayISO() }
  return withActivity({ ...state, candidates: [record, ...state.candidates] }, `added candidate ${record.name}`, 'hr', record.id, '/hr?tab=recruitment')
}

export function moveCandidate(state: DemoState, id: string, stage: CandidateStage): DemoState {
  requireHR(state)
  const c = state.candidates.find((x) => x.id === id)
  ensure(c, 'Candidate not found.')
  ensure(c.stage !== 'Hired' && c.stage !== 'Rejected', `${c.name} is already ${c.stage.toLowerCase()}.`)
  return withActivity({ ...state, candidates: upsert(state.candidates, { ...c, stage }) }, `moved ${c.name} to ${stage}`, 'hr', id, '/hr?tab=recruitment')
}

export function toggleLifecycleItem(state: DemoState, id: string, index: number): DemoState {
  requireHR(state)
  const cl = state.lifecycleChecklists.find((x) => x.id === id)
  ensure(cl, 'Checklist not found.')
  return { ...state, lifecycleChecklists: upsert(state.lifecycleChecklists, { ...cl, items: cl.items.map((it, i) => (i === index ? { ...it, done: !it.done } : it)) }) }
}

export function startLifecycle(state: DemoState, employeeId: string, kind: 'Onboarding' | 'Offboarding'): DemoState {
  requireHR(state)
  ensure(!state.lifecycleChecklists.some((c) => c.employeeId === employeeId && c.kind === kind), `An ${kind.toLowerCase()} checklist already exists for this employee.`)
  const items =
    kind === 'Onboarding'
      ? ['Offer letter signed', 'Laptop & email account issued', 'ERP account created', 'HMO enrolment', 'Pension details captured', 'Induction & HSE training', 'Probation objectives set']
      : ['Resignation accepted', 'Handover plan completed', 'Company assets returned', 'Accounts & access disabled', 'Final settlement computed', 'Exit interview held']
  const record = { id: uid('lfc'), kind, employeeId, startDate: todayISO(), items: items.map((label) => ({ label, done: false })) }
  const emp = state.employees.find((e) => e.id === employeeId)
  return withActivity({ ...state, lifecycleChecklists: [record, ...state.lifecycleChecklists] }, `started ${kind.toLowerCase()} for ${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(), 'hr', record.id, '/hr?tab=lifecycle')
}

/** Managers appraise their own team; HR can complete any appraisal. */
export function saveAppraisal(state: DemoState, id: string, kpis: KPI[], comments: string, complete: boolean): DemoState {
  const p = perms(state)
  const a = state.appraisals.find((x) => x.id === id)
  ensure(a, 'Appraisal not found.')
  ensure(a.status !== 'Completed', 'This appraisal is already completed.')
  ensure(a.reviewerId === p.user.employeeId || p.canManageHR, 'Only the reviewer (the employee’s manager) or HR can appraise.')
  if (complete) ensure(kpis.every((k) => k.score && k.score >= 1 && k.score <= 5), 'Score every KPI from 1 to 5 before completing.')
  const scored = kpis.filter((k) => k.score)
  const overall = scored.length ? Math.round((scored.reduce((s, k) => s + (k.score ?? 0) * k.weight, 0) / scored.reduce((s, k) => s + k.weight, 0)) * 10) / 10 : undefined
  const updated: Appraisal = { ...a, kpis, comments, overall, status: complete ? 'Completed' : 'Manager review', completedAt: complete ? now() : undefined }
  const emp = state.employees.find((e) => e.id === a.employeeId)
  return withActivity({ ...state, appraisals: upsert(state.appraisals, updated) }, `${complete ? 'completed' : 'saved'} the ${a.period} appraisal for ${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(), 'hr', id, '/team?tab=appraisals', emp?.departmentId)
}

export function saveTraining(state: DemoState, input: Omit<TrainingRecord, 'id'>, id?: string): DemoState {
  requireHR(state)
  const record: TrainingRecord = { ...input, id: id ?? uid('trn') }
  return withActivity({ ...state, trainings: upsert(state.trainings, record) }, `${id ? 'updated' : 'enrolled'} training: ${record.course}`, 'hr', record.id, '/hr?tab=learning')
}

// ======================= Finance: payroll & close =======================

export function saveSalaryGrade(state: DemoState, grade: SalaryGrade): DemoState {
  ensure(perms(state).canRunPayroll, 'Only Finance can change salary structures.')
  ensure(grade.basicMinor > 0, 'Basic salary must be greater than zero.')
  return withActivity({ ...state, salaryGrades: state.salaryGrades.map((g) => (g.code === grade.code ? grade : g)) }, `updated salary grade ${grade.code}`, 'finance', undefined, '/finance?tab=payroll')
}

export function setEmployeeGrade(state: DemoState, employeeId: string, code: string): DemoState {
  ensure(perms(state).canRunPayroll, 'Only Finance can change salary grades.')
  return { ...state, employeeGrades: { ...state.employeeGrades, [employeeId]: code } }
}

export function toggleCloseItem(state: DemoState, id: string, index: number): DemoState {
  ensure(perms(state).role === 'Finance', 'Only Finance works on the close checklist.')
  const pc = state.periodCloses.find((x) => x.id === id)
  ensure(pc, 'Period not found.')
  ensure(pc.status !== 'Closed', 'This period is closed.')
  return { ...state, periodCloses: upsert(state.periodCloses, { ...pc, status: 'In progress', checklist: pc.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)) }) }
}

export function closePeriod(state: DemoState, id: string): DemoState {
  ensure(perms(state).canClosePeriods, 'Only the finance manager can close a period.')
  const pc = state.periodCloses.find((x) => x.id === id)
  ensure(pc, 'Period not found.')
  ensure(pc.status !== 'Closed', 'This period is already closed.')
  ensure(pc.checklist.every((c) => c.done), 'Complete every checklist item before closing.')
  return withActivity({ ...state, periodCloses: upsert(state.periodCloses, { ...pc, status: 'Closed', closedBy: currentUser(state).name, closedAt: now() }) }, `closed ${pc.kind.toLowerCase()} ${pc.period}`, 'finance', id, '/finance?tab=close')
}

// ======================= Admin =======================

function requireAdmin(state: DemoState) {
  ensure(perms(state).canManageAdmin, 'Only the system administrator can do this.')
}

export function savePartner(state: DemoState, input: Omit<Partner, 'id'>, id?: string): DemoState {
  requireAdmin(state)
  const record: Partner = { ...input, id: id ?? uid('ptn') }
  return withActivity({ ...state, partners: upsert(state.partners, record) }, `${id ? 'updated' : 'registered'} partner ${record.name}`, 'admin', record.id, '/admin?tab=partners')
}

export function registerVendor(state: DemoState, input: Omit<Supplier, 'id' | 'code'>): DemoState {
  requireAdmin(state)
  const record: Supplier = { ...input, id: uid('sup'), code: nextCode(state.suppliers.map((s) => s.code), 'SUP-', 3) }
  return withActivity({ ...state, suppliers: [...state.suppliers, record] }, `registered ${(record.kind ?? 'vendor').toLowerCase()} ${record.name}`, 'supplier', record.id, '/admin?tab=vendors')
}

export function evaluateVendor(state: DemoState, id: string, scores: Omit<VendorEvaluation, 'evaluatedAt' | 'evaluatedBy'>, registration: NonNullable<Supplier['registration']>): DemoState {
  requireAdmin(state)
  const s = state.suppliers.find((x) => x.id === id)
  ensure(s, 'Vendor not found.')
  const evaluation: VendorEvaluation = { ...scores, evaluatedAt: todayISO(), evaluatedBy: currentUser(state).name }
  const avg = Math.round((scores.quality + scores.delivery + scores.price + scores.compliance) / 4)
  const updated: Supplier = { ...s, evaluation, registration, rating: avg, active: registration !== 'Suspended' }
  return withActivity({ ...state, suppliers: upsert(state.suppliers, updated) }, `evaluated ${s.name} (${registration.toLowerCase()})`, 'supplier', id, '/admin?tab=vendors')
}

export function saveLicence(state: DemoState, input: Omit<SoftwareLicence, 'id'>, id?: string): DemoState {
  requireAdmin(state)
  ensure(input.seatsUsed <= input.seats, 'Seats in use cannot exceed seats purchased.')
  const record: SoftwareLicence = { ...input, id: id ?? uid('lic') }
  return withActivity({ ...state, licences: upsert(state.licences, record) }, `${id ? 'updated' : 'added'} licence ${record.product}`, 'admin', record.id, '/admin?tab=licences')
}

export function createUserAccount(state: DemoState, input: { username: string; employeeId: string; level: AccessLevel }): DemoState {
  requireAdmin(state)
  const username = input.username.trim().toLowerCase()
  ensure(/^[a-z][a-z0-9._-]{2,31}$/.test(username), 'Usernames use 3–32 lowercase letters, numbers, dots or dashes.')
  ensure(!state.users.some((u) => u.username === username), 'That username is taken.')
  ensure(!state.users.some((u) => u.employeeId === input.employeeId), 'This employee already has an account.')
  const emp = state.employees.find((e) => e.id === input.employeeId)
  ensure(emp, 'Choose an employee.')
  const record: AppUser = {
    id: uid('usr'),
    username,
    name: `${emp.firstName} ${emp.lastName}`,
    email: emp.email,
    title: emp.jobTitle,
    level: input.level,
    departmentId: emp.departmentId,
    employeeId: emp.id,
    status: 'Active',
    lastActiveAt: now(),
  }
  return withActivity({ ...state, users: [...state.users, record] }, `created the ${input.level} account @${username} for ${record.name}`, 'system', undefined, '/admin?tab=users')
}

export function toggleIntegration(state: DemoState, id: string): DemoState {
  requireAdmin(state)
  const it = state.integrations.find((x) => x.id === id)
  ensure(it, 'Integration not found.')
  const connected = !it.connected
  const updated = { ...it, connected, lastSync: connected ? now() : it.lastSync, account: connected ? it.account ?? 'demo connection (simulated)' : it.account }
  return withActivity({ ...state, integrations: upsert(state.integrations, updated) }, `${connected ? 'connected' : 'disconnected'} ${it.name} (simulated)`, 'admin', id, '/admin?tab=integrations')
}

export function updateSecurityPolicy(state: DemoState, policy: Omit<SecurityPolicy, 'updatedAt' | 'updatedBy'>): DemoState {
  requireAdmin(state)
  ensure(policy.passwordMinLength >= 8 && policy.passwordMinLength <= 64, 'Minimum password length must be between 8 and 64.')
  ensure(policy.sessionTimeoutMinutes >= 5 && policy.sessionTimeoutMinutes <= 480, 'Session timeout must be between 5 and 480 minutes.')
  return withActivity({ ...state, securityPolicy: { ...policy, updatedAt: now(), updatedBy: currentUser(state).name } }, 'updated security policies', 'admin', undefined, '/admin?tab=security')
}

export function recordBackup(state: DemoState, sizeKb: number): DemoState {
  requireAdmin(state)
  const record = { id: uid('bkp'), at: now(), kind: 'Manual' as const, sizeKb, status: 'Completed' as const, by: currentUser(state).name }
  return withActivity({ ...state, backups: [record, ...state.backups].slice(0, 30) }, 'created a manual backup', 'admin', undefined, '/admin?tab=backups')
}
