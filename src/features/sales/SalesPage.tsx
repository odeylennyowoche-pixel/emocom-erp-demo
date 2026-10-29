import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRightLeft, Briefcase, Handshake, Plus, Target, Trophy, UserPlus } from 'lucide-react'
import { useData } from '../../data/store'
import { acceptHandover, convertLead, requestHandover, saveContact, saveLead, saveOpportunity, saveTender, setOpportunityStage, setTenderStatus } from '../../data/workActions'
import { invoiceTotal } from '../../data/selectors'
import { OPEN_STAGES, STAGE_PROBABILITY, pipelineValue, salesForecast, weightedPipeline, winLoss } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { addDays, formatDate, monthLabel, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor, toMajorForDisplay } from '../../lib/money'
import { cn, includesText, initials } from '../../lib/utils'
import { LEAD_SOURCES, LEAD_STATUSES, OPPORTUNITY_STAGES, TENDER_STATUSES, TENDER_TYPES, type Contact, type Lead, type Opportunity, type OpportunityStage, type Tender } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { StatCard } from '../../components/ui/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { FormModal, formValue, type FieldSpec } from '../../components/ui/FormModal'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Notice } from '../../components/ui/Progress'
import { AXIS_PROPS, ChartTooltip, compactMoneyTick } from '../../components/charts/chartKit'
import type { Permissions, SalesTab } from '../auth/permissions'

const LABELS: Record<SalesTab, string> = {
  pipeline: 'Pipeline',
  leads: 'Leads',
  clients: 'Clients & contacts',
  tenders: 'RFQ / Tender / EOI',
  forecast: 'Forecast & win/loss',
  handover: 'Won-deal handover',
  invoices: 'Client invoices',
}

function canEdit(p: Permissions, owner?: string) {
  return p.sales === 'manage' || (p.sales === 'edit' && (!owner || owner === p.user.id))
}

export default function SalesPage() {
  const { state, perms } = useData()
  const allowed = perms.salesTabs
  const [tabParam, setTab] = useTabParam<SalesTab>(allowed[0] ?? 'pipeline')
  const tab = allowed.includes(tabParam) ? tabParam : allowed[0]
  const pendingHandovers = state.opportunities.filter((o) => o.handover?.status === 'Pending').length
  const counts: Partial<Record<SalesTab, number>> = {
    pipeline: state.opportunities.filter((o) => OPEN_STAGES.includes(o.stage)).length,
    leads: state.leads.filter((l) => l.status !== 'Converted' && l.status !== 'Disqualified').length,
    tenders: state.tenders.filter((t) => ['Received', 'Bid / no-bid', 'Preparing'].includes(t.status)).length,
    handover: pendingHandovers || undefined,
  }
  const onlyInvoices = allowed.length === 1 && allowed[0] === 'invoices'
  return (
    <>
      <PageHeader
        title={onlyInvoices ? 'Client invoices' : allowed.length === 1 && allowed[0] === 'clients' ? 'Clients & contacts' : 'Sales & CRM'}
        description={
          onlyInvoices
            ? 'Invoice and payment status for every client.'
            : perms.sales === 'view'
              ? 'Read-only view of the pipeline, forecast and client relationships.'
              : 'Leads, clients, opportunities, tenders, proposals and handover of won deals.'
        }
        meta={perms.sales === 'view' ? <Badge>Read only</Badge> : undefined}
      />
      <Card>
        <div className="px-4 pt-1">
          <Tabs label="Sales sections" active={tab} onChange={setTab} tabs={allowed.map((k) => ({ key: k, label: LABELS[k], count: counts[k] }))} />
        </div>
        {tab === 'pipeline' && <PipelineTab />}
        {tab === 'leads' && <LeadsTab />}
        {tab === 'clients' && <ClientsTab />}
        {tab === 'tenders' && <TendersTab />}
        {tab === 'forecast' && <ForecastTab />}
        {tab === 'handover' && <HandoverTab />}
        {tab === 'invoices' && <InvoicesTab />}
      </Card>
    </>
  )
}

function ownerName(state: { users: Array<{ id: string; name: string }> }, id: string) {
  return state.users.find((u) => u.id === id)?.name ?? '—'
}

// ---------------- Pipeline ----------------

function oppFields(salesUsers: Array<{ id: string; name: string }>): FieldSpec[] {
  return [
    { name: 'name', label: 'Opportunity', required: true, full: true, min: 3 },
    { name: 'clientName', label: 'Client', required: true },
    { name: 'serviceLine', label: 'Service line', type: 'select', required: true, options: ['Networking & Wi-Fi', 'Radio & Microwave', 'Security & CCTV', 'SCADA & Instrumentation', 'Fleet telematics', 'Managed services', 'Managed print', 'Cloud & digital', 'To be confirmed'] },
    { name: 'value', label: 'Value (₦)', type: 'money', required: true },
    { name: 'expectedClose', label: 'Expected close', type: 'date', required: true },
    { name: 'oem', label: 'OEM / technology partner', placeholder: 'e.g. Cisco' },
    { name: 'ownerUserId', label: 'Owner', type: 'select', required: true, options: salesUsers.map((u) => ({ value: u.id, label: u.name })) },
  ]
}

function PipelineTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [owner, setOwner] = useQueryState('owner')
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [creating, setCreating] = useState(false)
  const salesUsers = state.users.filter((u) => u.level === 'Sales' || (u.level === 'Manager' && u.departmentId === perms.user.departmentId && perms.sales === 'manage'))
  const opps = state.opportunities.filter((o) => !owner || (owner === 'me' ? o.ownerUserId === perms.user.id : o.ownerUserId === owner))
  const open = opps.filter((o) => OPEN_STAGES.includes(o.stage))
  const wl = winLoss(opps, addDays(todayISO(), -365))

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatMoneyCompact(pipelineValue(opps))} hint={`${open.length} opportunities`} icon={<Briefcase className="size-5" />} />
        <StatCard label="Weighted forecast" value={formatMoneyCompact(weightedPipeline(opps))} hint="value × stage probability" icon={<Target className="size-5" />} tone="purple" />
        <StatCard label="Won (12 months)" value={formatMoneyCompact(wl.wonValue)} hint={`${wl.won.length} deals`} icon={<Trophy className="size-5" />} tone="emerald" />
        <StatCard label="Win rate" value={`${Math.round(wl.winRate * 100)}%`} hint={`${wl.lost.length} lost`} icon={<Handshake className="size-5" />} tone="amber" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterSelect
          label="Owner"
          value={owner}
          onChange={setOwner}
          allLabel="Everyone’s deals"
          options={[...(perms.sales !== 'view' ? [{ value: 'me', label: 'My deals' }] : []), ...state.users.filter((u) => state.opportunities.some((o) => o.ownerUserId === u.id)).map((u) => ({ value: u.id, label: u.name }))]}
        />
        {perms.sales !== 'view' && perms.sales !== 'none' && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New opportunity
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {OPEN_STAGES.map((stage) => {
          const col = open.filter((o) => o.stage === stage)
          return (
            <div key={stage} className="min-w-0 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-800">
                  {stage} <span className="font-normal text-slate-500">· {Math.round(STAGE_PROBABILITY[stage] * 100)}%</span>
                </p>
                <span className="tabular text-xs text-slate-500">{formatMoneyCompact(sumMinor(col.map((o) => o.valueMinor)))}</span>
              </div>
              <ul className="space-y-2">
                {col.length === 0 && <li className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">No deals</li>}
                {col.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => setSelected(o)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow">
                      <p className="text-sm font-medium text-slate-900">{o.name}</p>
                      <p className="truncate text-xs text-slate-500">{o.clientName}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="tabular text-sm font-semibold text-slate-900">{formatMoneyCompact(o.valueMinor)}</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          {formatDate(o.expectedClose)}
                          <span className="flex size-5 items-center justify-center rounded-full bg-ink-900 text-[10px] font-semibold text-brand-500" title={ownerName(state, o.ownerUserId)}>
                            {initials(ownerName(state, o.ownerUserId))}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <OpportunityModal opp={selected && state.opportunities.find((o) => o.id === selected.id)} onClose={() => setSelected(null)} />
      <FormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="New opportunity"
        fields={oppFields(salesUsers)}
        initial={{ ownerUserId: perms.user.id, expectedClose: addDays(todayISO(), 60), serviceLine: 'To be confirmed' }}
        submitLabel="Create"
        onSubmit={(v) => run(() => commit((s) => saveOpportunity(s, { name: v.name, clientName: v.clientName, serviceLine: v.serviceLine, valueMinor: formValue.money(v.value), expectedClose: v.expectedClose, ownerUserId: v.ownerUserId, oem: formValue.optional(v.oem) })), { title: 'Opportunity created' })}
      />
    </div>
  )
}

function OpportunityModal({ opp, onClose }: { opp: Opportunity | null | undefined; onClose: () => void }) {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [editing, setEditing] = useState(false)
  const [losing, setLosing] = useState(false)
  if (!opp) return null
  const editable = canEdit(perms, opp.ownerUserId) && OPEN_STAGES.includes(opp.stage)
  const next = OPEN_STAGES[OPEN_STAGES.indexOf(opp.stage) + 1] as OpportunityStage | undefined
  const salesUsers = state.users.filter((u) => u.level === 'Sales' || u.username === 'manager.sales')
  const move = (stage: OpportunityStage) => run(() => commit((s) => setOpportunityStage(s, opp.id, stage)), { title: `Moved to ${stage}`, description: opp.name })
  return (
    <>
      <Modal
        open={!editing && !losing}
        onClose={onClose}
        title={opp.name}
        description={`${opp.code} · ${opp.clientName}`}
        size="lg"
        footer={
          editable ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="secondary" className="text-rose-600" onClick={() => setLosing(true)}>
                Mark lost
              </Button>
              {next && (
                <Button variant="secondary" icon={<ArrowRightLeft className="size-4" />} onClick={() => move(next)}>
                  Move to {next}
                </Button>
              )}
              <Button variant="success" icon={<Trophy className="size-4" />} onClick={() => move('Won')}>
                Mark won
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {OPPORTUNITY_STAGES.filter((s) => s !== 'Lost').map((s) => (
              <span key={s} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', s === opp.stage ? 'bg-ink-900 text-brand-500' : OPPORTUNITY_STAGES.indexOf(s) < OPPORTUNITY_STAGES.indexOf(opp.stage) && opp.stage !== 'Lost' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500')}>
                {s}
              </span>
            ))}
            {opp.stage === 'Lost' && <StatusBadge status="Lost" />}
          </div>
          <DetailList
            columns={3}
            items={[
              { label: 'Value', value: formatMoney(opp.valueMinor) },
              { label: 'Probability', value: `${Math.round(STAGE_PROBABILITY[opp.stage] * 100)}%` },
              { label: 'Weighted', value: formatMoney(Math.round(opp.valueMinor * STAGE_PROBABILITY[opp.stage])) },
              { label: 'Service line', value: opp.serviceLine },
              { label: 'OEM / partner', value: opp.oem ?? '—' },
              { label: 'Owner', value: ownerName(state, opp.ownerUserId) },
              { label: 'Expected close', value: formatDate(opp.expectedClose) },
              { label: 'Created', value: formatDate(opp.createdAt) },
              { label: opp.stage === 'Lost' ? 'Loss reason' : 'Closed', value: opp.lossReason ?? formatDate(opp.closedAt) },
            ]}
          />
          {!editable && perms.sales !== 'view' && OPEN_STAGES.includes(opp.stage) && <Notice>Only the owner ({ownerName(state, opp.ownerUserId)}) or the sales manager can change this deal.</Notice>}
        </div>
      </Modal>
      <FormModal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit opportunity"
        fields={oppFields(salesUsers)}
        initial={{ name: opp.name, clientName: opp.clientName, serviceLine: opp.serviceLine, value: minorToInput(opp.valueMinor), expectedClose: opp.expectedClose, oem: opp.oem ?? '', ownerUserId: opp.ownerUserId }}
        onSubmit={(v) => run(() => commit((s) => saveOpportunity(s, { name: v.name, clientName: v.clientName, serviceLine: v.serviceLine, valueMinor: formValue.money(v.value), expectedClose: v.expectedClose, ownerUserId: v.ownerUserId, oem: formValue.optional(v.oem) }, opp.id)), { title: 'Opportunity updated' })}
      />
      <ConfirmDialog
        open={losing}
        onClose={() => setLosing(false)}
        title="Mark this deal as lost?"
        tone="danger"
        confirmLabel="Mark lost"
        message="Lost deals feed the win/loss analysis."
        noteLabel="Loss reason"
        notePlaceholder="e.g. Lost on price"
        onConfirm={(note) => {
          run(() => commit((s) => setOpportunityStage(s, opp.id, 'Lost', note)), { title: 'Marked as lost' })
          setLosing(false)
        }}
      />
    </>
  )
}

// ---------------- Leads ----------------

function LeadsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState('status')
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const rows = state.leads.filter((l) => (!status || l.status === status) && includesText([l.company, l.contactName, l.interest], q))
  const fields: FieldSpec[] = [
    { name: 'company', label: 'Company', required: true },
    { name: 'contactName', label: 'Contact person', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', required: true },
    { name: 'interest', label: 'Interest / need', required: true, full: true },
    { name: 'source', label: 'Source', type: 'select', required: true, options: LEAD_SOURCES },
    { name: 'value', label: 'Estimated value (₦)', type: 'money', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: LEAD_STATUSES.filter((s) => s !== 'Converted') },
  ]
  const lead = editing && editing !== 'new' ? editing : undefined
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search leads…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={LEAD_STATUSES} allLabel="All statuses" />
        {perms.sales !== 'view' && (
          <Button className="sm:ml-auto" icon={<UserPlus className="size-4" />} onClick={() => setEditing('new')}>
            Add lead
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(l) => l.id}
        resetKey={q + status}
        initialSort={{ key: 'created', dir: 'desc' }}
        columns={[
          { key: 'company', header: 'Company', sortValue: (l) => l.company, render: (l) => (<span><span className="block font-medium text-slate-900">{l.company}</span><span className="text-xs text-slate-500">{l.contactName}</span></span>) },
          { key: 'interest', header: 'Interest', render: (l) => l.interest, hideBelow: 'md' },
          { key: 'source', header: 'Source', render: (l) => l.source, hideBelow: 'lg' },
          { key: 'value', header: 'Est. value', align: 'right', sortValue: (l) => l.estValueMinor, render: (l) => formatMoneyCompact(l.estValueMinor) },
          { key: 'status', header: 'Status', sortValue: (l) => l.status, render: (l) => <StatusBadge status={l.status} /> },
          { key: 'owner', header: 'Owner', render: (l) => ownerName(state, l.ownerUserId), hideBelow: 'lg' },
          { key: 'created', header: 'Added', sortValue: (l) => l.createdAt, render: (l) => formatDate(l.createdAt), hideBelow: 'sm' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (l) =>
              canEdit(perms, l.ownerUserId) && l.status !== 'Converted' && l.status !== 'Disqualified' ? (
                <span className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => run(() => commit((s) => convertLead(s, l.id)), { title: 'Lead converted', description: 'A new opportunity is in the pipeline.' })}>
                    Convert
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={lead ? 'Edit lead' : 'Add lead'}
        fields={fields}
        initial={lead ? { company: lead.company, contactName: lead.contactName, email: lead.email, phone: lead.phone, interest: lead.interest, source: lead.source, status: lead.status, value: minorToInput(lead.estValueMinor) } : { status: 'New', source: 'Referral' }}
        onSubmit={(v) =>
          run(
            () =>
              commit((s) =>
                saveLead(s, { company: v.company, contactName: v.contactName, email: v.email, phone: v.phone, interest: v.interest, source: v.source as Lead['source'], estValueMinor: formValue.money(v.value), status: v.status as Lead['status'], ownerUserId: lead?.ownerUserId ?? perms.user.id }, lead?.id),
              ),
            { title: lead ? 'Lead updated' : 'Lead added' },
          )
        }
      />
    </>
  )
}

// ---------------- Clients & contacts ----------------

function ClientsTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [q, setQ] = useQueryState('q')
  const [rel, setRel] = useQueryState('rel')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)
  const today = todayISO()
  const clients = useMemo(() => {
    const names = [...new Set(state.invoices.map((i) => i.customer.name))]
    return names.map((name) => {
      const invs = state.invoices.filter((i) => i.customer.name === name)
      return {
        name,
        billed12m: sumMinor(invs.filter((i) => i.status !== 'Draft' && i.issueDate >= addDays(today, -365)).map(invoiceTotal)),
        outstanding: sumMinor(invs.filter((i) => i.status === 'Sent' || i.status === 'Overdue').map(invoiceTotal)),
        overdue: invs.filter((i) => i.status === 'Overdue').length,
        openOpps: state.opportunities.filter((o) => o.clientName === name && OPEN_STAGES.includes(o.stage)).length,
        contacts: state.contacts.filter((c) => c.company === name).length,
      }
    })
  }, [state.invoices, state.opportunities, state.contacts, today])
  const contacts = state.contacts.filter((c) => (!rel || c.relationship === rel) && includesText([c.name, c.company, c.role, c.email], q))
  const canAdd = perms.sales === 'edit' || perms.sales === 'manage' || perms.canManageAdmin
  const contact = editing && editing !== 'new' ? editing : undefined
  return (
    <>
      <CardHeader title="Clients" description="Billing and open opportunities per client" className="border-t-0" />
      <DataTable
        rows={clients}
        rowKey={(c) => c.name}
        pageSize={5}
        initialSort={{ key: 'billed', dir: 'desc' }}
        columns={[
          { key: 'name', header: 'Client', sortValue: (c) => c.name, render: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
          { key: 'billed', header: 'Billed (12m)', align: 'right', sortValue: (c) => c.billed12m, render: (c) => formatMoneyCompact(c.billed12m) },
          { key: 'out', header: 'Outstanding', align: 'right', sortValue: (c) => c.outstanding, render: (c) => (<span className={c.overdue ? 'text-rose-700' : ''}>{formatMoneyCompact(c.outstanding)}{c.overdue ? ` · ${c.overdue} overdue` : ''}</span>) },
          { key: 'opps', header: 'Open deals', align: 'right', sortValue: (c) => c.openOpps, render: (c) => c.openOpps, hideBelow: 'sm' },
          { key: 'contacts', header: 'Contacts', align: 'right', render: (c) => c.contacts, hideBelow: 'md' },
        ]}
      />
      <CardHeader title="Sales contacts" description="General contact information for clients, prospects and partners" />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search contacts…" />
        <FilterSelect label="Relationship" value={rel} onChange={setRel} options={['Client', 'Prospect', 'Partner']} allLabel="All relationships" />
        {canAdd && (
          <Button className="sm:ml-auto" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Add contact
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={contacts}
        rowKey={(c) => c.id}
        resetKey={q + rel}
        columns={[
          { key: 'name', header: 'Name', sortValue: (c) => c.name, render: (c) => (<span><span className="block font-medium text-slate-900">{c.name}</span><span className="text-xs text-slate-500">{c.role}</span></span>) },
          { key: 'company', header: 'Company', sortValue: (c) => c.company, render: (c) => c.company },
          { key: 'rel', header: 'Type', render: (c) => <Badge tone={c.relationship === 'Client' ? 'success' : c.relationship === 'Partner' ? 'brand' : 'info'}>{c.relationship}</Badge>, hideBelow: 'sm' },
          { key: 'email', header: 'Email', render: (c) => <a className="text-brand-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a>, hideBelow: 'md' },
          { key: 'phone', header: 'Phone', render: (c) => <span className="whitespace-nowrap">{c.phone}</span>, hideBelow: 'lg' },
          { key: 'owner', header: 'Account owner', render: (c) => ownerName(state, c.ownerUserId), hideBelow: 'lg' },
          { key: 'a', header: '', align: 'right', render: (c) => (canAdd ? <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button> : null) },
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
        ]}
        initial={contact ? { ...contact } : { relationship: 'Client', city: 'Lagos' }}
        onSubmit={(v) => run(() => commit((s) => saveContact(s, { name: v.name, role: v.role, company: v.company, relationship: v.relationship as Contact['relationship'], email: v.email, phone: v.phone, city: v.city, ownerUserId: contact?.ownerUserId ?? perms.user.id }, contact?.id)), { title: contact ? 'Contact updated' : 'Contact added' })}
      />
    </>
  )
}

// ---------------- Tenders ----------------

function TendersTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [type, setType] = useQueryState('type')
  const [creating, setCreating] = useState(false)
  const today = todayISO()
  const rows = state.tenders.filter((t) => !type || t.type === type)
  return (
    <>
      <Toolbar>
        <FilterSelect label="Type" value={type} onChange={setType} options={TENDER_TYPES} allLabel="RFQs, tenders & EOIs" />
        {perms.sales !== 'view' && (
          <Button className="sm:ml-auto" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Register request
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(t) => t.id}
        initialSort={{ key: 'due', dir: 'asc' }}
        columns={[
          { key: 'ref', header: 'Reference', sortValue: (t) => t.ref, render: (t) => (<span><span className="block font-mono text-xs text-slate-700">{t.ref}</span><Badge tone={t.type === 'Tender' ? 'brand' : t.type === 'RFQ' ? 'info' : 'purple'}>{t.type}</Badge></span>) },
          { key: 'title', header: 'Title', render: (t) => (<span><span className="block font-medium text-slate-900">{t.title}</span><span className="text-xs text-slate-500">{t.issuer}</span></span>) },
          {
            key: 'due',
            header: 'Due',
            sortValue: (t) => t.dueDate,
            render: (t) => {
              const days = Math.round((Date.parse(t.dueDate) - Date.parse(today)) / 86_400_000)
              const live = ['Received', 'Bid / no-bid', 'Preparing'].includes(t.status)
              return (<span className="whitespace-nowrap">{formatDate(t.dueDate)}{live && <span className={cn('block text-xs', days <= 7 ? 'font-medium text-rose-600' : 'text-slate-500')}>{days >= 0 ? `${days} days left` : `${-days} days ago`}</span>}</span>)
            },
          },
          { key: 'value', header: 'Est. value', align: 'right', sortValue: (t) => t.valueMinor, render: (t) => formatMoneyCompact(t.valueMinor), hideBelow: 'sm' },
          {
            key: 'status',
            header: 'Status',
            render: (t) =>
              canEdit(perms, t.ownerUserId) ? (
                <select aria-label={`Status of ${t.ref}`} value={t.status} onChange={(e) => run(() => commit((s) => setTenderStatus(s, t.id, e.target.value as Tender['status'])), { title: 'Status updated', description: t.ref })} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                  {TENDER_STATUSES.map((s) => (<option key={s}>{s}</option>))}
                </select>
              ) : (
                <StatusBadge status={t.status} />
              ),
          },
          { key: 'owner', header: 'Owner', render: (t) => ownerName(state, t.ownerUserId), hideBelow: 'lg' },
        ]}
      />
      <FormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="Register RFQ / tender / EOI"
        fields={[
          { name: 'type', label: 'Type', type: 'select', required: true, options: TENDER_TYPES },
          { name: 'issuer', label: 'Issuing organisation', required: true },
          { name: 'title', label: 'Title', required: true, full: true },
          { name: 'dueDate', label: 'Submission deadline', type: 'date', required: true },
          { name: 'value', label: 'Estimated value (₦)', type: 'money', required: true },
        ]}
        initial={{ type: 'RFQ', dueDate: addDays(today, 14) }}
        onSubmit={(v) => run(() => commit((s) => saveTender(s, { type: v.type as Tender['type'], issuer: v.issuer, title: v.title, dueDate: v.dueDate, valueMinor: formValue.money(v.value), receivedAt: today, status: 'Received', ownerUserId: perms.user.id })), { title: 'Request registered' })}
      />
    </>
  )
}

// ---------------- Forecast & win/loss ----------------

function ForecastTab() {
  const { state } = useData()
  const today = todayISO()
  const forecast = salesForecast(state.opportunities, 6, today).map((f) => ({ month: monthLabel(f.month), Weighted: toMajorForDisplay(f.weighted), 'Full value': toMajorForDisplay(f.total) }))
  const wl = winLoss(state.opportunities, addDays(today, -365))
  const reasons = [...new Set(wl.lost.map((o) => o.lossReason ?? 'Not recorded'))].map((r) => ({ reason: r, count: wl.lost.filter((o) => (o.lossReason ?? 'Not recorded') === r).length, value: sumMinor(wl.lost.filter((o) => (o.lossReason ?? 'Not recorded') === r).map((o) => o.valueMinor)) }))
  const owners = [...new Set(state.opportunities.map((o) => o.ownerUserId))].map((id) => {
    const mine = state.opportunities.filter((o) => o.ownerUserId === id)
    const w = winLoss(mine, addDays(today, -365))
    return { id, name: ownerName(state, id), open: pipelineValue(mine), won: w.wonValue, winRate: w.winRate, deals: w.won.length + w.lost.length }
  })
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Won value (12m)" value={formatMoneyCompact(wl.wonValue)} hint={`${wl.won.length} deals`} icon={<Trophy className="size-5" />} tone="emerald" />
        <StatCard label="Lost value (12m)" value={formatMoneyCompact(wl.lostValue)} hint={`${wl.lost.length} deals`} icon={<Target className="size-5" />} tone="rose" />
        <StatCard label="Win rate" value={`${Math.round(wl.winRate * 100)}%`} hint="by number of closed deals" icon={<Handshake className="size-5" />} tone="amber" />
      </div>
      <Card>
        <CardHeader title="Sales forecast — next 6 months" description="Open deals by expected close month; weighted = value × stage probability" />
        <CardBody>
          <div className="h-64" role="img" aria-label="Sales forecast chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactMoneyTick} width={64} />
                <Tooltip content={<ChartTooltip money />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Full value" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Weighted" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Why deals were lost" description="Last 12 months" />
          {reasons.length === 0 ? (
            <EmptyState title="No lost deals" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {reasons.map((r) => (
                <li key={r.reason} className="flex items-center justify-between px-5 py-3">
                  <span className="text-slate-700">{r.reason}</span>
                  <span className="tabular text-slate-500">{r.count} · {formatMoneyCompact(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="By salesperson" />
          <DataTable
            rows={owners}
            rowKey={(o) => o.id}
            pageSize={6}
            columns={[
              { key: 'n', header: 'Owner', render: (o) => o.name },
              { key: 'open', header: 'Open', align: 'right', render: (o) => formatMoneyCompact(o.open) },
              { key: 'won', header: 'Won (12m)', align: 'right', render: (o) => formatMoneyCompact(o.won) },
              { key: 'wr', header: 'Win rate', align: 'right', render: (o) => (o.deals ? `${Math.round(o.winRate * 100)}%` : '—') },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

// ---------------- Handover ----------------

function HandoverTab() {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [handing, setHanding] = useState<Opportunity | null>(null)
  const won = state.opportunities.filter((o) => o.stage === 'Won').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
  return (
    <>
      <div className="p-4 sm:px-5">
        <Notice>Sales hands each won deal to delivery with the signed scope and contacts. A delivery manager accepts it, which sets up the project; projects above ₦50m then wait for the CEO’s final approval.</Notice>
      </div>
      <DataTable
        rows={won}
        rowKey={(o) => o.id}
        columns={[
          { key: 'deal', header: 'Won deal', render: (o) => (<span><span className="block font-medium text-slate-900">{o.name}</span><span className="text-xs text-slate-500">{o.code} · {o.clientName}</span></span>) },
          { key: 'value', header: 'Value', align: 'right', render: (o) => formatMoneyCompact(o.valueMinor) },
          { key: 'closed', header: 'Won on', render: (o) => formatDate(o.closedAt), hideBelow: 'md' },
          { key: 'owner', header: 'Owner', render: (o) => ownerName(state, o.ownerUserId), hideBelow: 'lg' },
          {
            key: 'handover',
            header: 'Handover',
            render: (o) =>
              !o.handover ? (
                <Badge>Not handed over</Badge>
              ) : o.handover.status === 'Pending' ? (
                <span><StatusBadge status="Pending" /><span className="mt-0.5 block max-w-xs truncate text-xs text-slate-500" title={o.handover.notes}>{o.handover.notes}</span></span>
              ) : (
                <span><StatusBadge status="Accepted" /><span className="block text-xs text-slate-500">by {o.handover.acceptedBy}</span></span>
              ),
          },
          {
            key: 'a',
            header: '',
            align: 'right',
            render: (o) =>
              !o.handover && canEdit(perms, o.ownerUserId) ? (
                <Button size="sm" onClick={() => setHanding(o)}>Hand over</Button>
              ) : o.handover?.status === 'Pending' && perms.canManageProjects && perms.department?.code !== 'SBD' ? (
                <Button size="sm" variant="success" onClick={() => run(() => commit((s) => acceptHandover(s, o.id)), { title: 'Handover accepted', description: 'The project has been set up.' })}>
                  Accept & create project
                </Button>
              ) : null,
          },
        ]}
      />
      <FormModal
        open={!!handing}
        onClose={() => setHanding(null)}
        title="Hand over to delivery"
        description={handing ? `${handing.name} · ${handing.clientName}` : undefined}
        fields={[{ name: 'notes', label: 'Handover notes', type: 'textarea', required: true, min: 5, placeholder: 'Scope, signed documents, client contacts, special terms…' }]}
        submitLabel="Send to delivery"
        onSubmit={(v) => run(() => commit((s) => requestHandover(s, handing!.id, v.notes)), { title: 'Handed over', description: 'Projects & Delivery have been notified.' })}
      />
    </>
  )
}

// ---------------- Client invoices ----------------

function InvoicesTab() {
  const { state } = useData()
  const [status, setStatus] = useQueryState('status')
  const [q, setQ] = useQueryState('q')
  const rows = state.invoices.filter((i) => (!status || i.status === status) && includesText([i.number, i.customer.name], q))
  const outstanding = sumMinor(state.invoices.filter((i) => i.status === 'Sent' || i.status === 'Overdue').map(invoiceTotal))
  const overdue = state.invoices.filter((i) => i.status === 'Overdue')
  return (
    <>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <StatCard label="Outstanding" value={formatMoneyCompact(outstanding)} hint="sent and overdue invoices" icon={<Briefcase className="size-5" />} />
        <StatCard label="Overdue" value={formatMoneyCompact(sumMinor(overdue.map(invoiceTotal)))} hint={`${overdue.length} invoices — follow up with clients`} icon={<Target className="size-5" />} tone="rose" />
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search invoice or client…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={['Sent', 'Paid', 'Overdue', 'Draft']} allLabel="All statuses" />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(i) => i.id}
        resetKey={q + status}
        initialSort={{ key: 'issued', dir: 'desc' }}
        columns={[
          { key: 'n', header: 'Invoice', sortValue: (i) => i.number, render: (i) => <span className="font-mono text-xs">{i.number}</span> },
          { key: 'c', header: 'Client', sortValue: (i) => i.customer.name, render: (i) => i.customer.name },
          { key: 'issued', header: 'Issued', sortValue: (i) => i.issueDate, render: (i) => formatDate(i.issueDate), hideBelow: 'md' },
          { key: 'due', header: 'Due', sortValue: (i) => i.dueDate, render: (i) => formatDate(i.dueDate), hideBelow: 'sm' },
          { key: 'amt', header: 'Amount', align: 'right', sortValue: (i) => invoiceTotal(i), render: (i) => formatMoney(invoiceTotal(i)) },
          { key: 's', header: 'Payment status', render: (i) => (<span><StatusBadge status={i.status} />{i.paidDate && <span className="block text-xs text-slate-500">paid {formatDate(i.paidDate)}</span>}</span>) },
        ]}
      />
    </>
  )
}
