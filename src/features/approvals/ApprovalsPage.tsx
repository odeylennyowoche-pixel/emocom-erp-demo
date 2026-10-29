import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck, X } from 'lucide-react'
import { useData } from '../../data/store'
import { transitionPurchaseRequest } from '../../data/actions'
import { decideChangeRequest, decideClaim, decideLeave, decideProject } from '../../data/workActions'
import { departmentName, fullName, prTotal } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { useTabParam } from '../../hooks/useQueryState'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { LIMITS } from '../../config/approvals'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice } from '../../components/ui/Progress'
import { checkTransition } from '../procurement/workflow'
import { canDecideChangeRequest, canDecideClaim, canDecideLeave, canDecideProject, type Decision } from './rules'
import { useApprovalQueues } from './useApprovalQueues'

type TabKey = 'purchases' | 'projects' | 'changes' | 'leave' | 'claims'

interface Row {
  id: string
  title: ReactNode
  subtitle: ReactNode
  amount?: string
  status: string
  decision: Decision
  link?: string
  onApprove: () => void
  onReject: (note: string) => void
}

export default function ApprovalsPage() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const q = useApprovalQueues()
  const tabs: Array<{ key: TabKey; label: string; count: number; show: boolean }> = [
    { key: 'purchases', label: 'Purchases & capital', count: q.mine.purchases, show: perms.approvalScope !== 'none' },
    { key: 'projects', label: 'Projects & contracts', count: q.mine.projects, show: perms.canApproveProjects || perms.canManageProjects },
    { key: 'changes', label: 'Change requests', count: q.mine.changes, show: perms.changeRequestScope !== 'none' },
    { key: 'leave', label: 'Leave', count: q.mine.leave, show: perms.leaveApproval !== 'none' },
    { key: 'claims', label: 'Expense claims', count: q.mine.claims, show: perms.claimApproval !== 'none' },
  ]
  const visible = tabs.filter((t) => t.show)
  const [tabParam, setTab] = useTabParam<TabKey>(visible[0]?.key ?? 'purchases')
  const tab = visible.some((t) => t.key === tabParam) ? tabParam : visible[0]?.key
  const empName = (id: string) => fullName(state.employees.find((e) => e.id === id))
  const deptOfEmp = (id: string) => departmentName(state, state.employees.find((e) => e.id === id)?.departmentId)

  const rows: Row[] =
    tab === 'purchases'
      ? q.purchases.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: `${p.code} · ${departmentName(state, p.departmentId)} · raised by ${empName(p.requesterId)}`,
          amount: formatMoney(prTotal(p)),
          status: prTotal(p) > LIMITS.financePurchaseMinor ? 'Capital — CEO' : 'Pending',
          decision: checkTransition(p, 'approve', perms),
          link: `/procurement/requests/${p.id}`,
          onApprove: () => run(() => commit((s) => transitionPurchaseRequest(s, p.id, 'approve')), { title: 'Purchase approved', description: p.code }),
          onReject: (note) => run(() => commit((s) => transitionPurchaseRequest(s, p.id, 'reject', note)), { title: 'Purchase rejected', description: p.code }),
        }))
      : tab === 'projects'
        ? q.projects.map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: `${p.code} · ${p.clientName} · ${departmentName(state, p.departmentId)} · ${formatDate(p.startDate)} → ${formatDate(p.endDate)}`,
            amount: formatMoney(p.contractValueMinor),
            status: 'Pending approval',
            decision: canDecideProject(perms, p),
            link: `/projects/${p.id}`,
            onApprove: () => run(() => commit((s) => decideProject(s, p.id, true)), { title: 'Project approved', description: p.name }),
            onReject: (note) => run(() => commit((s) => decideProject(s, p.id, false, note)), { title: 'Project rejected', description: p.name }),
          }))
        : tab === 'changes'
          ? q.changes.map((c) => {
              const proj = state.projects.find((p) => p.id === c.projectId)
              return {
                id: c.id,
                title: c.title,
                subtitle: `${c.code} · ${proj?.name ?? ''} · +${c.daysImpact} days · raised by ${c.raisedBy}`,
                amount: formatMoney(c.costImpactMinor),
                status: c.costImpactMinor > LIMITS.managerChangeRequestMinor ? 'Above ₦10m — CEO' : 'Pending',
                decision: canDecideChangeRequest(perms, c, proj),
                link: proj && perms.projects !== 'self' ? `/projects/${proj.id}` : undefined,
                onApprove: () => run(() => commit((s) => decideChangeRequest(s, c.id, true)), { title: 'Change request approved', description: c.code }),
                onReject: (note) => run(() => commit((s) => decideChangeRequest(s, c.id, false, note)), { title: 'Change request rejected', description: c.code }),
              }
            })
          : tab === 'leave'
            ? q.leave.map((l) => ({
                id: l.id,
                title: `${empName(l.employeeId)} — ${l.type} leave`,
                subtitle: `${deptOfEmp(l.employeeId)} · ${formatDate(l.startDate)} → ${formatDate(l.endDate)} · ${l.days} working day(s) · “${l.reason}”`,
                status: 'Pending',
                decision: canDecideLeave(perms, l, state),
                onApprove: () => run(() => commit((s) => decideLeave(s, l.id, true)), { title: 'Leave approved' }),
                onReject: (note) => run(() => commit((s) => decideLeave(s, l.id, false, note)), { title: 'Leave declined' }),
              }))
            : q.claims.map((c) => ({
                id: c.id,
                title: `${empName(c.employeeId)} — ${c.description}`,
                subtitle: `${c.code} · ${c.category} · ${formatDate(c.date)} · ${deptOfEmp(c.employeeId)}`,
                amount: formatMoney(c.amountMinor),
                status: 'Pending',
                decision: canDecideClaim(perms, c, state),
                onApprove: () => run(() => commit((s) => decideClaim(s, c.id, true)), { title: 'Claim approved', description: c.code }),
                onReject: (note) => run(() => commit((s) => decideClaim(s, c.id, false, note)), { title: 'Claim rejected', description: c.code }),
              }))

  const [rejecting, setRejecting] = useState<Row | null>(null)

  const recent = useMemo(() => {
    const items: Array<{ at: string; text: string; status: string }> = []
    state.projects.filter((p) => p.approval).forEach((p) => items.push({ at: p.approval!.at, text: `${p.code} ${p.name} approved by ${p.approval!.by}`, status: 'Approved' }))
    state.changeRequests.filter((c) => c.decidedAt).forEach((c) => items.push({ at: c.decidedAt!, text: `${c.code} ${c.title} — ${c.decidedBy}`, status: c.status }))
    state.leaveRequests.filter((l) => l.decidedAt).forEach((l) => items.push({ at: l.decidedAt!, text: `${empName(l.employeeId)} ${l.type.toLowerCase()} leave — ${l.decidedBy}`, status: l.status }))
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projects, state.changeRequests, state.leaveRequests])

  return (
    <>
      <PageHeader
        title="Approvals"
        description={perms.isMainAdmin ? 'Final approvals: large contracts and projects, capital purchases and major change requests.' : 'Everything waiting for a decision in your area.'}
        meta={q.total > 0 ? <Badge tone="warning">{q.total} awaiting you</Badge> : <Badge tone="success">All clear</Badge>}
      />
      <div className="mb-4">
        <Notice>
          Demo approval limits: managers approve their team’s purchases up to ₦5m and change requests up to ₦10m; the finance manager approves purchases up to ₦20m; the CEO gives final approval above
          that and for projects or contracts over ₦50m. Leave and claims go to the employee’s manager (leave can also be approved by HR). Nobody approves their own request.
        </Notice>
      </div>
      <Card>
        <div className="px-4 pt-1">
          <Tabs label="Approval types" active={tab ?? 'purchases'} onChange={setTab} tabs={visible.map((t) => ({ key: t.key, label: t.label, count: t.count }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="Nothing waiting here" description="New requests in your area will appear in this list." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.link ? (
                      <Link to={r.link} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{r.title}</p>
                    )}
                    <StatusBadge status={r.status.includes('CEO') ? 'Pending approval' : r.status} />
                    {r.status.includes('CEO') && <Badge tone="brand">{r.status}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{r.subtitle}</p>
                  {!r.decision.allowed && <p className="mt-1 text-xs text-slate-500 italic">{r.decision.reason}</p>}
                </div>
                {r.amount && <p className="tabular text-sm font-semibold whitespace-nowrap text-slate-900">{r.amount}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={<X className="size-4 text-rose-600" />} disabled={!r.decision.allowed} onClick={() => setRejecting(r)}>
                    Reject
                  </Button>
                  <Button size="sm" variant="success" icon={<Check className="size-4" />} disabled={!r.decision.allowed} onClick={r.onApprove}>
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {recent.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Recent decisions" />
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate text-slate-700">{r.text}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={r.status} />
                  <span className="hidden text-xs text-slate-400 sm:inline">{formatDateTime(r.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this request?"
        tone="danger"
        confirmLabel="Reject"
        message={<>The requester will be notified with your reason.</>}
        noteLabel="Reason"
        onConfirm={(note) => {
          rejecting?.onReject(note)
          setRejecting(null)
        }}
      />
    </>
  )
}
