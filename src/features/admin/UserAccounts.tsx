import { useState } from 'react'
import { ShieldAlert, UserPlus } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { setUserLevel, setUserStatus } from '../../data/actions'
import { createUserAccount } from '../../data/workActions'
import { departmentName, fullName } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { formatDateTime, timeAgo } from '../../lib/dates'
import { cn } from '../../lib/utils'
import { ACCESS_LEVELS, ACCESS_LEVEL_LABELS, type AccessLevel } from '../../types'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FormModal } from '../../components/ui/FormModal'

const LEVEL_SORT: Record<AccessLevel, number> = { 'Main Admin': 0, 'Secondary Admin': 1, Finance: 2, HR: 3, Sales: 4, Manager: 5, Staff: 6 }

export const ACCESS_MATRIX: Array<{ who: AccessLevel; does: string; approves: string }> = [
  { who: 'Main Admin', does: 'CEO / MD dashboards (revenue, gross margin, staff, pipeline, cash flow, OEM partners, assets, projects); read-only elsewhere', approves: 'Final approval: projects & contracts over ₦50m, purchases over ₦20m (capital), change requests over ₦10m' },
  { who: 'Secondary Admin', does: 'Partner & OEM registry, sales contacts, vendors & subcontractors, licences, IT asset register, user accounts, integrations, audit log, backups, security', approves: '—' },
  { who: 'Finance', does: 'General ledger, receivables, payables, revenue recognition, period close, cash flow, payroll, requisitions → PO → GRN', approves: 'Finance manager: purchases up to ₦20m; pays approved claims' },
  { who: 'HR', does: 'Employee master data, recruitment, onboarding/offboarding, leave & attendance, KPIs & appraisals, learning & certifications', approves: 'Leave for anyone' },
  { who: 'Sales', does: 'CRM (leads, contacts, clients), pipeline, client invoices & payment status, forecast & win/loss, won-deal handover, RFQ/tender/EOI', approves: '—' },
  { who: 'Manager', does: 'Team projects, task allocation, milestones, change requests, status reports, team performance & utilisation, appraisals, IT assets', approves: 'Team purchases up to ₦5m, change requests up to ₦10m, team leave & expense claims' },
  { who: 'Staff', does: 'Own tasks, project calendar, timesheets, leave & claims, payslip/tax/pension/HMO, skills & certifications, proposals & quotations — own data only', approves: '—' },
]

export function UserAccounts() {
  const { state, user, perms, commit } = useData()
  const run = useAction()
  const [creating, setCreating] = useState(false)
  const users = [...state.users].sort((a, b) => LEVEL_SORT[a.level] - LEVEL_SORT[b.level] || departmentName(state, a.departmentId).localeCompare(departmentName(state, b.departmentId)))
  const withoutAccount = state.employees.filter((e) => e.status !== 'Inactive' && !state.users.some((u) => u.employeeId === e.id))
  const manage = perms.canManageAdmin
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          <strong>Demonstration feature.</strong> Each person has their own account and sees only what their account type and department allow. In this prototype the checks run in the browser and
          every account uses the demo password <code className="rounded bg-white px-1">{APP_CONFIG.demoPassword}</code>. Production enforces permissions on the server, with real passwords or company
          single sign-on.
        </p>
      </div>
      <Card>
        <CardHeader
          title="User accounts"
          description={`${state.users.length} accounts · ${withoutAccount.length} active employees without an account`}
          actions={manage && <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>Create account</Button>}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-5 py-2.5 text-left">User</th>
                <th scope="col" className="px-4 py-2.5 text-left">Username</th>
                <th scope="col" className="px-4 py-2.5 text-left">Department</th>
                <th scope="col" className="px-4 py-2.5 text-left">Account type</th>
                <th scope="col" className="px-4 py-2.5 text-left">Last active</th>
                <th scope="col" className="px-4 py-2.5 text-left">Status</th>
                <th scope="col" className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={cn(u.id === user.id && 'bg-brand-50/50')}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">
                      {u.name} {u.id === user.id && <Badge tone="brand">You</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">{u.title}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                  <td className="px-4 py-3 text-slate-700">{departmentName(state, u.departmentId)}</td>
                  <td className="px-4 py-3">
                    {manage ? (
                      <select
                        aria-label={`Account type for ${u.name}`}
                        value={u.level}
                        disabled={u.id === user.id}
                        onChange={(e) => run(() => commit((s) => setUserLevel(s, u.id, e.target.value as AccessLevel)), { title: 'Account type updated', description: `${u.name} is now ${e.target.value}.` })}
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-50"
                      >
                        {ACCESS_LEVELS.map((r) => (
                          <option key={r} value={r}>
                            {ACCESS_LEVEL_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge>{ACCESS_LEVEL_LABELS[u.level]}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600" title={formatDateTime(u.lastActiveAt)}>
                    {timeAgo(u.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3">{u.status === 'Active' ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Suspended</Badge>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {manage && u.id !== user.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={u.status === 'Active' ? 'text-rose-600' : 'text-emerald-700'}
                        onClick={() => run(() => commit((s) => setUserStatus(s, u.id, u.status === 'Active' ? 'Suspended' : 'Active')), { title: u.status === 'Active' ? 'Account suspended' : 'Account reactivated', description: u.name })}
                      >
                        {u.status === 'Active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Account types — who can see and do what" description="Agreed with EMOCOM for the demo; production rules are enforced by the server" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-5 py-2.5 text-left">Account type</th>
                <th scope="col" className="px-4 py-2.5 text-left">Works with</th>
                <th scope="col" className="px-4 py-2.5 text-left">Approves</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ACCESS_MATRIX.map((r) => (
                <tr key={r.who} className="align-top">
                  <td className="px-5 py-3 font-medium whitespace-nowrap text-slate-900">{ACCESS_LEVEL_LABELS[r.who]}</td>
                  <td className="px-4 py-3">{r.does}</td>
                  <td className="px-4 py-3">{r.approves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <FormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create user account"
        description="Link the account to an employee record. The account type decides what they can see."
        fields={[
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, full: true, options: withoutAccount.map((e) => ({ value: e.id, label: `${fullName(e)} — ${e.jobTitle} (${departmentName(state, e.departmentId)})` })) },
          { name: 'username', label: 'Username', required: true, placeholder: 'e.g. staff.noc2', hint: 'Lowercase letters, numbers, dots or dashes' },
          { name: 'level', label: 'Account type', type: 'select', required: true, options: ACCESS_LEVELS.map((l) => ({ value: l, label: ACCESS_LEVEL_LABELS[l] })) },
        ]}
        initial={{ level: 'Staff' }}
        submitLabel="Create account"
        onSubmit={(v) => run(() => commit((s) => createUserAccount(s, { username: v.username, employeeId: v.employeeId, level: v.level as AccessLevel })), { title: 'Account created', description: `They can sign in as ${v.username.toLowerCase()} with the demo password.` })}
      />
    </div>
  )
}
