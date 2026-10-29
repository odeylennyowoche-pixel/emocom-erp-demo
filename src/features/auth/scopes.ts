/** Record-level scoping for projects and proposals (see permissions.ts). */
import type { Project, Proposal } from '../../types'
import type { Permissions } from './permissions'

export function visibleProjects(p: Permissions, list: Project[]): Project[] {
  if (p.projects === 'all') return list
  if (p.projects === 'department') return list.filter((x) => x.departmentId === p.user.departmentId)
  if (p.projects === 'self') return list.filter((x) => x.memberIds.includes(p.user.employeeId ?? ''))
  return []
}

export function visibleProposals(p: Permissions, list: Proposal[]): Proposal[] {
  if (p.proposals === 'all') return list
  if (p.proposals === 'department') return list.filter((x) => x.departmentId === p.user.departmentId)
  if (p.proposals === 'self') return list.filter((x) => x.ownerUserId === p.user.id)
  return []
}
