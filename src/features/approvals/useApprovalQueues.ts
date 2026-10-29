import { useMemo } from 'react'
import { useData } from '../../data/store'
import { prTotal } from '../../data/selectors'
import { LIMITS } from '../../config/approvals'
import { visibleRequests } from '../auth/permissions'
import { checkTransition } from '../procurement/workflow'
import { canDecideChangeRequest, canDecideClaim, canDecideLeave, canDecideProject } from './rules'

/** Every approval this person can see, in one inbox. */
export function useApprovalQueues() {
  const { state, perms } = useData()
  return useMemo(() => {
    const deptOf = (empId: string) => state.employees.find((e) => e.id === empId)?.departmentId
    // the CEO's inbox shows only what needs the CEO (capital purchases, large change requests, managers' claims)
    const purchases = visibleRequests(perms, state.purchaseRequests).filter((p) => p.status === 'Pending Approval' && (!perms.isMainAdmin || prTotal(p) > LIMITS.financePurchaseMinor))
    const projects = state.projects.filter((p) => p.status === 'Pending approval' && (perms.canApproveProjects || p.departmentId === perms.user.departmentId))
    const changes = state.changeRequests.filter((c) => {
      if (c.status !== 'Pending') return false
      if (perms.changeRequestScope === 'all') return !perms.isMainAdmin || c.costImpactMinor > LIMITS.managerChangeRequestMinor
      const proj = state.projects.find((p) => p.id === c.projectId)
      return perms.changeRequestScope === 'department' && proj?.departmentId === perms.user.departmentId
    })
    const leave = state.leaveRequests.filter((l) => l.status === 'Pending' && (perms.leaveApproval === 'all' || (perms.leaveApproval === 'department' && deptOf(l.employeeId) === perms.user.departmentId)))
    const isHead = (empId: string) => state.departments.some((d) => d.headEmployeeId === empId)
    const claims = state.expenseClaims.filter((c) => c.status === 'Pending' && ((perms.claimApproval === 'all' && (!perms.isMainAdmin || isHead(c.employeeId))) || (perms.claimApproval === 'department' && deptOf(c.employeeId) === perms.user.departmentId)))
    const mine = {
      purchases: purchases.filter((p) => checkTransition(p, 'approve', perms).allowed).length,
      projects: projects.filter((p) => canDecideProject(perms, p).allowed).length,
      changes: changes.filter((c) => canDecideChangeRequest(perms, c, state.projects.find((p) => p.id === c.projectId)).allowed).length,
      leave: leave.filter((l) => canDecideLeave(perms, l, state).allowed).length,
      claims: claims.filter((c) => canDecideClaim(perms, c, state).allowed).length,
    }
    return { purchases, projects, changes, leave, claims, mine, total: Object.values(mine).reduce((a, b) => a + b, 0) }
  }, [state, perms])
}

