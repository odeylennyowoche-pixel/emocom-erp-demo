import { Link } from 'react-router-dom'
import { Bell, Boxes, CheckCircle2, ClipboardList, FileText, Laptop, PackageCheck, Plus, Receipt, ShoppingCart, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useData } from '../../data/store'
import { employeeById, prTotal, stockStatus } from '../../data/selectors'
import { formatDate, timeAgo } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { canSeeNotification } from '../auth/permissions'
import { greeting } from './greeting'

interface QuickLink {
  to: string
  label: string
  hint: string
  icon: ReactNode
}

/** Dashboard for staff: their own requests, assets, tasks for their role and announcements. */
export function PersonalDashboard() {
  const { state, user, perms } = useData()
  const me = employeeById(state, user.employeeId)
  const myRequests = state.purchaseRequests.filter((p) => p.requesterId === user.employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const myAssets = state.assets.filter((a) => a.assignedToId === user.employeeId)
  const notes = state.notifications.filter((n) => canSeeNotification(perms, n))
  const unread = notes.filter((n) => !n.readBy.includes(user.id)).length
  const open = myRequests.filter((p) => p.status === 'Draft' || p.status === 'Pending Approval' || p.status === 'Approved')
  const done = myRequests.filter((p) => p.status === 'Received').length

  // Work that belongs to this person's role
  const code = perms.department?.code
  const tasks: QuickLink[] = []
  if (perms.canReceiveGoods) {
    const toReceive = state.purchaseRequests.filter((p) => p.status === 'Approved').length
    const alerts = state.inventory.filter((i) => stockStatus(i) !== 'In Stock').length
    tasks.push({ to: '/procurement?status=Approved', label: `${toReceive} approved request${toReceive === 1 ? '' : 's'} to receive`, hint: 'Confirm goods received to update stock', icon: <PackageCheck className="size-4" /> })
    tasks.push({ to: '/inventory?stock=alerts', label: `${alerts} stock item${alerts === 1 ? '' : 's'} on alert`, hint: 'Low or out of stock', icon: <Boxes className="size-4" /> })
  }
  if (perms.canRecordExpenses) {
    const unpaid = state.expenses.filter((e) => e.status !== 'Paid').length
    tasks.push({ to: '/finance?tab=expenses&status=Pending', label: `${unpaid} unpaid expense${unpaid === 1 ? '' : 's'}`, hint: 'Pending or overdue payments', icon: <Receipt className="size-4" /> })
  }
  if (perms.financeTabs.includes('invoices')) {
    const overdue = state.invoices.filter((i) => i.status === 'Overdue').length
    tasks.push({ to: '/finance?tab=invoices&status=Overdue', label: `${overdue} overdue client invoice${overdue === 1 ? '' : 's'}`, hint: code === 'SBD' ? 'Follow up with your clients' : 'Record payments as they arrive', icon: <FileText className="size-4" /> })
  }
  if (perms.canManageEmployees) {
    const onLeave = state.employees.filter((e) => e.status === 'On Leave').length
    tasks.push({ to: '/employees?status=On%20Leave', label: `${onLeave} employee${onLeave === 1 ? '' : 's'} on leave`, hint: 'Staff records you maintain', icon: <Users className="size-4" /> })
  }
  tasks.push({ to: '/inventory', label: 'Check stock availability', hint: 'See what is in the stores', icon: <Boxes className="size-4" /> })

  return (
    <>
      <PageHeader
        title="My workspace"
        description={`${greeting()}, ${user.name.split(' ')[0]}. ${me?.jobTitle ?? user.title} · ${perms.department?.name ?? ''}`}
        actions={
          <ButtonLink to="/procurement/requests/new" icon={<Plus className="size-4" />}>
            New purchase request
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My open requests" value={open.length} icon={<ShoppingCart className="size-5" />} hint="draft, pending or approved" to="/procurement" />
        <StatCard label="Received this period" value={done} icon={<CheckCircle2 className="size-5" />} hint="goods delivered" tone="emerald" to="/procurement?status=Received" />
        <StatCard label="Assets issued to me" value={myAssets.length} icon={<Laptop className="size-5" />} hint="laptops, phones, equipment" tone="purple" to={`/employees/${user.employeeId}`} />
        <StatCard label="Unread notifications" value={unread} icon={<Bell className="size-5" />} hint="for you and your department" tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="My purchase requests" description="Track approval progress" actions={<Link to="/procurement" className="text-sm font-medium text-brand-700 hover:text-brand-800">View all</Link>} />
          {myRequests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="You haven’t raised any requests"
              description="Need equipment or materials for a project? Raise a purchase request and your head of department will review it."
              action={<ButtonLink to="/procurement/requests/new">New purchase request</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {myRequests.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/procurement/requests/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {p.code} — {p.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {formatDate(p.createdAt)} · {formatMoney(prTotal(p))}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="My tasks" description="Shortcuts for your role" />
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.to + t.label}>
                <Link to={t.to} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">{t.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Assets issued to me" />
          {myAssets.length === 0 ? (
            <EmptyState title="No assets assigned" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {myAssets.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{a.name}</span>
                    <span className="block text-xs text-slate-500">
                      {a.tag} · S/N {a.serialNumber}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Announcements & notifications" />
          {notes.length === 0 ? (
            <EmptyState title="You’re all caught up" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {notes.slice(0, 6).map((n) => (
                <li key={n.id} className="px-5 py-3">
                  {n.link ? (
                    <Link to={n.link} className="block text-sm font-medium text-slate-800 hover:text-brand-700">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  )}
                  <p className="text-xs text-slate-500">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
