import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Database, Pencil, Plus, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { saveDepartment, setUserLevel, setUserStatus, updateOrganization, updatePreferences } from '../../data/actions'
import { departmentName, employeeById, fullName } from '../../data/selectors'
import { useTabParam } from '../../hooks/useQueryState'
import { useAction } from '../../hooks/useAction'
import { formatDateTime, timeAgo } from '../../lib/dates'
import { formatMoney, minorToInput, MONEY_INPUT_PATTERN, parseMoneyToMinor } from '../../lib/money'
import { cn } from '../../lib/utils'
import { ACCESS_LEVELS, type AccentColor, type AccessLevel, type Department } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Checkbox, Field, Input, Select } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'

type TabKey = 'organization' | 'departments' | 'users' | 'preferences' | 'data'

export default function SettingsPage() {
  const [tab, setTab] = useTabParam<TabKey>('organization')
  return (
    <>
      <PageHeader title="Settings" description="Organisation profile, departments, users and demo preferences." />
      <div className="mb-6">
        <Tabs
          label="Settings sections"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'organization', label: 'Organisation' },
            { key: 'departments', label: 'Departments' },
            { key: 'users', label: 'Users & roles' },
            { key: 'preferences', label: 'Appearance & preferences' },
            { key: 'data', label: 'Demo data' },
          ]}
        />
      </div>
      {tab === 'organization' && <OrganizationSettings />}
      {tab === 'departments' && <DepartmentSettings />}
      {tab === 'users' && <UserSettings />}
      {tab === 'preferences' && <PreferenceSettings />}
      {tab === 'data' && <DataSettings />}
    </>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const orgSchema = z.object({
  name: z.string().trim().min(3, 'Enter the organisation name').max(80),
  shortName: z.string().trim().min(2, 'Enter a short display name').max(24),
  industry: z.string().trim().min(2).max(60),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number'),
  address: z.string().trim().min(5, 'Enter an address').max(140),
  fiscalYearStartMonth: z.string(),
})
type OrgForm = z.infer<typeof orgSchema>

function OrganizationSettings() {
  const { state, commit } = useData()
  const run = useAction()
  const toFormValues = (): OrgForm => ({ ...state.organization, fiscalYearStartMonth: String(state.organization.fiscalYearStartMonth) })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrgForm>({ resolver: zodResolver(orgSchema), defaultValues: toFormValues() })

  const onSubmit = (v: OrgForm) => {
    const ok = run(() => commit((s) => updateOrganization(s, { ...v, fiscalYearStartMonth: Number(v.fiscalYearStartMonth) })), { title: 'Organisation profile saved', description: 'The sidebar and documents now use the new details.' })
    if (ok) reset(v)
  }

  return (
    <Card>
      <CardHeader title="Organisation profile" description="Shown in the sidebar, invoices and printed reports." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name" required error={errors.name?.message}>
            {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
          </Field>
          <Field label="Short name" required error={errors.shortName?.message} hint="Shown in the navigation sidebar">
            {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.shortName} {...register('shortName')} />}
          </Field>
          <Field label="Industry" error={errors.industry?.message}>
            {(id, d) => <Input id={id} aria-describedby={d} {...register('industry')} />}
          </Field>
          <Field label="Fiscal year starts">
            {(id) => (
              <Select id={id} {...register('fiscalYearStartMonth')}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            {(id, d) => <Input id={id} type="email" aria-describedby={d} invalid={!!errors.email} {...register('email')} />}
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            {(id, d) => <Input id={id} type="tel" aria-describedby={d} invalid={!!errors.phone} {...register('phone')} />}
          </Field>
          <Field label="Address" required error={errors.address?.message} className="sm:col-span-2">
            {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.address} {...register('address')} />}
          </Field>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
            Product name <strong>{APP_CONFIG.productName} {APP_CONFIG.productSuffix}</strong> and currency <strong>{APP_CONFIG.currency}</strong> are configured in <code className="rounded bg-white px-1 text-xs">src/config/app.ts</code>.
          </div>
        </CardBody>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant="secondary" onClick={() => reset(toFormValues())} disabled={!isDirty}>
            Discard
          </Button>
          <Button type="submit" icon={<Save className="size-4" />} disabled={!isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  )
}

function DepartmentSettings() {
  const { state } = useData()
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  return (
    <Card>
      <CardHeader
        title="Departments"
        description={`${state.departments.length} departments · budgets drive the Finance budget view`}
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Add department
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th scope="col" className="px-5 py-2.5 text-left">Department</th>
              <th scope="col" className="px-4 py-2.5 text-left">Head</th>
              <th scope="col" className="px-4 py-2.5 text-right">Employees</th>
              <th scope="col" className="px-4 py-2.5 text-right">Annual budget</th>
              <th scope="col" className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.departments.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <p className="font-mono text-xs text-slate-500">{d.code}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{fullName(employeeById(state, d.headEmployeeId))}</td>
                <td className="tabular px-4 py-3 text-right">{state.employees.filter((e) => e.departmentId === d.id && e.status !== 'Inactive').length}</td>
                <td className="tabular px-4 py-3 text-right">{formatMoney(d.annualBudgetMinor)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DepartmentModal department={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

const deptSchema = z.object({
  name: z.string().trim().min(3, 'Enter a department name').max(60),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,5}$/, '2–5 letters, e.g. FIN'),
  headEmployeeId: z.string(),
  budget: z.string().trim().regex(MONEY_INPUT_PATTERN, 'Enter a valid amount'),
})
type DeptForm = z.infer<typeof deptSchema>

function DepartmentModal({ department, onClose }: { department: Department | 'new' | null; onClose: () => void }) {
  const { state, commit } = useData()
  const run = useAction()
  const existing = department && department !== 'new' ? department : undefined
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeptForm>({ resolver: zodResolver(deptSchema) })
  useEffect(() => {
    if (!department) return
    reset(existing ? { name: existing.name, code: existing.code, headEmployeeId: existing.headEmployeeId ?? '', budget: minorToInput(existing.annualBudgetMinor) } : { name: '', code: '', headEmployeeId: '', budget: '0' })
  }, [department, existing, reset])

  const onSubmit = (v: DeptForm) => {
    const ok = run(() => commit((s) => saveDepartment(s, { name: v.name, code: v.code, headEmployeeId: v.headEmployeeId || undefined, annualBudgetMinor: parseMoneyToMinor(v.budget) ?? 0 }, existing?.id)), {
      title: existing ? 'Department updated' : 'Department created',
      description: v.name,
    })
    if (ok) onClose()
  }

  const candidates = state.employees.filter((e) => e.status !== 'Inactive' && (!existing || e.departmentId === existing.id))

  return (
    <Modal
      open={department !== null}
      onClose={onClose}
      title={existing ? `Edit ${existing.name}` : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dept-form">
            Save
          </Button>
        </>
      }
    >
      <form id="dept-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="Code" required error={errors.code?.message}>
          {(id, d) => <Input id={id} className="uppercase" aria-describedby={d} invalid={!!errors.code} {...register('code')} />}
        </Field>
        <Field label={`Annual budget (${APP_CONFIG.currency})`} required error={errors.budget?.message}>
          {(id, d) => <Input id={id} inputMode="decimal" aria-describedby={d} invalid={!!errors.budget} {...register('budget')} />}
        </Field>
        <Field label="Department head" className="sm:col-span-2">
          {(id) => (
            <Select id={id} {...register('headEmployeeId')}>
              <option value="">Not assigned</option>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e)} — {e.jobTitle}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}

const LEVEL_SORT: Record<AccessLevel, number> = { CEO: 0, Administrator: 1, 'Head of Department': 2, Staff: 3 }

function UserSettings() {
  const { state, user, commit } = useData()
  const run = useAction()
  const users = [...state.users].sort(
    (a, b) => departmentName(state, a.departmentId).localeCompare(departmentName(state, b.departmentId)) || LEVEL_SORT[a.level] - LEVEL_SORT[b.level],
  )
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          <strong>Demonstration feature.</strong> Each person has their own account and sees only what their access level and department allow. In this prototype the checks
          run in the browser and all accounts share the demo password <code className="rounded bg-white px-1">{APP_CONFIG.demoPassword}</code>. A production system enforces
          permissions on the server with real passwords or company sign-in.
        </p>
      </div>
      <Card>
        <CardHeader title="User accounts" description={`${state.users.length} accounts · one per person`} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-5 py-2.5 text-left">User</th>
                <th scope="col" className="px-4 py-2.5 text-left">Username</th>
                <th scope="col" className="px-4 py-2.5 text-left">Department</th>
                <th scope="col" className="px-4 py-2.5 text-left">Access level</th>
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
                    <select
                      aria-label={`Access level for ${u.name}`}
                      value={u.level}
                      disabled={u.id === user.id}
                      onChange={(e) => run(() => commit((s) => setUserLevel(s, u.id, e.target.value as AccessLevel)), { title: 'Access level updated', description: `${u.name} is now ${e.target.value}.` })}
                      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-50"
                    >
                      {ACCESS_LEVELS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600" title={formatDateTime(u.lastActiveAt)}>
                    {timeAgo(u.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3">{u.status === 'Active' ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Suspended</Badge>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {u.id !== user.id && (
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
        <CardHeader title="Who can see what" description="Demo access matrix — replace with EMOCOM's real policy" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-5 py-2.5 text-left">Access</th>
                <th scope="col" className="px-4 py-2.5 text-left">Dashboard</th>
                <th scope="col" className="px-4 py-2.5 text-left">Employees</th>
                <th scope="col" className="px-4 py-2.5 text-left">Procurement</th>
                <th scope="col" className="px-4 py-2.5 text-left">Finance</th>
                <th scope="col" className="px-4 py-2.5 text-left">Approvals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ACCESS_MATRIX.map((r) => (
                <tr key={r.who}>
                  <td className="px-5 py-3 font-medium text-slate-900">{r.who}</td>
                  <td className="px-4 py-3">{r.dashboard}</td>
                  <td className="px-4 py-3">{r.employees}</td>
                  <td className="px-4 py-3">{r.procurement}</td>
                  <td className="px-4 py-3">{r.finance}</td>
                  <td className="px-4 py-3">{r.approvals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const ACCESS_MATRIX = [
  { who: 'CEO', dashboard: 'Whole company', employees: 'All', procurement: 'All + suppliers', finance: 'All', approvals: 'Any amount' },
  { who: 'Administrator', dashboard: 'Whole company', employees: 'All', procurement: 'All + suppliers', finance: 'All', approvals: 'None (runs the system)' },
  { who: 'Head of Finance', dashboard: 'Whole company', employees: 'Own department', procurement: 'Own department', finance: 'All + budgets', approvals: 'Any department ≤ ₦20m' },
  { who: 'Head of HR & Admin', dashboard: 'Department', employees: 'All (manage)', procurement: 'Own department', finance: 'Own department', approvals: 'Own department ≤ ₦5m' },
  { who: 'Head of Procurement', dashboard: 'Department', employees: 'Own department', procurement: 'All + suppliers + receiving', finance: 'Own department', approvals: 'Own department ≤ ₦5m' },
  { who: 'Head of Sales', dashboard: 'Department', employees: 'Own department', procurement: 'Own department', finance: 'Own department + client invoices', approvals: 'Own department ≤ ₦5m' },
  { who: 'Other heads of department', dashboard: 'Department', employees: 'Own department', procurement: 'Own department', finance: 'Own department', approvals: 'Own department ≤ ₦5m' },
  { who: 'HR staff', dashboard: 'Personal', employees: 'All (manage)', procurement: 'Own requests', finance: '—', approvals: '—' },
  { who: 'Finance staff', dashboard: 'Personal', employees: 'Own profile', procurement: 'Own requests', finance: 'Expenses, invoices, transactions', approvals: '—' },
  { who: 'Procurement staff', dashboard: 'Personal', employees: 'Own profile', procurement: 'All + suppliers + receiving', finance: '—', approvals: '—' },
  { who: 'Sales staff', dashboard: 'Personal', employees: 'Own profile', procurement: 'Own requests', finance: 'Client invoices (read)', approvals: '—' },
  { who: 'Other staff', dashboard: 'Personal', employees: 'Own profile', procurement: 'Own requests', finance: '—', approvals: '—' },
]

const ACCENTS: Array<{ key: AccentColor; label: string; swatch: string }> = [
  { key: 'gold', label: 'EMOCOM gold', swatch: '#d4af37' },
  { key: 'bronze', label: 'Bronze', swatch: '#cd8a52' },
  { key: 'blue', label: 'Corporate blue', swatch: '#2563eb' },
]

function PreferenceSettings() {
  const { state, commit } = useData()
  const prefs = state.preferences
  const set = (p: Partial<typeof prefs>) => commit((s) => updatePreferences(s, p))
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Brand accent colour" description="Applies to buttons, highlights and charts" />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                role="radio"
                aria-checked={prefs.accent === a.key}
                onClick={() => set({ accent: a.key })}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm', prefs.accent === a.key ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
              >
                <span className="size-6 rounded-full" style={{ background: a.swatch }} aria-hidden />
                {a.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <Building2 className="size-5 text-slate-400" />
            <p className="text-sm text-slate-600">Logo and organisation name come from the Organisation tab.</p>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Tables & display" />
        <CardBody className="space-y-5">
          <Checkbox label="Compact tables" description="Reduce row height to show more records." checked={prefs.compactTables} onChange={(e) => set({ compactTables: e.target.checked })} />
          <Checkbox label="Show demo environment banner" description="The DEMO DATA badge in the header always remains visible." checked={prefs.showDemoBanner} onChange={(e) => set({ showDemoBanner: e.target.checked })} />
          <Field label="Rows per page">
            {(id) => (
              <Select id={id} value={String(prefs.pageSize)} onChange={(e) => set({ pageSize: Number(e.target.value) })} className="max-w-40">
                {[10, 15, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardBody>
      </Card>
    </div>
  )
}

function DataSettings() {
  const { state, resetDemo } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  let sizeKb = 0
  try {
    sizeKb = Math.round(new Blob([JSON.stringify(state)]).size / 1024)
  } catch {
    sizeKb = 0
  }
  const counts = [
    ['Employees', state.employees.length],
    ['Inventory items', state.inventory.length],
    ['Stock movements', state.stockMovements.length],
    ['Assets', state.assets.length],
    ['Suppliers', state.suppliers.length],
    ['Purchase requests', state.purchaseRequests.length],
    ['Expenses', state.expenses.length],
    ['Invoices', state.invoices.length],
  ] as const
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Demo dataset" description={`Seeded ${formatDateTime(state.seededAt)} · ~${sizeKb} KB in this browser`} />
        <ul className="grid grid-cols-2 gap-px bg-slate-100">
          {counts.map(([label, n]) => (
            <li key={label} className="bg-white px-5 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="tabular text-lg font-semibold text-slate-900">{n.toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <CardBody className="border-t border-slate-100">
          <Button variant="danger" icon={<RotateCcw className="size-4" />} onClick={() => setConfirm(true)}>
            Reset demo data
          </Button>
          <p className="mt-2 text-xs text-slate-500">Restores the original fictional dataset. Useful before a presentation.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Storage & production boundaries" />
        <CardBody className="space-y-3 text-sm text-slate-600">
          <p className="flex items-start gap-2">
            <Database className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Data is stored in this browser’s localStorage under a versioned key. It is not shared between users or devices and is not backed up.
          </p>
          <p>Not implemented in this prototype (required for production):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Backend API, database and migrations</li>
            <li>Authentication and server-enforced permissions</li>
            <li>Audit logging, transaction integrity, backups</li>
            <li>Accounting rules, tax, payments and bank integrations</li>
            <li>Organisation-specific approval matrices</li>
          </ul>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all demo data?"
        tone="danger"
        confirmLabel="Reset data"
        message="All changes made in this browser — new employees, items, requests, approvals and settings — will be discarded and the original demo dataset restored."
        onConfirm={() => {
          resetDemo()
          setConfirm(false)
          toast.success('Demo data reset', 'The original dataset has been restored. Please sign in again.')
          navigate('/')
        }}
      />
    </div>
  )
}
