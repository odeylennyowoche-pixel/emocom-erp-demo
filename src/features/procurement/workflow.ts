/**
 * Purchase request state machine. Only the transitions listed here are
 * possible; anything else is rejected, which prevents repeated or invalid
 * status changes (e.g. approving an already rejected request).
 */
import type { PurchaseRequest, PurchaseRequestStatus } from '../../types'
import type { Permissions } from '../auth/permissions'
import { prTotal } from '../../data/selectors'
import { canApprove, canReceive, type PolicyDecision } from './approvalPolicy'

export type PRAction = 'submit' | 'approve' | 'reject' | 'receive' | 'reopen'

interface TransitionDef {
  from: PurchaseRequestStatus
  to: PurchaseRequestStatus
  label: string
  verb: string
  requiresNote: boolean
  tone: 'primary' | 'success' | 'danger' | 'neutral'
}

export const TRANSITIONS: Record<PRAction, TransitionDef> = {
  submit: { from: 'Draft', to: 'Pending Approval', label: 'Submit for approval', verb: 'submitted', requiresNote: false, tone: 'primary' },
  approve: { from: 'Pending Approval', to: 'Approved', label: 'Approve', verb: 'approved', requiresNote: false, tone: 'success' },
  reject: { from: 'Pending Approval', to: 'Rejected', label: 'Reject', verb: 'rejected', requiresNote: true, tone: 'danger' },
  receive: { from: 'Approved', to: 'Received', label: 'Mark as received', verb: 'marked as received', requiresNote: false, tone: 'primary' },
  reopen: { from: 'Rejected', to: 'Draft', label: 'Revise as draft', verb: 'reopened as draft', requiresNote: false, tone: 'neutral' },
}

export function checkTransition(pr: PurchaseRequest, action: PRAction, p: Permissions): PolicyDecision {
  const def = TRANSITIONS[action]
  if (pr.status !== def.from) {
    return { allowed: false, reason: `Request is ${pr.status}; it can only be ${def.verb} from ${def.from}.` }
  }
  if (action === 'approve' || action === 'reject') return canApprove(p, pr, prTotal(pr))
  if (action === 'receive') return canReceive(p)
  // submit / reopen: the requester, their head of department, or an executive
  const own = p.user.employeeId === pr.requesterId
  const head = p.user.level === 'Head of Department' && p.user.departmentId === pr.departmentId
  if (own || head || p.isExecutive) return { allowed: true }
  return { allowed: false, reason: 'Only the requester or their head of department can do this.' }
}

/** Actions relevant to the request's current status, with policy decisions. */
export function actionsFor(pr: PurchaseRequest, p: Permissions): Array<{ action: PRAction; def: TransitionDef; decision: PolicyDecision }> {
  return (Object.keys(TRANSITIONS) as PRAction[])
    .filter((a) => TRANSITIONS[a].from === pr.status)
    .map((action) => ({ action, def: TRANSITIONS[action], decision: checkTransition(pr, action, p) }))
}
