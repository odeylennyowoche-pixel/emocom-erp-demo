import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Mail, MapPin, Pencil, Phone, Trash2, UserCheck, UserMinus, Plane } from 'lucide-react'
import { useData } from '../../data/store'
import { ACCESS_LEVEL_LABELS } from '../../types'
import { deleteEmployee, employeeReferences, updateEmployee, type EmployeeInput } from '../../data/actions'
import { departmentName, employeeById, fullName, prTotal } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { formatDate, timeAgo } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { initials } from '../../lib/utils'
import type { Employee, EmploymentStatus } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StatusBadge, Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'
import { canViewEmployee, visibleRequests } from '../auth/permissions'

function toInput(e: Employee): EmployeeInput {
  const { id: _id, employeeNo: _no, ...rest } = e
  void _id
  void _no
  return rest
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const { state, perms, commit } = useData()
  const navigate = useNavigate()
  const run = useAction()
  const [pendingStatus, setPendingStatus] = useState<EmploymentStatus | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const employee = employeeById(state, id)
  if (!employee) return <NotFoundPage title="Employee not found" message="This employee record does not exist or was deleted." />
  if (!canViewEmployee(perms, employee)) return <AccessDenied message="You can only view employee records you have access to." />
  const canManage = perms.canManageEmployees

  const manager = employeeById(state, employee.managerId)
  const reports = state.employees.filter((e) => e.managerId === employee.id)
  const assets = state.assets.filter((a) => a.assignedToId === employee.id)
  const requests = visibleRequests(perms, state.purchaseRequests).filter((p) => p.requesterId === employee.id)
  const activity = state.activity.filter((a) => a.entityType === 'employee' && a.entityId === employee.id)
  const refs = employeeReferences(state, employee.id)
  const linkedUser = state.users.find((u) => u.employeeId === employee.id)

  const statusActions: Array<{ status: EmploymentStatus; label: string; icon: ReactNode }> = [
    { status: 'Active' as const, label: 'Mark active', icon: <UserCheck className="size-4" /> },
    { status: 'On Leave' as const, label: 'Set on leave', icon: <Plane className="size-4" /> },
    { status: 'Inactive' as const, label: 'Deactivate', icon: <UserMinus className="size-4" /> },
  ].filter((a) => a.status !== employee.status)

  return (
    <>
      <PageHeader
        title={fullName(employee)}
        meta={<StatusBadge status={employee.status} />}
        description={`${employee.employeeNo} · ${employee.jobTitle} · ${departmentName(state, employee.departmentId)}`}
        actions={
          canManage && (
          <>
            {statusActions.map((a) => (
              <Button key={a.status} variant="secondary" icon={a.icon} onClick={() => setPendingStatus(a.status)}>
                {a.label}
              </Button>
            ))}
            <Button variant="secondary" icon={<Trash2 className="size-4 text-rose-600" />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <ButtonLink to={`/employees/${employee.id}/edit`} icon={<Pencil className="size-4" />}>
              Edit
            </ButtonLink>
          </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Employment details" />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: 'Employee ID', value: <span className="font-mono">{employee.employeeNo}</span> },
                  { label: 'Department', value: departmentName(state, employee.departmentId) },
                  { label: 'Job title', value: employee.jobTitle },
                  { label: 'Employment type', value: employee.employmentType },
                  { label: 'Joining date', value: formatDate(employee.joinDate) },
                  { label: 'Location', value: employee.location },
                  {
                    label: 'Reports to',
                    value: manager ? (
                      <Link to={`/employees/${manager.id}`} className="text-brand-700 hover:underline">
                        {fullName(manager)}
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Direct reports', value: reports.length },
                  { label: 'ERP account', value: linkedUser ? <Badge tone="brand">{ACCESS_LEVEL_LABELS[linkedUser.level]} · @{linkedUser.username}</Badge> : 'None' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Assigned assets" description={`${assets.length} item(s) issued to this employee`} />
            {assets.length === 0 ? (
              <EmptyState title="No assets assigned" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {a.tag} · S/N {a.serialNumber}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Purchase requests raised" />
            {requests.length === 0 ? (
              <EmptyState title="No purchase requests" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {requests.map((p) => (
                  <li key={p.id}>
                    <Link to={`/procurement/requests/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {p.code} — {p.title}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular hidden text-slate-700 sm:inline">{formatMoney(prTotal(p))}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center py-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xl font-semibold text-white">{initials(fullName(employee))}</span>
              <p className="mt-3 font-semibold text-slate-900">{fullName(employee)}</p>
              <p className="text-sm text-slate-500">{employee.jobTitle}</p>
              <div className="mt-4 w-full space-y-2 text-left text-sm">
                <a href={`mailto:${employee.email}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                  <Mail className="size-4 text-slate-400" /> <span className="truncate">{employee.email}</span>
                </a>
                <p className="flex items-center gap-2 text-slate-600">
                  <Phone className="size-4 text-slate-400" /> {employee.phone}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <MapPin className="size-4 text-slate-400" /> {employee.location}
                </p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Record history" />
            {activity.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No changes recorded in this demo session.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium">{a.actor}</span> {a.action}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        title={`Change status to ${pendingStatus ?? ''}?`}
        message={
          <>
            {fullName(employee)} will be shown as <strong>{pendingStatus}</strong> across the directory, dashboard and reports.
          </>
        }
        confirmLabel="Change status"
        tone={pendingStatus === 'Inactive' ? 'danger' : 'primary'}
        onConfirm={() => {
          const target = pendingStatus!
          const ok = run(() => commit((s) => updateEmployee(s, employee.id, { ...toInput(employee), status: target })), { title: 'Status updated', description: `${fullName(employee)} is now ${target}.` })
          if (ok) setPendingStatus(null)
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete employee record?"
        tone="danger"
        confirmLabel="Delete permanently"
        message={
          refs.length > 0 ? (
            <>
              This record is linked to {refs.join(', ')} and cannot be deleted. Use <strong>Deactivate</strong> instead to keep history intact.
            </>
          ) : (
            <>This permanently removes {fullName(employee)} from the demo directory. This cannot be undone (except by resetting demo data).</>
          )
        }
        onConfirm={() => {
          const ok = run(() => commit((s) => deleteEmployee(s, employee.id)), { title: 'Employee deleted' })
          setConfirmDelete(false)
          if (ok) navigate('/employees')
        }}
      />
    </>
  )
}
