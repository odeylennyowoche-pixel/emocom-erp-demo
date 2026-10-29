import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Minus, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../../data/store'
import { deleteItem } from '../../data/actions'
import { itemValue, prTotal, stockStatus, supplierName } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { StockMovementType } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { AXIS_PROPS, ChartTooltip } from '../../components/charts/chartKit'
import { NotFoundPage } from '../../app/RouteError'
import { StockAdjustModal } from './StockAdjustModal'
import { visibleRequests } from '../auth/permissions'

export default function ItemDetailPage() {
  const { id } = useParams()
  const { state, perms, commit } = useData()
  const canManage = perms.inventory === 'manage'
  const navigate = useNavigate()
  const run = useAction()
  const [movementType, setMovementType] = useState<StockMovementType | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const item = state.inventory.find((i) => i.id === id)

  const movements = useMemo(
    () => state.stockMovements.filter((m) => m.itemId === id).sort((a, b) => a.date.localeCompare(b.date) || a.balanceAfter - b.balanceAfter),
    [state.stockMovements, id],
  )
  const relatedRequests = useMemo(() => visibleRequests(perms, state.purchaseRequests).filter((p) => p.lines.some((l) => l.inventoryItemId === id)), [perms, state.purchaseRequests, id])

  if (!item) return <NotFoundPage title="Item not found" message="This inventory item does not exist or was deleted." />
  const status = stockStatus(item)
  const chartData = movements.map((m) => ({ date: formatDate(m.date), Balance: m.balanceAfter }))

  return (
    <>
      <PageHeader
        title={item.name}
        meta={<StatusBadge status={status} />}
        description={`${item.code} · ${item.category} · ${item.location}`}
        actions={
          <>
            {canManage && (
              <>
                <Button variant="secondary" icon={<Trash2 className="size-4 text-rose-600" />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
                <ButtonLink variant="secondary" to={`/inventory/items/${item.id}/edit`} icon={<Pencil className="size-4" />}>
                  Edit
                </ButtonLink>
              </>
            )}
            <ButtonLink to={`/procurement/requests/new?item=${item.id}`} icon={<ShoppingCart className="size-4" />}>
              Request restock
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Stock level" />
          <CardBody>
            <p className="tabular text-4xl font-semibold tracking-tight text-slate-900">
              {item.quantity.toLocaleString()} <span className="text-base font-normal text-slate-500">{item.unit}(s)</span>
            </p>
            <div className="mt-3 h-2 rounded-full bg-slate-100" aria-hidden>
              <div
                className={status === 'In Stock' ? 'h-2 rounded-full bg-emerald-500' : status === 'Low Stock' ? 'h-2 rounded-full bg-amber-500' : 'h-2 rounded-full bg-rose-500'}
                style={{ width: `${Math.min(100, (item.quantity / Math.max(1, item.reorderLevel * 3)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">Reorder level: {item.reorderLevel.toLocaleString()}</p>
            {canManage ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Button size="sm" variant="success" icon={<Plus className="size-4" />} onClick={() => setMovementType('Receipt')}>
                Receive
              </Button>
              <Button size="sm" variant="secondary" icon={<Minus className="size-4" />} onClick={() => setMovementType('Issue')} disabled={item.quantity === 0}>
                Issue
              </Button>
              <Button size="sm" variant="secondary" icon={<ClipboardList className="size-4" />} onClick={() => setMovementType('Adjustment')}>
                Count
              </Button>
            </div>
            ) : (
              <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Stock changes are recorded by Procurement & Logistics.</p>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Item information" />
          <CardBody>
            <DetailList
              columns={3}
              items={[
                { label: 'Item code', value: <span className="font-mono">{item.code}</span> },
                { label: 'Category', value: item.category },
                { label: 'Unit', value: item.unit },
                { label: 'Unit cost', value: formatMoney(item.unitCostMinor) },
                { label: 'Stock value', value: formatMoney(itemValue(item)) },
                { label: 'Location', value: item.location },
                { label: 'Preferred supplier', value: supplierName(state, item.preferredSupplierId) },
                { label: 'Last updated', value: formatDateTime(item.updatedAt) },
                { label: 'Movements recorded', value: movements.length },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Stock balance over time" description="Balance after each recorded movement" />
        <CardBody>
          {chartData.length < 2 ? (
            <EmptyState title="Not enough history to chart" description="Record receipts or issues to build up history." />
          ) : (
            <div className="h-56" role="img" aria-label="Stock balance over time">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-500)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--brand-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="date" {...AXIS_PROPS} minTickGap={24} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={item.reorderLevel} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Reorder level', fill: '#b45309', fontSize: 11, position: 'insideTopRight' }} />
                  <Area type="stepAfter" dataKey="Balance" stroke="var(--brand-600)" strokeWidth={2} fill="url(#stockFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Stock movement history" />
          <DataTable
            rows={[...movements].reverse()}
            rowKey={(m) => m.id}
            pageSize={8}
            columns={[
              { key: 'date', header: 'Date', render: (m) => <span className="whitespace-nowrap">{formatDate(m.date)}</span> },
              { key: 'type', header: 'Type', render: (m) => <StatusBadge status={m.type} /> },
              {
                key: 'change',
                header: 'Change',
                align: 'right',
                render: (m) => <span className={m.quantityChange > 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</span>,
              },
              { key: 'bal', header: 'Balance', align: 'right', render: (m) => m.balanceAfter.toLocaleString() },
              { key: 'ref', header: 'Reference', render: (m) => <span className="font-mono text-xs">{m.reference}</span>, hideBelow: 'sm' },
              { key: 'note', header: 'Note', render: (m) => <span className="text-slate-500">{m.note ?? '—'}</span>, hideBelow: 'lg' },
            ]}
            empty={<EmptyState title="No movements recorded" />}
          />
        </Card>
        <Card>
          <CardHeader title="Purchase requests" description="Requests that include this item" />
          {relatedRequests.length === 0 ? (
            <EmptyState title="No requests yet" action={<ButtonLink size="sm" to={`/procurement/requests/new?item=${item.id}`}>Request restock</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {relatedRequests.map((p) => (
                <li key={p.id}>
                  <Link to={`/procurement/requests/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{p.code}</span>
                      <span className="block text-xs text-slate-500">
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
      </div>

      <StockAdjustModal item={item} type={movementType} onClose={() => setMovementType(null)} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete inventory item?"
        tone="danger"
        confirmLabel="Delete item"
        message={
          relatedRequests.length > 0 ? (
            <>This item appears on {relatedRequests.length} purchase request(s) and cannot be deleted. Set its reorder level to 0 to retire it instead.</>
          ) : (
            <>This removes {item.name} and its movement history from the demo. This cannot be undone (except by resetting demo data).</>
          )
        }
        onConfirm={() => {
          const ok = run(() => commit((s) => deleteItem(s, item.id)), { title: 'Item deleted', description: item.name })
          setConfirmDelete(false)
          if (ok) navigate('/inventory')
        }}
      />
    </>
  )
}
