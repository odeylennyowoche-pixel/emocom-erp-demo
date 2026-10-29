import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, Pencil, Plus, Printer, Send, Trash2 } from 'lucide-react'
import { useData } from '../../data/store'
import { saveProposal, setProposalStatus, toggleProposalMilestone } from '../../data/workActions'
import { proposalTotal } from '../../data/workSelectors'
import { useAction } from '../../hooks/useAction'
import { addDays, formatDate, todayISO } from '../../lib/dates'
import { formatMoney, lineTotal, minorToInput, parseMoneyToMinor } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { Proposal, ProposalStatus } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Notice, ProgressBar } from '../../components/ui/Progress'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'
import { visibleProposals } from './ProposalsPage'

interface LineDraft {
  id: string
  description: string
  quantity: string
  price: string
}

export default function ProposalDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { state, perms } = useData()
  const isNew = id === 'new'
  const proposal = state.proposals.find((p) => p.id === id)
  if (isNew) return perms.readOnly ? <AccessDenied /> : <ProposalEditor />
  if (!proposal) return <NotFoundPage title="Proposal not found" message="It may have been removed." />
  if (!visibleProposals(perms, [proposal]).length) return <AccessDenied message="This proposal belongs to someone else." />
  return params.get('edit') ? <ProposalEditor proposal={proposal} /> : <ProposalView proposal={proposal} />
}

function canEditProposal(perms: ReturnType<typeof useData>['perms'], p: Proposal) {
  return p.ownerUserId === perms.user.id || (p.departmentId === perms.user.departmentId && (perms.role === 'Manager' || perms.sales === 'manage'))
}

function ProposalView({ proposal: p }: { proposal: Proposal }) {
  const { state, perms, commit } = useData()
  const run = useAction()
  const editable = canEditProposal(perms, p)
  const done = p.milestones.filter((m) => m.done).length
  const today = todayISO()
  const next: Partial<Record<ProposalStatus, Array<{ to: ProposalStatus; label: string; variant: 'primary' | 'secondary' | 'success' | 'danger' }>>> = {
    Draft: [{ to: 'In review', label: 'Send for internal review', variant: 'primary' }],
    'In review': [
      { to: 'Draft', label: 'Back to draft', variant: 'secondary' },
      { to: 'Submitted', label: 'Mark submitted to client', variant: 'primary' },
    ],
    Submitted: [
      { to: 'Declined', label: 'Client declined', variant: 'secondary' },
      { to: 'Accepted', label: 'Client accepted', variant: 'success' },
    ],
  }
  const opp = state.opportunities.find((o) => o.id === p.opportunityId)
  return (
    <>
      <PageHeader
        title={p.title}
        meta={<StatusBadge status={p.status} />}
        description={`${p.code} · ${p.kind} for ${p.clientName}`}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
            {editable && (p.status === 'Draft' || p.status === 'In review') && (
              <ButtonLink variant="secondary" to={`/proposals/${p.id}?edit=1`} icon={<Pencil className="size-4" />}>
                Edit
              </ButtonLink>
            )}
            {editable &&
              next[p.status]?.map((a) => (
                <Button key={a.to} variant={a.variant} icon={a.to === 'Submitted' ? <Send className="size-4" /> : undefined} onClick={() => run(() => commit((s) => setProposalStatus(s, p.id, a.to)), { title: `Marked ${a.to.toLowerCase()}`, description: p.code })}>
                  {a.label}
                </Button>
              ))}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Line items" description="Prices exclude VAT" />
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
                {p.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3 text-slate-800">{l.description}</td>
                    <td className="tabular px-4 py-3 text-right">{l.quantity}</td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(l.unitPriceMinor)}</td>
                    <td className="tabular px-5 py-3 text-right font-medium">{formatMoney(lineTotal(l.quantity, l.unitPriceMinor))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="px-5 py-3 text-right font-semibold text-slate-700">Total (excl. VAT)</td>
                  <td className="tabular px-5 py-3 text-right text-base font-semibold text-slate-900">{formatMoney(proposalTotal(p))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <CardBody className="border-t border-slate-100">
            <DetailList
              columns={3}
              items={[
                { label: 'Owner', value: state.users.find((u) => u.id === p.ownerUserId)?.name ?? '—' },
                { label: 'Due to client', value: formatDate(p.dueDate) },
                { label: 'Validity', value: `${p.validityDays} days` },
                { label: 'Created', value: formatDate(p.createdAt) },
                { label: 'Opportunity', value: opp ? `${opp.code} · ${opp.stage}` : '—' },
                { label: 'Notes', value: p.notes || '—' },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Milestone tracker" description={`${done} of ${p.milestones.length} complete`} />
          <CardBody>
            <ProgressBar value={(done / p.milestones.length) * 100} label="Milestones complete" />
            <ol className="mt-4 space-y-1">
              {p.milestones.map((m) => {
                const late = !m.done && m.dueDate < today
                const toggle = editable && (p.status === 'Draft' || p.status === 'In review')
                return (
                  <li key={m.id}>
                    <button
                      disabled={!toggle}
                      onClick={() => run(() => commit((s) => toggleProposalMilestone(s, p.id, m.id)))}
                      className={cn('flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm', toggle && 'hover:bg-slate-50')}
                      aria-label={`${m.name}: ${m.done ? 'done' : 'not done'}`}
                    >
                      {m.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className={cn('mt-0.5 size-5 shrink-0', late ? 'text-rose-500' : 'text-slate-300')} />}
                      <span className="min-w-0">
                        <span className={cn('block font-medium', m.done ? 'text-slate-500 line-through' : 'text-slate-800')}>{m.name}</span>
                        <span className={cn('text-xs', late ? 'font-medium text-rose-600' : 'text-slate-500')}>{m.done ? `Done ${formatDate(m.doneAt)}` : `Due ${formatDate(m.dueDate)}${late ? ' · overdue' : ''}`}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            {editable && (p.status === 'Draft' || p.status === 'In review') && <p className="mt-3 text-xs text-slate-500">Tick each milestone as it is completed.</p>}
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 text-sm">
        <Link to="/proposals" className="text-brand-700 hover:underline">
          ← All proposals
        </Link>
      </p>
    </>
  )
}

function ProposalEditor({ proposal }: { proposal?: Proposal }) {
  const { state, perms, commitWith } = useData()
  const run = useAction()
  const navigate = useNavigate()
  const today = todayISO()
  const [kind, setKind] = useState<Proposal['kind']>(proposal?.kind ?? 'Quotation')
  const [title, setTitle] = useState(proposal?.title ?? '')
  const [client, setClient] = useState(proposal?.clientName ?? '')
  const [oppId, setOppId] = useState(proposal?.opportunityId ?? '')
  const [due, setDue] = useState(proposal?.dueDate ?? addDays(today, 10))
  const [validity, setValidity] = useState(String(proposal?.validityDays ?? 30))
  const [notes, setNotes] = useState(proposal?.notes ?? 'Prices exclude VAT. Delivery 4–6 weeks from purchase order.')
  const [lines, setLines] = useState<LineDraft[]>(
    proposal?.lines.map((l) => ({ id: l.id, description: l.description, quantity: String(l.quantity), price: minorToInput(l.unitPriceMinor) })) ?? [{ id: 'l1', description: '', quantity: '1', price: '' }],
  )
  const [errors, setErrors] = useState<string[]>([])
  const opps = state.opportunities.filter((o) => ['Needs analysis', 'Proposal', 'Negotiation'].includes(o.stage))
  const total = lines.reduce((s, l) => s + lineTotal(Number(l.quantity) || 0, parseMoneyToMinor(l.price) ?? 0), 0)

  const save = () => {
    const errs: string[] = []
    if (title.trim().length < 3) errs.push('Enter a title.')
    if (client.trim().length < 2) errs.push('Enter the client.')
    if (!due) errs.push('Choose a due date.')
    const parsed = lines.map((l) => ({ id: l.id, description: l.description.trim(), quantity: Math.round(Number(l.quantity)), unitPriceMinor: parseMoneyToMinor(l.price) }))
    if (parsed.some((l) => !l.description || !(l.quantity > 0) || l.unitPriceMinor === null)) errs.push('Every line needs a description, a quantity of at least 1 and a valid price.')
    setErrors(errs)
    if (errs.length) return
    let createdId = proposal?.id
    const ok = run(
      () => {
        const rec = commitWith((s) =>
          saveProposal(
            s,
            { kind, title: title.trim(), clientName: client.trim(), opportunityId: oppId || undefined, dueDate: due, validityDays: Number(validity) || 30, notes: notes.trim(), lines: parsed.map((l) => ({ ...l, unitPriceMinor: l.unitPriceMinor! })) },
            proposal?.id,
          ),
        )
        createdId = rec.id
      },
      { title: proposal ? 'Proposal saved' : `${kind} created` },
    )
    if (ok && createdId) navigate(`/proposals/${createdId}`)
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  return (
    <>
      <PageHeader title={proposal ? `Edit ${proposal.code}` : 'New proposal / quotation'} description={`Owner: ${perms.user.name}`} />
      {errors.length > 0 && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type" required>
            {(fid) => (
              <Select id={fid} value={kind} onChange={(e) => setKind(e.target.value as Proposal['kind'])} disabled={!!proposal}>
                <option>Quotation</option>
                <option>Proposal</option>
              </Select>
            )}
          </Field>
          <Field label="Title" required className="lg:col-span-2">
            {(fid) => <Input id={fid} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Branch firewall upgrade" />}
          </Field>
          <Field label="Client" required>
            {(fid) => <Input id={fid} value={client} onChange={(e) => setClient(e.target.value)} list="proposal-clients" />}
          </Field>
          <datalist id="proposal-clients">
            {[...new Set([...state.invoices.map((i) => i.customer.name), ...state.leads.map((l) => l.company)])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field label="Linked opportunity">
            {(fid) => (
              <Select
                id={fid}
                value={oppId}
                onChange={(e) => {
                  setOppId(e.target.value)
                  const o = state.opportunities.find((x) => x.id === e.target.value)
                  if (o && !client) setClient(o.clientName)
                }}
              >
                <option value="">None</option>
                {opps.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Due to client" required>
            {(fid) => <Input id={fid} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}
          </Field>
          <Field label="Validity (days)">
            {(fid) => <Input id={fid} type="number" min={7} value={validity} onChange={(e) => setValidity(e.target.value)} />}
          </Field>
          <Field label="Notes / terms" className="sm:col-span-2">
            {(fid) => <Textarea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Line items" actions={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setLines((ls) => [...ls, { id: `l${Date.now()}`, description: '', quantity: '1', price: '' }])}>Add line</Button>} />
        <CardBody className="space-y-3">
          {lines.map((l, i) => (
            <div key={l.id} className="grid gap-2 sm:grid-cols-[1fr_6rem_10rem_9rem_2.5rem] sm:items-end">
              <Field label={i === 0 ? 'Description' : ' '}>{(fid) => <Input id={fid} aria-label={`Line ${i + 1} description`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />}</Field>
              <Field label={i === 0 ? 'Qty' : ' '}>{(fid) => <Input id={fid} aria-label={`Line ${i + 1} quantity`} type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />}</Field>
              <Field label={i === 0 ? 'Unit price (₦)' : ' '}>{(fid) => <Input id={fid} aria-label={`Line ${i + 1} unit price`} inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />}</Field>
              <p className="tabular pb-2 text-right text-sm font-medium text-slate-800">{formatMoney(lineTotal(Number(l.quantity) || 0, parseMoneyToMinor(l.price) ?? 0))}</p>
              <Button size="sm" variant="ghost" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex justify-end border-t border-slate-100 pt-3 text-sm">
            <span className="mr-4 text-slate-500">Total (excl. VAT)</span>
            <span className="tabular text-base font-semibold text-slate-900">{formatMoney(total)}</span>
          </div>
          {!proposal && <Notice>Saving creates the standard milestone tracker: requirements → solution design → pricing → internal review → submitted.</Notice>}
        </CardBody>
      </Card>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(proposal ? `/proposals/${proposal.id}` : '/proposals')}>
          Cancel
        </Button>
        <Button onClick={save}>{proposal ? 'Save changes' : 'Create'}</Button>
      </div>
    </>
  )
}
