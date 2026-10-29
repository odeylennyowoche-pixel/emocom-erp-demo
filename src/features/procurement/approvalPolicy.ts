/**
 * SIMPLIFIED DEMO APPROVAL RULES (delegation of authority).
 *
 *   Manager (HOD)        own team's requests, up to ₦5m
 *   Finance manager      any department, up to ₦20m
 *   CEO / MD             any request (final approval of capital spend)
 *   Others               cannot approve
 *   Nobody               approves a request they raised
 *
 * Limits live in permissions.ts. Replace them with EMOCOM's real approval
 * matrix; in production these checks must be enforced on the server.
 */
import { LIMITS } from '../../config/approvals'
import { formatMoney } from '../../lib/money'
import type { Minor, PurchaseRequest } from '../../types'
import type { Permissions } from '../auth/permissions'

export interface PolicyDecision {
  allowed: boolean
  reason?: string
}

export function canApprove(p: Permissions, pr: PurchaseRequest, totalMinor: Minor): PolicyDecision {
  if (p.user.employeeId && p.user.employeeId === pr.requesterId) {
    return { allowed: false, reason: 'You cannot approve a request you raised.' }
  }
  if (p.approvalScope === 'none' || p.approvalLimitMinor <= 0) {
    return {
      allowed: false,
      reason: p.isSecondaryAdmin ? 'The secondary admin runs the system; approvals are made by managers, the finance manager or the CEO.' : 'Your account cannot approve purchase requests.',
    }
  }
  if (p.approvalScope === 'department' && pr.departmentId !== p.user.departmentId) {
    return { allowed: false, reason: 'You can only approve requests from your own department.' }
  }
  if (totalMinor > p.approvalLimitMinor) {
    return { allowed: false, reason: `Exceeds your approval limit of ${formatMoney(p.approvalLimitMinor)}. It needs ${totalMinor > LIMITS.financePurchaseMinor ? 'the CEO' : 'the finance manager or CEO'}.` }
  }
  return { allowed: true }
}

export function canReceive(p: Permissions): PolicyDecision {
  return p.canReceiveGoods ? { allowed: true } : { allowed: false, reason: 'Goods received notes (GRN) are recorded by Finance.' }
}

/** Who can approve a request of this size, for display. */
export function approvalRoute(totalMinor: Minor): string {
  if (totalMinor > LIMITS.financePurchaseMinor) return 'CEO (capital approval)'
  if (totalMinor > LIMITS.managerPurchaseMinor) return 'Finance manager or CEO'
  return 'Team manager, finance manager or CEO'
}
