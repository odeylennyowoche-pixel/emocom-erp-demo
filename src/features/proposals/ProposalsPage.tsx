import { useNavigate } from 'react-router-dom'
import { FilePlus2 } from 'lucide-react'
import { useData } from '../../data/store'
import { proposalTotal } from '../../data/workSelectors'
import { useQueryState } from '../../hooks/useQueryState'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { PROPOSAL_STATUSES } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { ButtonLink } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/Progress'
import { visibleProposals } from '../auth/scopes'

export default function ProposalsPage() {
  const { state, perms } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState('status')
  const [mine, setMine] = useQueryState('mine', perms.proposals === 'self' ? '1' : '')
  const today = todayISO()
  const rows = visibleProposals(perms, state.proposals).filter((p) => (!status || p.status === status) && (!mine || p.ownerUserId === perms.user.id) && includesText([p.code, p.title, p.clientName], q))
  return (
    <>
      <PageHeader
        title={perms.proposals === 'self' ? 'My proposals & quotations' : 'Proposals & quotations'}
        description="Build proposals and quotations and track each one through its milestones to submission."
        actions={
          !perms.readOnly && (
            <ButtonLink to="/proposals/new" icon={<FilePlus2 className="size-4" />}>
              New proposal / quotation
            </ButtonLink>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search proposals…" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={PROPOSAL_STATUSES} allLabel="All statuses" />
          {perms.proposals !== 'self' && <FilterSelect label="Owner" value={mine} onChange={setMine} options={[{ value: '1', label: 'Mine only' }]} allLabel="Everyone" />}
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          resetKey={q + status + mine}
          onRowClick={(p) => navigate(`/proposals/${p.id}`)}
          rowLabel={(p) => `Open ${p.code}`}
          initialSort={{ key: 'due', dir: 'asc' }}
          empty={<EmptyState title="No proposals yet" description="Create a proposal or quotation to start tracking it." action={!perms.readOnly ? <ButtonLink size="sm" to="/proposals/new">New proposal</ButtonLink> : undefined} />}
          columns={[
            { key: 'code', header: 'Ref', sortValue: (p) => p.code, render: (p) => (<span><span className="block font-mono text-xs">{p.code}</span><Badge tone={p.kind === 'Proposal' ? 'purple' : 'info'}>{p.kind}</Badge></span>) },
            { key: 'title', header: 'Title', sortValue: (p) => p.title, render: (p) => (<span><span className="block font-medium text-slate-900">{p.title}</span><span className="text-xs text-slate-500">{p.clientName}</span></span>) },
            { key: 'total', header: 'Value', align: 'right', sortValue: (p) => proposalTotal(p), render: (p) => formatMoney(proposalTotal(p)), hideBelow: 'sm' },
            {
              key: 'progress',
              header: 'Milestones',
              render: (p) => {
                const done = p.milestones.filter((m) => m.done).length
                return (<span className="block w-28"><ProgressBar value={(done / p.milestones.length) * 100} label="Milestone progress" /><span className="text-xs text-slate-500">{done} of {p.milestones.length}</span></span>)
              },
              hideBelow: 'md',
            },
            { key: 'due', header: 'Due', sortValue: (p) => p.dueDate, render: (p) => <span className={p.dueDate < today && (p.status === 'Draft' || p.status === 'In review') ? 'font-medium text-rose-600' : ''}>{formatDate(p.dueDate)}</span> },
            { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <StatusBadge status={p.status} /> },
            { key: 'owner', header: 'Owner', render: (p) => state.users.find((u) => u.id === p.ownerUserId)?.name ?? '—', hideBelow: 'lg' },
          ]}
        />
      </Card>
    </>
  )
}
