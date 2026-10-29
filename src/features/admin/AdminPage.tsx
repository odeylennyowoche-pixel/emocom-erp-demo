import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, CloudDownload, Database, Download, KeyRound, Mail, Plug, Plus, ShieldCheck, Star, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { evaluateVendor, recordBackup, registerVendor, saveContact, saveLicence, savePartner, toggleIntegration, updateSecurityPolicy } from '../../data/workActions'
import { useAction } from '../../hooks/useAction'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { addDays, formatDate, formatDateTime, timeAgo, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor, toMajorForDisplay } from '../../lib/money'
import { cn, includesText } from '../../lib/utils'
import { PARTNER_TYPES, type Contact, type EntityType, type Integration, type Partner, type SecurityPolicy, type SoftwareLicence, type Supplier } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { FormModal, formValue } from '../../components/ui/FormModal'
import { Modal } from '../../components/ui/Modal'
import { Checkbox, Field, Input, Select } from '../../components/ui/Form'
import { Notice, ProgressBar, Rating } from '../../components/ui/Progress'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import { ITAssetRegister } from './ITAssetRegister'
import { UserAccounts } from './UserAccounts'
import type { AdminTab } from '../auth/permissions'

const LABELS: Record<AdminTab, string> = {
  partners: 'Partners & OEMs',
  contacts: 'Sales contacts',
  vendors: 'Vendors & subcontractors',
  licences: 'Licences & subscriptions',
  itassets: 'IT asset register',
  users: 'User accounts',
  integrations: 'Integrations',
  audit: 'Audit log',
  backups: 'Backups',
  security: 'Security policies',
}

export default function AdminPage() {
  const { perms } = useData()
  const allowed = perms.adminTabs
  const [tabParam, setTab] = useTabParam<AdminTab>(allowed[0] ?? 'partners')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  return (
    <>
      <PageHeader
        title={perms.canManageAdmin ? 'Administration' : 'Partners, assets & audit'}
        description={perms.canManageAdmin ? 'Registries, licences, IT assets, user accounts, integrations, audit, backups and security.' : 'Read-only view of the partner and OEM registry, IT assets and the audit log.'}
        meta={!perms.canManageAdmin ? <Badge>Read only</Badge> : undefined}
      />
      <Card>
        <div className="px-4 pt-1">
          <Tabs label="Administration sections" active={tab} onChange={setTab} tabs={allowed.map((k) => ({ key: k, label: LABELS[k] }))} />
        </div>
        {tab === 'partners' && <PartnersTab />}
        {tab === 'contacts' && <ContactsTab />}
        {tab === 'vendors' && <VendorsTab />}
        {tab === 'licences' && <LicencesTab />}
        {tab === 'itassets' && <ITAssetRegister manageLink={perms.canManageAdmin} />}
        {tab === 'users' && <UserAccounts />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'backups' && <BackupsTab />}
        {tab === 'security' && <SecurityTab />}
      </Card>
    </>
  )
}

// ---------------- Partners & OEMs ----------------

function PartnersTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [type, setType] = useQueryState('type')
  const [editing, setEditing] = useState<Partner | 'new' | null>(null)
  const today = todayISO()
  const rows = state.partners.filter((p) => !type || p.type === type)
  const pipelineByOem = state.partners.map((p) => ({ name: p.name, value: toMajorForDisplay(sumMinor(state.opportunities.filter((o) => o.oem === p.name && !['Won', 'Lost'].includes(o.stage)).map((o) => o.valueMinor))) })).filter((x) => x.value > 0)
  const partner = editing && editing !== 'new' ? editing : undefined
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice tone="warning">Only OpenText and Mitsumi Distribution are confirmed from public sources. The other entries are <strong>examples</strong> of the OEM types EMOCOM works with — replace them with EMOCOM’s actual partner list, tiers and contacts.</Notice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="OEMs" value={state.partners.filter((p) => p.type === 'OEM').length} icon={<Building2 className="size-5" />} />
        <StatCard label="Distributors & alliances" value={state.partners.filter((p) => p.type !== 'OEM').length} icon={<Building2 className="size-5" />} tone="purple" />
        <StatCard label="Renewals due (60 days)" value={state.partners.filter((p) => p.status === 'Renewal due').length} hint={`${state.partners.filter((p) => p.status === 'Lapsed').length} lapsed`} icon={<Star className="size-5" />} tone="amber" />
        <StatCard label="Certified staff" value={state.partners.reduce((s, p) => s + p.certifiedStaff, 0)} hint="across partner programmes" icon={<ShieldCheck className="size-5" />} tone="emerald" />
      </div>
      {pipelineByOem.length > 0 && (
        <Card>
          <CardHeader title="Open pipeline by OEM" description="Value of open opportunities tagged with each technology partner" />
          <CardBody>
            <div className="h-56" role="img" aria-label="Pipeline by OEM">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineByOem} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="name" {...AXIS_PROPS} interval={0} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={64} />
                  <Tooltip content={<ChartTooltip money />} />
                  <Bar dataKey="value" name="Open pipeline" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}
      <Card>
        <Toolbar>
          <FilterSelect label="Type" value={type} onChange={setType} options={PARTNER_TYPES} allLabel="All partner types" />
          {perms.canManageAdmin && <Button className="sm:ml-auto" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Register partner</Button>}
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Partner', sortValue: (p) => p.name, render: (p) => (<span><span className="flex items-center gap-2 font-medium text-slate-900">{p.name}{p.verified ? <Badge tone="success">Publicly confirmed</Badge> : <Badge>Example</Badge>}</span><span className="text-xs text-slate-500">{p.focus}</span></span>) },
            { key: 'type', header: 'Type', render: (p) => p.type, hideBelow: 'sm' },
            { key: 'tier', header: 'Tier', render: (p) => p.tier, hideBelow: 'md' },
            { key: 'renew', header: 'Renewal', sortValue: (p) => p.renewalDate, render: (p) => (<span className="whitespace-nowrap">{formatDate(p.renewalDate)}{p.renewalDate >= today && p.renewalDate <= addDays(today, 60) && <span className="block text-xs text-amber-700">in {Math.round((Date.parse(p.renewalDate) - Date.parse(today)) / 86_400_000)} days</span>}</span>), hideBelow: 'md' },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'contact', header: 'Channel contact', render: (p) => (<span><span className="block text-slate-800">{p.contactName}</span><span className="text-xs text-slate-500">{p.contactEmail}</span></span>), hideBelow: 'lg' },
            { key: 'a', header: '', align: 'right', render: (p) => (perms.canManageAdmin ? <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button> : null) },
          ]}
        />
      </Card>
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={partner ? `Edit ${partner.name}` : 'Register partner / OEM'}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'type', label: 'Type', type: 'select', required: true, options: PARTNER_TYPES },
          { name: 'focus', label: 'Technology focus', required: true, full: true },
          { name: 'tier', label: 'Partner tier / level', required: true },
          { name: 'certifiedStaff', label: 'Certified staff', type: 'number', required: true, min: 0, max: 500 },
          { name: 'since', label: 'Partner since', type: 'date', required: true },
          { name: 'renewalDate', label: 'Renewal date', type: 'date', required: true },
          { name: 'contactName', label: 'Channel contact', required: true },
          { name: 'contactEmail', label: 'Contact email', type: 'email', required: true },
        ]}
        initial={partner ? { name: partner.name, type: partner.type, focus: partner.focus, tier: partner.tier, certifiedStaff: String(partner.certifiedStaff), since: partner.since, renewalDate: partner.renewalDate, contactName: partner.contactName, contactEmail: partner.contactEmail } : { type: 'OEM', certifiedStaff: '0', since: today, renewalDate: addDays(today, 365) }}
        onSubmit={(v) =>
          run(
            () =>
              commit((s) =>
                savePartner(
                  s,
                  {
                    name: v.name,
                    type: v.type as Partner['type'],
                    focus: v.focus,
                    tier: v.tier,
                    certifiedStaff: Number(v.certifiedStaff),
                    since: v.since,
                    renewalDate: v.renewalDate,
                    status: v.renewalDate < today ? 'Lapsed' : v.renewalDate <= addDays(today, 60) ? 'Renewal due' : 'Active',
                    contactName: v.contactName,
                    contactEmail: v.contactEmail,
                    verified: partner?.verified ?? true,
                    notes: partner?.notes,
                  },
                  partner?.id,
                ),
              ),
            { title: partner ? 'Partner updated' : 'Partner registered' },
          )
        }
      />
    </div>
  )
}

// ---------------- Sales contacts ----------------

function ContactsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [q, setQ] = useState('')
  const [rel, setRel] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)
  const rows = state.contacts.filter((c) => (!rel || c.relationship === rel) && includesText([c.name, c.company, c.email, c.role], q))
  const contact = editing && editing !== 'new' ? editing : undefined
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search contacts…" />
        <FilterSelect label="Relationship" value={rel} onChange={setRel} options={['Client', 'Prospect', 'Partner']} allLabel="All" />
        <div className="flex gap-2 sm:ml-auto">
          <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadCsv('sales-contacts', rows, [{ header: 'Name', value: (c) => c.name }, { header: 'Role', value: (c) => c.role }, { header: 'Company', value: (c) => c.company }, { header: 'Type', value: (c) => c.relationship }, { header: 'Email', value: (c) => c.email }, { header: 'Phone', value: (c) => c.phone }, { header: 'City', value: (c) => c.city }])}>Export</Button>
          {perms.canManageAdmin && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add contact</Button>}
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        resetKey={q + rel}
        initialSort={{ key: 'company', dir: 'asc' }}
        columns={[
          { key: 'name', header: 'Name', sortValue: (c) => c.name, render: (c) => (<span><span className="block font-medium text-slate-900">{c.name}</span><span className="text-xs text-slate-500">{c.role}</span></span>) },
          { key: 'company', header: 'Company', sortValue: (c) => c.company, render: (c) => c.company },
          { key: 'rel', header: 'Type', render: (c) => <Badge tone={c.relationship === 'Client' ? 'success' : c.relationship === 'Partner' ? 'brand' : 'info'}>{c.relationship}</Badge>, hideBelow: 'sm' },
          { key: 'email', header: 'Email', render: (c) => <a href={`mailto:${c.email}`} className="text-brand-700 hover:underline">{c.email}</a>, hideBelow: 'md' },
          { key: 'phone', header: 'Phone', render: (c) => <span className="whitespace-nowrap">{c.phone}</span>, hideBelow: 'lg' },
          { key: 'owner', header: 'Owner', render: (c) => state.users.find((u) => u.id === c.ownerUserId)?.name ?? '—', hideBelow: 'lg' },
          { key: 'a', header: '', align: 'right', render: (c) => (perms.canManageAdmin ? <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button> : null) },
        ]}
      />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={contact ? 'Edit contact' : 'Add contact'}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'role', label: 'Role', required: true },
          { name: 'company', label: 'Company', required: true },
          { name: 'relationship', label: 'Relationship', type: 'select', required: true, options: ['Client', 'Prospect', 'Partner'] },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', required: true },
          { name: 'city', label: 'City', required: true },
          { name: 'ownerUserId', label: 'Account owner', type: 'select', required: true, options: state.users.filter((u) => u.level === 'Sales' || u.username === 'manager.sales').map((u) => ({ value: u.id, label: u.name })) },
        ]}
        initial={contact ? { ...contact } : { relationship: 'Client', city: 'Lagos' }}
        onSubmit={(v) => run(() => commit((s) => saveContact(s, { name: v.name, role: v.role, company: v.company, relationship: v.relationship as Contact['relationship'], email: v.email, phone: v.phone, city: v.city, ownerUserId: v.ownerUserId }, contact?.id)), { title: 'Contact saved' })}
      />
    </>
  )
}

// ---------------- Vendors & subcontractors ----------------

function avgScore(s: Supplier): number | undefined {
  const e = s.evaluation
  return e ? (e.quality + e.delivery + e.price + e.compliance) / 4 : undefined
}

function VendorsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [kind, setKind] = useState('')
  const [registering, setRegistering] = useState(false)
  const [evaluating, setEvaluating] = useState<Supplier | null>(null)
  const rows = state.suppliers.filter((s) => !kind || (s.kind ?? 'Vendor') === kind)
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered vendors" value={state.suppliers.filter((s) => (s.kind ?? 'Vendor') === 'Vendor').length} icon={<Building2 className="size-5" />} />
        <StatCard label="Subcontractors" value={state.suppliers.filter((s) => s.kind === 'Subcontractor').length} icon={<Building2 className="size-5" />} tone="purple" />
        <StatCard label="Pending review" value={state.suppliers.filter((s) => s.registration === 'Pending review').length} icon={<ShieldCheck className="size-5" />} tone="amber" />
        <StatCard label="Suspended" value={state.suppliers.filter((s) => s.registration === 'Suspended').length} icon={<ShieldCheck className="size-5" />} tone="rose" />
      </div>
      <Card>
        <Toolbar>
          <FilterSelect label="Kind" value={kind} onChange={setKind} options={['Vendor', 'Subcontractor']} allLabel="Vendors & subcontractors" />
          {perms.canManageAdmin && <Button className="sm:ml-auto" icon={<Plus className="size-4" />} onClick={() => setRegistering(true)}>Register vendor / subcontractor</Button>}
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Name', sortValue: (s) => s.name, render: (s) => (<span><span className="block font-medium text-slate-900">{s.name}</span><span className="text-xs text-slate-500">{s.code} · {s.category} · {s.city}</span></span>) },
            { key: 'kind', header: 'Kind', render: (s) => <Badge tone={s.kind === 'Subcontractor' ? 'purple' : 'neutral'}>{s.kind ?? 'Vendor'}</Badge>, hideBelow: 'sm' },
            { key: 'reg', header: 'Registration', render: (s) => <StatusBadge status={s.registration === 'Approved' ? 'Approved' : s.registration ?? 'Approved'} /> },
            { key: 'score', header: 'Evaluation', sortValue: (s) => avgScore(s) ?? 0, render: (s) => (s.evaluation ? (<span><Rating value={avgScore(s)} /><span className="block text-xs text-slate-500">{formatDate(s.evaluation.evaluatedAt)}</span></span>) : <span className="text-xs text-amber-700">Not evaluated</span>) },
            { key: 'contact', header: 'Contact', render: (s) => (<span><span className="block text-slate-800">{s.contactName}</span><span className="text-xs text-slate-500">{s.email}</span></span>), hideBelow: 'lg' },
            { key: 'a', header: '', align: 'right', render: (s) => (perms.canManageAdmin ? <Button size="sm" variant="secondary" onClick={() => setEvaluating(s)}>Evaluate</Button> : null) },
          ]}
        />
      </Card>
      <FormModal
        open={registering}
        onClose={() => setRegistering(false)}
        title="Register vendor or subcontractor"
        fields={[
          { name: 'name', label: 'Company name', required: true, full: true },
          { name: 'kind', label: 'Kind', type: 'select', required: true, options: ['Vendor', 'Subcontractor'] },
          { name: 'category', label: 'Category / trade', required: true },
          { name: 'contactName', label: 'Contact person', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', required: true },
          { name: 'city', label: 'City', required: true },
        ]}
        initial={{ kind: 'Vendor', city: 'Lagos' }}
        submitLabel="Register"
        onSubmit={(v) => run(() => commit((s) => registerVendor(s, { name: v.name, kind: v.kind as Supplier['kind'], category: v.category, contactName: v.contactName, email: v.email, phone: v.phone, city: v.city, rating: 3, active: true, registration: 'Pending review' })), { title: 'Registered', description: 'Status: pending review. Evaluate it to approve.' })}
      >
        <Notice>In production, registration would collect CAC documents, tax clearance, bank details and HSE certificates for review.</Notice>
      </FormModal>
      <EvaluateModal vendor={evaluating} onClose={() => setEvaluating(null)} onSave={(scores, reg) => run(() => commit((s) => evaluateVendor(s, evaluating!.id, scores, reg)), { title: 'Evaluation saved' })} />
    </div>
  )
}

function EvaluateModal({ vendor, onClose, onSave }: { vendor: Supplier | null; onClose: () => void; onSave: (scores: { quality: number; delivery: number; price: number; compliance: number }, reg: NonNullable<Supplier['registration']>) => boolean }) {
  const [scores, setScores] = useState({ quality: 3, delivery: 3, price: 3, compliance: 3 })
  const [reg, setReg] = useState<NonNullable<Supplier['registration']>>('Approved')
  const [lastId, setLastId] = useState<string | null>(null)
  if (vendor && vendor.id !== lastId) {
    setLastId(vendor.id)
    setScores(vendor.evaluation ? { quality: vendor.evaluation.quality, delivery: vendor.evaluation.delivery, price: vendor.evaluation.price, compliance: vendor.evaluation.compliance } : { quality: 3, delivery: 3, price: 3, compliance: 3 })
    setReg(vendor.registration ?? 'Approved')
  }
  if (!vendor) return null
  const criteria: Array<[keyof typeof scores, string]> = [
    ['quality', 'Quality of goods / workmanship'],
    ['delivery', 'On-time delivery'],
    ['price', 'Price competitiveness'],
    ['compliance', 'Documentation, HSE & compliance'],
  ]
  return (
    <Modal
      open
      onClose={() => { setLastId(null); onClose() }}
      title={`Evaluate ${vendor.name}`}
      description={`${vendor.kind ?? 'Vendor'} · ${vendor.category}`}
      footer={<><Button variant="secondary" onClick={() => { setLastId(null); onClose() }}>Cancel</Button><Button onClick={() => { if (onSave(scores, reg)) { setLastId(null); onClose() } }}>Save evaluation</Button></>}
    >
      <div className="space-y-4">
        {criteria.map(([k, label]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-700">{label}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} role="radio" aria-checked={scores[k] === n} onClick={() => setScores((s) => ({ ...s, [k]: n }))} className={cn('size-8 rounded-md text-sm font-semibold ring-1', scores[k] === n ? 'bg-ink-900 text-brand-500 ring-ink-900' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50')}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-slate-600">Average: <span className="font-semibold">{((scores.quality + scores.delivery + scores.price + scores.compliance) / 4).toFixed(1)} / 5</span></p>
        <Field label="Registration status">
          {(id) => (
            <Select id={id} value={reg} onChange={(e) => setReg(e.target.value as NonNullable<Supplier['registration']>)}>
              <option>Approved</option>
              <option>Pending review</option>
              <option>Suspended</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

// ---------------- Licences & subscriptions ----------------

function LicencesTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [editing, setEditing] = useState<SoftwareLicence | 'new' | null>(null)
  const today = todayISO()
  const annual = (l: SoftwareLicence) => (l.billing === 'Monthly' ? l.costPerPeriodMinor * 12 : l.costPerPeriodMinor)
  const active = state.licences.filter((l) => l.status !== 'Cancelled')
  const lic = editing && editing !== 'new' ? editing : undefined
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Annual software spend" value={formatMoneyCompact(sumMinor(active.map(annual)))} icon={<Wallet className="size-5" />} />
        <StatCard label="Renewals in 45 days" value={active.filter((l) => l.renewalDate >= today && l.renewalDate <= addDays(today, 45)).length} icon={<KeyRound className="size-5" />} tone="amber" />
        <StatCard label="Expired" value={active.filter((l) => l.renewalDate < today).length} icon={<KeyRound className="size-5" />} tone="rose" />
        <StatCard label="Unused seats" value={active.reduce((s, l) => s + (l.seats - l.seatsUsed), 0)} hint="candidates to reclaim or cancel" icon={<KeyRound className="size-5" />} tone="purple" />
      </div>
      <Card>
        <CardHeader title="Software licences & subscriptions" actions={perms.canManageAdmin && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add subscription</Button>} />
        <DataTable
          rows={state.licences}
          rowKey={(l) => l.id}
          initialSort={{ key: 'renew', dir: 'asc' }}
          columns={[
            { key: 'p', header: 'Product', sortValue: (l) => l.product, render: (l) => (<span><span className="block font-medium text-slate-900">{l.product}</span><span className="text-xs text-slate-500">{l.vendor} · {l.category}</span></span>) },
            { key: 'seats', header: 'Seats', render: (l) => (<span className="block w-28"><ProgressBar value={(l.seatsUsed / Math.max(1, l.seats)) * 100} tone={l.seatsUsed / l.seats < 0.7 ? 'amber' : 'brand'} label="Seats used" /><span className="text-xs text-slate-500">{l.seatsUsed} of {l.seats} used</span></span>), hideBelow: 'sm' },
            { key: 'cost', header: 'Cost', align: 'right', sortValue: (l) => annual(l), render: (l) => (<span><span className="block">{formatMoney(l.costPerPeriodMinor)}</span><span className="text-xs text-slate-500">per {l.billing === 'Monthly' ? 'month' : 'year'}</span></span>), hideBelow: 'md' },
            { key: 'renew', header: 'Renewal', sortValue: (l) => l.renewalDate, render: (l) => formatDate(l.renewalDate) },
            { key: 's', header: 'Status', render: (l) => <StatusBadge status={l.renewalDate < today && l.status !== 'Cancelled' ? 'Expired' : l.status} /> },
            { key: 'a', header: '', align: 'right', render: (l) => (perms.canManageAdmin ? <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button> : null) },
          ]}
        />
      </Card>
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={lic ? `Edit ${lic.product}` : 'Add subscription'}
        description="Purchases above the manager limit still go through a purchase requisition."
        fields={[
          { name: 'product', label: 'Product', required: true, full: true },
          { name: 'vendor', label: 'Vendor', required: true },
          { name: 'category', label: 'Category', required: true },
          { name: 'seats', label: 'Seats purchased', type: 'number', required: true, min: 1, max: 10000 },
          { name: 'seatsUsed', label: 'Seats in use', type: 'number', required: true, min: 0, max: 10000 },
          { name: 'billing', label: 'Billing', type: 'select', required: true, options: ['Monthly', 'Annual'] },
          { name: 'cost', label: 'Cost per billing period (₦)', type: 'money', required: true },
          { name: 'renewalDate', label: 'Next renewal', type: 'date', required: true },
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Renewal due', 'Expired', 'Cancelled'] },
        ]}
        initial={lic ? { product: lic.product, vendor: lic.vendor, category: lic.category, billing: lic.billing, status: lic.status, renewalDate: lic.renewalDate, seats: String(lic.seats), seatsUsed: String(lic.seatsUsed), cost: minorToInput(lic.costPerPeriodMinor) } : { billing: 'Annual', status: 'Active', renewalDate: addDays(today, 365), seats: '10', seatsUsed: '0' }}
        onSubmit={(v) => run(() => commit((s) => saveLicence(s, { product: v.product, vendor: v.vendor, category: v.category, seats: Number(v.seats), seatsUsed: Number(v.seatsUsed), billing: v.billing as SoftwareLicence['billing'], costPerPeriodMinor: formValue.money(v.cost), renewalDate: v.renewalDate, status: v.status as SoftwareLicence['status'], ownerUserId: lic?.ownerUserId ?? state.currentUserId ?? '' }, lic?.id)), { title: 'Subscription saved' })}
      />
    </div>
  )
}

// ---------------- Integrations ----------------

const CATEGORY_ICON: Record<Integration['category'], typeof Mail> = { Email: Mail, Payments: Wallet, Productivity: Building2, 'Developer tools': Plug, Identity: KeyRound }

function IntegrationsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const groups = [...new Set(state.integrations.map((i) => i.category))]
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice tone="warning"><strong>Simulated.</strong> Connect / disconnect only changes the demo status — no data leaves the browser. Real integrations need the production backend, OAuth app registrations and the client’s approval.</Notice>
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{g}</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.integrations.filter((i) => i.category === g).map((i) => {
              const Icon = CATEGORY_ICON[i.category]
              return (
                <div key={i.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', i.connected ? 'bg-ink-900 text-brand-500' : 'bg-slate-100 text-slate-400')}><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{i.name}</p>
                      <p className="text-xs text-slate-500">{i.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{i.connected ? <>Connected{i.account ? ` · ${i.account}` : ''}{i.lastSync ? ` · synced ${timeAgo(i.lastSync)}` : ''}</> : 'Not connected'}</span>
                    {perms.canManageAdmin && (
                      <Button size="sm" variant={i.connected ? 'secondary' : 'primary'} onClick={() => run(() => commit((s) => toggleIntegration(s, i.id)), { title: i.connected ? `${i.name} disconnected` : `${i.name} connected`, description: 'Simulated for the demo.' })}>
                        {i.connected ? 'Disconnect' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- Audit log ----------------

const ENTITY_LABELS: Partial<Record<EntityType, string>> = { employee: 'Employees', inventory: 'Inventory', asset: 'Assets', purchaseRequest: 'Purchasing', supplier: 'Vendors', expense: 'Expenses', invoice: 'Invoices', system: 'System & users', sales: 'Sales', project: 'Projects', leave: 'Leave', claim: 'Claims', hr: 'HR', admin: 'Admin', finance: 'Finance' }

function AuditTab() {
  const { state } = useData()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [actor, setActor] = useState('')
  const rows = useMemo(() => state.activity.filter((a) => (!type || a.entityType === type) && (!actor || a.actor === actor) && includesText([a.action, a.actor], q)), [state.activity, type, actor, q])
  const actors = [...new Set(state.activity.map((a) => a.actor))].sort()
  return (
    <>
      <div className="px-4 pt-4 sm:px-5">
        <Notice>Every change made in the demo is recorded here (most recent 200). In production the audit log is written by the server, cannot be edited, and is retained according to policy.</Notice>
      </div>
      <Toolbar className="mt-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search actions…" />
        <FilterSelect label="Area" value={type} onChange={setType} options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label: label! }))} allLabel="All areas" />
        <FilterSelect label="Who" value={actor} onChange={setActor} options={actors} allLabel="Everyone" />
        <Button size="sm" variant="secondary" className="sm:ml-auto" icon={<Download className="size-4" />} onClick={() => downloadCsv('audit-log', rows, [{ header: 'When', value: (a) => a.at }, { header: 'Who', value: (a) => a.actor }, { header: 'Action', value: (a) => a.action }, { header: 'Area', value: (a) => ENTITY_LABELS[a.entityType] ?? a.entityType }])}>Export</Button>
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        resetKey={q + type + actor}
        pageSize={15}
        columns={[
          { key: 'at', header: 'When', render: (a) => <span className="whitespace-nowrap" title={formatDateTime(a.at)}>{formatDateTime(a.at)}</span> },
          { key: 'who', header: 'Who', render: (a) => a.actor },
          { key: 'what', header: 'Action', render: (a) => (a.link ? <Link to={a.link} className="text-slate-800 hover:text-brand-700 hover:underline">{a.action}</Link> : a.action) },
          { key: 'area', header: 'Area', render: (a) => <Badge>{ENTITY_LABELS[a.entityType] ?? a.entityType}</Badge>, hideBelow: 'md' },
        ]}
      />
    </>
  )
}

// ---------------- Backups ----------------

function BackupsTab() {
  const { state, commit } = useData()
  const run = useAction()
  const download = () => {
    const json = JSON.stringify(state, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emocom-erp-demo-backup-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    run(() => commit((s) => recordBackup(s, Math.round(blob.size / 1024))), { title: 'Backup created', description: 'A copy of the demo data was downloaded.' })
  }
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice>In the demo, “Back up now” downloads the demo data as a JSON file. Production backups are automatic, encrypted, stored off-site and tested with regular restores (target: daily, 30-day retention).</Notice>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Last successful backup" value={timeAgo(state.backups.find((b) => b.status === 'Completed')?.at ?? new Date().toISOString())} icon={<Database className="size-5" />} tone="emerald" />
        <StatCard label="Failed (last 7 days)" value={state.backups.filter((b) => b.status === 'Failed').length} icon={<Database className="size-5" />} tone="rose" />
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 p-4">
          <Button icon={<CloudDownload className="size-4" />} onClick={download}>Back up now</Button>
        </div>
      </div>
      <Card>
        <CardHeader title="Backup history" />
        <DataTable
          rows={state.backups}
          rowKey={(b) => b.id}
          columns={[
            { key: 'at', header: 'When', render: (b) => formatDateTime(b.at) },
            { key: 'k', header: 'Type', render: (b) => b.kind },
            { key: 'size', header: 'Size', align: 'right', render: (b) => `${(b.sizeKb / 1024).toFixed(1)} MB`, hideBelow: 'sm' },
            { key: 'by', header: 'By', render: (b) => b.by, hideBelow: 'md' },
            { key: 's', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
          ]}
        />
      </Card>
    </div>
  )
}

// ---------------- Security policies ----------------

function SecurityTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [p, setP] = useState<Omit<SecurityPolicy, 'updatedAt' | 'updatedBy'>>(() => {
    const { updatedAt: _a, updatedBy: _b, ...rest } = state.securityPolicy
    void _a
    void _b
    return rest
  })
  const disabled = !perms.canManageAdmin
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <Notice tone="warning">These settings describe the policy the production system would enforce. In this demo they are saved but not enforced — all accounts share the demo password.</Notice>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Passwords & sign-in" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum password length">{(id) => <Input id={id} type="number" min={8} max={64} disabled={disabled} value={p.passwordMinLength} onChange={(e) => setP({ ...p, passwordMinLength: Number(e.target.value) })} />}</Field>
            <Field label="Password expiry (days)">{(id) => <Input id={id} type="number" min={0} max={365} disabled={disabled} value={p.passwordExpiryDays} onChange={(e) => setP({ ...p, passwordExpiryDays: Number(e.target.value) })} />}</Field>
            <Field label="Lock account after failed attempts">{(id) => <Input id={id} type="number" min={3} max={20} disabled={disabled} value={p.lockoutAttempts} onChange={(e) => setP({ ...p, lockoutAttempts: Number(e.target.value) })} />}</Field>
            <Field label="Session timeout (minutes)">{(id) => <Input id={id} type="number" min={5} max={480} disabled={disabled} value={p.sessionTimeoutMinutes} onChange={(e) => setP({ ...p, sessionTimeoutMinutes: Number(e.target.value) })} />}</Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Access controls" />
          <CardBody className="space-y-4">
            <Checkbox label="Require multi-factor authentication (MFA)" description="Authenticator app or SMS code at every sign-in" disabled={disabled} checked={p.mfaRequired} onChange={(e) => setP({ ...p, mfaRequired: e.target.checked })} />
            <Checkbox label="Company single sign-on only" description="Staff sign in with Microsoft 365 / Google accounts; ERP passwords disabled" disabled={disabled} checked={p.ssoOnly} onChange={(e) => setP({ ...p, ssoOnly: e.target.checked })} />
            <Checkbox label="Restrict access to office networks / VPN" description="Block sign-ins from unknown IP addresses" disabled={disabled} checked={p.ipRestriction} onChange={(e) => setP({ ...p, ipRestriction: e.target.checked })} />
          </CardBody>
        </Card>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Last changed by {state.securityPolicy.updatedBy} · {formatDateTime(state.securityPolicy.updatedAt)}</p>
        {perms.canManageAdmin && <Button onClick={() => run(() => commit((s) => updateSecurityPolicy(s, p)), { title: 'Security policies saved' })}>Save policies</Button>}
      </div>
    </div>
  )
}
