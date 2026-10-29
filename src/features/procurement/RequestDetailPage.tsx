import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CheckCircle2, Circle, Info, PackageCheck, Pencil, Printer, RotateCcw, Send, X } from 'lucide-react'
import { useData } from '../../data/store'
import { transitionPurchaseRequest } from '../../data/actions'
import { departmentName, employeeById, fullName, prTotal } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatMoney, lineTotal } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { PurchaseRequestStatus } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { NotFoundPage } from '../../app/RouteError'
import { actionsFor, TRANSITIONS, type PRAction } from './workflow'
import { approvalRoute } from './approvalPolicy'
import { AccessDenied } from '../auth/Guards'
import { visibleRequests } from '../auth/permissions'

const ACTION_ICONS: Record<PRAction, ReactNode> = {
  submit: <Send className="size-4" />,
  approve: <Check className="size-4" />,
  reject: <X className="size-4" />,
  receive: <PackageCheck className="size-4" />,
  reopen: <RotateCcw className="size-4" />,
}

const FLOW: PurchaseRequestStatus[] = ['Draft', 'Pending Approval', 'Approved', 'Received']

export default function RequestDetailPage() {
  const { id } = useParams()
  const { state, user, perms, commit } = useData()
  const run = useAction()
  const [pending, setPending] = useState<PRAction | null>(null)

  const pr = state.purchaseRequests.find((p) => p.id === id)
  if (!pr) return <NotFoundPage title="Purchase request not found" />
  if (!visibleRequests(perms, [pr]).length) return <AccessDenied message="This purchase request belongs to another department." />

  const total = prTotal(pr)
  const requester = employeeById(state, pr.requesterId)
  const supplier = state.suppliers.find((s) => s.id === pr.supplierId)
  const actions = actionsFor(pr, perms)
  const linkedExpense = state.expenses.find((e) => e.purchaseRequestId === pr.id)
  const currentStep = pr.status === 'Rejected' ? 1 : FLOW.indexOf(pr.status)

  const confirmCopy: Record<PRAction, { title: string; message: string; tone: 'primary' | 'success' | 'danger' }> = {
    submit: { title: `Submit ${pr.code} for approval?`, message: 'The request will be locked for editing and sent to approvers.', tone: 'primary' },
    approve: { title: `Approve ${pr.code}?`, message: `You are approving ${formatMoney(total)} with ${supplier?.name ?? 'the supplier'}. This decision is recorded in the request history.`, tone: 'success' },
    reject: { title: `Reject ${pr.code}?`, message: 'The requester will see your reason and can revise the request as a new draft.', tone: 'danger' },
    receive: {
      title: `Confirm goods received for ${pr.code}?`,
      message: 'Stock levels for linked inventory items will increase, and a pending procurement expense will be recorded in Finance.',
      tone: 'primary',
    },
    reopen: { title: `Revise ${pr.code}?`, message: 'The request returns to Draft so it can be edited and resubmitted.', tone: 'primary' },
  }

  return (
    <>
      <PageHeader
        title={pr.code}
        meta={<StatusBadge status={pr.status} />}
        description={pr.title}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
            {pr.status === 'Draft' && (
              <ButtonLink variant="secondary" to={`/procurement/requests/${pr.id}/edit`} icon={<Pencil className="size-4" />}>
                Edit draft
              </ButtonLink>
            )}
            {actions.map(({ action, def, decision }) => (
              <Button
                key={action}
                variant={def.tone === 'neutral' ? 'secondary' : def.tone}
                icon={ACTION_ICONS[action]}
                disabled={!decision.allowed}
                title={decision.allowed ? undefined : decision.reason}
                onClick={() => setPending(action)}
              >
                {def.label}
              </Button>
            ))}
          </>
        }
      />

      {actions.some((a) => !a.decision.allowed) && (
        <div className="no-print mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Signed in as {user.name} ({user.level}, {perms.department?.name}).</p>
            <ul className="mt-0.5 list-disc pl-4 text-sky-800">
              {actions
                .filter((a) => !a.decision.allowed)
                .map((a) => (
                  <li key={a.action}>
                    {a.def.label}: {a.decision.reason}
                  </li>
                ))}
            </ul>
            <p className="mt-1 text-xs text-sky-700">Sign out and sign in as the right approver to continue (see the approval route in the summary).</p>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardBody>
          <ol className="grid gap-4 sm:grid-cols-4" aria-label="Approval progress">
            {FLOW.map((step, i) => {
              const rejectedHere = pr.status === 'Rejected' && i === 2
              const done = pr.status !== 'Rejected' ? i <= currentStep : i <= 1
              const label = rejectedHere ? 'Rejected' : step
              const entry = [...pr.history].reverse().find((h) => h.status === label)
              return (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      rejectedHere ? 'bg-rose-100 text-rose-600' : done ? 'bg-brand-500 text-ink-950' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {rejectedHere ? <X className="size-4" /> : done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-medium', rejectedHere ? 'text-rose-700' : done ? 'text-slate-900' : 'text-slate-400')}>{label}</span>
                    <span className="block truncate text-xs text-slate-500">{entry ? `${entry.by} · ${formatDate(entry.at)}` : 'Not yet'}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </CardBody>
      </Card>

      {pr.status === 'Rejected' && pr.rejectionReason && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-medium">Rejection reason</p>
          <p className="mt-0.5">{pr.rejectionReason}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="print-area">
            <CardHeader title="Line items" description={`${pr.lines.length} line(s)`} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th scope="col" className="px-5 py-2.5 text-left">Description</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Qty</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Unit price</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pr.lines.map((l) => {
                    const item = state.inventory.find((i) => i.id === l.inventoryItemId)
                    return (
                      <tr key={l.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{l.description}</p>
                          {item && (
                            <Link to={`/inventory/items/${item.id}`} className="text-xs text-brand-700 hover:underline">
                              {item.code} · in stock: {item.quantity}
                            </Link>
                          )}
                        </td>
                        <td className="tabular px-4 py-3 text-right">{l.quantity.toLocaleString()}</td>
                        <td className="tabular px-4 py-3 text-right">{formatMoney(l.unitPriceMinor)}</td>
                        <td className="tabular px-5 py-3 text-right font-medium text-slate-900">{formatMoney(lineTotal(l.quantity, l.unitPriceMinor))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/60">
                    <td colSpan={3} className="px-5 py-3 text-right text-sm font-medium text-slate-600">
                      Total
                    </td>
                    <td className="tabular px-5 py-3 text-right text-base font-semibold text-slate-900">{formatMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="History" description="Every status change is recorded" />
            <ol className="px-5 py-4">
              {[...pr.history].reverse().map((h, i, arr) => (
                <li key={`${h.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute top-6 bottom-0 left-[7px] w-px bg-slate-200" aria-hidden />}
                  <span className="relative mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" aria-hidden />
                  <div className="min-w-0 text-sm">
                    <p className="text-slate-800">
                      <StatusBadge status={h.status} /> <span className="ml-1 font-medium">{h.by}</span>
                    </p>
                    {h.note && <p className="mt-1 text-slate-600">“{h.note}”</p>}
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  {
                    label: 'Requester',
                    value: requester ? (
                      <Link to={`/employees/${requester.id}`} className="text-brand-700 hover:underline">
                        {fullName(requester)}
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Department', value: departmentName(state, pr.departmentId) },
                  { label: 'Supplier', value: supplier ? `${supplier.name} · ${supplier.city}` : '—' },
                  { label: 'Created', value: formatDate(pr.createdAt) },
                  { label: 'Needed by', value: formatDate(pr.neededBy) },
                  { label: 'Justification', value: pr.justification },
                  {
                    label: 'Approval route',
                    value: approvalRoute(total),
                  },
                  ...(linkedExpense
                    ? [
                        {
                          label: 'Finance',
                          value: (
                            <Link to={`/finance?tab=expenses&q=${linkedExpense.code}`} className="text-brand-700 hover:underline">
                              {linkedExpense.code} · {linkedExpense.status}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          title={confirmCopy[pending].title}
          message={confirmCopy[pending].message}
          tone={confirmCopy[pending].tone}
          confirmLabel={TRANSITIONS[pending].label}
          noteLabel={pending === 'reject' ? 'Reason for rejection' : undefined}
          notePlaceholder="e.g. Please obtain two more quotations"
          onConfirm={(note) => {
            const action = pending
            const ok = run(() => commit((s) => transitionPurchaseRequest(s, pr.id, action, note)), {
              title: `${pr.code} ${TRANSITIONS[action].verb}`,
              description: action === 'receive' ? 'Inventory and finance were updated.' : undefined,
            })
            if (ok) setPending(null)
          }}
        />
      )}
    </>
  )
}
