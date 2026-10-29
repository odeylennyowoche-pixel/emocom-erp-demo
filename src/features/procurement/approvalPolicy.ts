/**
 * SIMPLIFIED DEMO APPROVAL RULES (delegation of authority).
 *
 *   Head of Department   own department's requests, up to ₦5m
 *   Head of Finance      any department, up to ₦20m
 *   CEO                  any request, no limit
 *   Administrator/Staff  cannot approve
 *   Nobody               approves a request they raised
 *
 * Limits live in permissions.ts. Replace them with EMOCOM's real approval
 * matrix; in production these checks must be enforced on the server.
 */
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
      reason: p.user.level === 'Administrator' ? 'Administrators manage the system; approvals are made by the CEO or department heads.' : 'Your account cannot approve purchase requests.',
    }
  }
  if (p.approvalScope === 'department' && pr.departmentId !== p.user.departmentId) {
    return { allowed: false, reason: 'You can only approve requests from your own department.' }
  }
  if (totalMinor > p.approvalLimitMinor) {
    return { allowed: false, reason: `Exceeds your approval limit of ${formatMoney(p.approvalLimitMinor)}. It needs ${totalMinor > 20_000_000_00 ? 'the CEO' : 'the Head of Finance or CEO'}.` }
  }
  return { allowed: true }
}

export function canReceive(p: Permissions): PolicyDecision {
  return p.canReceiveGoods ? { allowed: true } : { allowed: false, reason: 'Only Procurement & Logistics or executives confirm goods received.' }
}

/** Who can approve a request of this size, for display. */
export function approvalRoute(totalMinor: Minor): string {
  if (totalMinor > 20_000_000_00) return 'CEO'
  if (totalMinor > 5_000_000_00) return 'Head of Finance or CEO'
  return 'Head of the requesting department, Head of Finance or CEO'
}
