/**
 * Who may decide leave, expense claims, change requests and projects.
 * (Purchase requests use src/features/procurement/approvalPolicy.ts.)
 * Demo rules only — the server must enforce the real ones in production.
 */
import { LIMITS } from '../../config/approvals'
import { formatMoney } from '../../lib/money'
import type { ChangeRequest, DemoState, Employee, ExpenseClaim, LeaveRequest, Project } from '../../types'
import type { Permissions } from '../auth/permissions'

export interface Decision {
  allowed: boolean
  reason?: string
}

const no = (reason: string): Decision => ({ allowed: false, reason })
const yes: Decision = { allowed: true }

function employeeOf(state: Pick<DemoState, 'employees'>, id: string): Employee | undefined {
  return state.employees.find((e) => e.id === id)
}

export function canDecideLeave(p: Permissions, leave: LeaveRequest, state: Pick<DemoState, 'employees'>): Decision {
  if (leave.status !== 'Pending') return no(`This request is already ${leave.status.toLowerCase()}.`)
  if (leave.employeeId === p.user.employeeId) return no('You cannot approve your own leave.')
  if (p.leaveApproval === 'all') return yes
  if (p.leaveApproval === 'department' && employeeOf(state, leave.employeeId)?.departmentId === p.user.departmentId) return yes
  return no('Leave is approved by the employee’s manager or HR.')
}

export function canDecideClaim(p: Permissions, claim: ExpenseClaim, state: Pick<DemoState, 'employees'>): Decision {
  if (claim.status !== 'Pending') return no(`This claim is already ${claim.status.toLowerCase()}.`)
  if (claim.employeeId === p.user.employeeId) return no('You cannot approve your own claim.')
  if (p.claimApproval === 'all') return yes
  if (p.claimApproval === 'department' && employeeOf(state, claim.employeeId)?.departmentId === p.user.departmentId) return yes
  return no('Expense claims are approved by the employee’s manager.')
}

export function canDecideChangeRequest(p: Permissions, cr: ChangeRequest, project: Project | undefined): Decision {
  if (cr.status !== 'Pending') return no(`This change request is already ${cr.status.toLowerCase()}.`)
  if (cr.raisedByUserId === p.user.id) return no('You cannot approve a change request you raised.')
  if (p.changeRequestScope === 'none') return no('Your account cannot approve change requests.')
  if (p.changeRequestScope === 'department' && project?.departmentId !== p.user.departmentId) return no('You can only approve change requests on your team’s projects.')
  if (cr.costImpactMinor > p.changeRequestLimitMinor) return no(`Cost impact is above ${formatMoney(p.changeRequestLimitMinor)}; it needs the CEO.`)
  return yes
}

export function canDecideProject(p: Permissions, project: Project): Decision {
  if (project.status !== 'Pending approval') return no(`This project is already ${project.status.toLowerCase()}.`)
  if (!p.canApproveProjects) return no(`Projects and contracts above ${formatMoney(LIMITS.ceoProjectThresholdMinor)} need the CEO’s final approval.`)
  return yes
}

/** A new project above the threshold waits for the CEO; smaller ones start in planning. */
export function projectNeedsCeo(contractValueMinor: number): boolean {
  return contractValueMinor > LIMITS.ceoProjectThresholdMinor
}
