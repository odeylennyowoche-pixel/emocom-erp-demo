import { formatMoney } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { departmentName, fullName, invoiceTotal, prTotal } from '../../data/selectors'
import type { DemoState } from '../../types'
import { canOpen, visibleEmployees, visibleRequests, type Permissions } from '../auth/permissions'
import { visibleProjects, visibleProposals } from '../auth/scopes'

export type SearchGroup = 'Employees' | 'Inventory' | 'Assets' | 'Purchase requests' | 'Suppliers' | 'Invoices' | 'Projects' | 'Opportunities' | 'Proposals'

export interface SearchResult {
  id: string
  group: SearchGroup
  title: string
  subtitle: string
  to: string
}

/** Client-side search across the main entities. A backend would replace this with a search API. */
/** Results are limited to what the signed-in person may see. */
export function searchAll(state: DemoState, perms: Permissions, query: string, limitPerGroup = Infinity): SearchResult[] {
  const q = query.trim()
  if (q.length < 2) return []
  const take = <T,>(arr: T[]) => arr.slice(0, limitPerGroup)
  const results: SearchResult[] = []

  results.push(
    ...take(visibleEmployees(perms, state.employees).filter((e) => includesText([fullName(e), e.email, e.employeeNo, e.jobTitle], q))).map((e) => ({
      id: e.id,
      group: 'Employees' as const,
      title: fullName(e),
      subtitle: `${e.employeeNo} · ${e.jobTitle} · ${departmentName(state, e.departmentId)}`,
      to: `/employees/${e.id}`,
    })),
  )
  results.push(
    ...take((perms.inventory === 'none' ? [] : state.inventory).filter((i) => includesText([i.name, i.code, i.category], q))).map((i) => ({
      id: i.id,
      group: 'Inventory' as const,
      title: i.name,
      subtitle: `${i.code} · ${i.quantity.toLocaleString()} ${i.unit}(s) · ${i.location}`,
      to: `/inventory/items/${i.id}`,
    })),
  )
  results.push(
    ...take((perms.inventory === 'none' ? [] : state.assets).filter((a) => includesText([a.name, a.tag, a.serialNumber], q))).map((a) => ({
      id: a.id,
      group: 'Assets' as const,
      title: `${a.tag} — ${a.name}`,
      subtitle: `${a.category} · ${a.status} · S/N ${a.serialNumber}`,
      to: `/inventory?tab=assets&q=${encodeURIComponent(a.tag)}`,
    })),
  )
  results.push(
    ...take(visibleRequests(perms, state.purchaseRequests).filter((p) => includesText([p.code, p.title], q))).map((p) => ({
      id: p.id,
      group: 'Purchase requests' as const,
      title: `${p.code} — ${p.title}`,
      subtitle: `${p.status} · ${formatMoney(prTotal(p))}`,
      to: `/procurement/requests/${p.id}`,
    })),
  )
  results.push(
    ...take((perms.procurement === 'all' ? state.suppliers : []).filter((s) => includesText([s.name, s.code, s.category, s.contactName], q))).map((s) => ({
      id: s.id,
      group: 'Suppliers' as const,
      title: s.name,
      subtitle: `${s.code} · ${s.category} · ${s.city}`,
      to: `/procurement?tab=suppliers&q=${encodeURIComponent(s.name)}`,
    })),
  )
  results.push(
    ...take((perms.financeTabs.includes('receivables') ? state.invoices : []).filter((i) => includesText([i.number, i.customer.name], q))).map((i) => ({
      id: i.id,
      group: 'Invoices' as const,
      title: `${i.number} — ${i.customer.name}`,
      subtitle: `${i.status} · ${formatMoney(invoiceTotal(i))}`,
      to: `/finance/invoices/${i.id}`,
    })),
  )
  results.push(
    ...take((canOpen(perms, 'projects') ? visibleProjects(perms, state.projects) : []).filter((p) => includesText([p.name, p.code, p.clientName], q))).map((p) => ({
      id: p.id,
      group: 'Projects' as const,
      title: p.name,
      subtitle: `${p.code} · ${p.clientName} · ${p.status}`,
      to: `/projects/${p.id}`,
    })),
  )
  results.push(
    ...take((perms.salesTabs.includes('pipeline') ? state.opportunities : []).filter((o) => includesText([o.name, o.code, o.clientName], q))).map((o) => ({
      id: o.id,
      group: 'Opportunities' as const,
      title: o.name,
      subtitle: `${o.code} · ${o.clientName} · ${o.stage}`,
      to: '/sales',
    })),
  )
  results.push(
    ...take(visibleProposals(perms, state.proposals).filter((p) => includesText([p.title, p.code, p.clientName], q))).map((p) => ({
      id: p.id,
      group: 'Proposals' as const,
      title: p.title,
      subtitle: `${p.code} · ${p.clientName} · ${p.status}`,
      to: `/proposals/${p.id}`,
    })),
  )
  return results
}
