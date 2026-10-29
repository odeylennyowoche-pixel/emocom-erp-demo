import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, Download, PackageCheck, PackageX, Plus, Wallet } from 'lucide-react'
import { useData } from '../../data/store'
import { inventoryAlerts, itemValue, stockStatus, supplierName } from '../../data/selectors'
import { useQueryState, useTabParam } from '../../hooks/useQueryState'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, minorToInput, sumMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { INVENTORY_CATEGORIES, WAREHOUSE_LOCATIONS, type InventoryCategory, type InventoryItem, type StockMovementType, type WarehouseLocation } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { AssetsTab } from './AssetsTab'

type TabKey = 'items' | 'assets' | 'movements'
type StockFilter = '' | 'alerts' | 'In Stock' | 'Low Stock' | 'Out of Stock'

export default function InventoryPage() {
  const { state, perms } = useData()
  const [tab, setTab] = useTabParam<TabKey>('items')
  const alerts = inventoryAlerts(state.inventory)

  return (
    <>
      <PageHeader
        title="Inventory & assets"
        description={perms.inventory === 'manage' ? 'Stock levels across stores, equipment register and stock movement history.' : 'Check stock availability and equipment. Procurement & Logistics manages changes.'}
        actions={
          tab === 'items' && perms.inventory === 'manage' ? (
            <ButtonLink to="/inventory/items/new" icon={<Plus className="size-4" />}>
              Add item
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Stock lines" value={state.inventory.length} icon={<Boxes className="size-5" />} hint={`${INVENTORY_CATEGORIES.length} categories`} />
        <StatCard label="Inventory value" value={formatMoneyCompact(sumMinor(state.inventory.map(itemValue)))} icon={<Wallet className="size-5" />} hint="at unit cost" tone="purple" />
        <StatCard label="Low stock" value={alerts.filter((i) => stockStatus(i) === 'Low Stock').length} icon={<AlertTriangle className="size-5" />} hint="at or below reorder level" tone="amber" />
        <StatCard label="Out of stock" value={alerts.filter((i) => stockStatus(i) === 'Out of Stock').length} icon={<PackageX className="size-5" />} hint="needs replenishment" tone="rose" />
      </div>
      <Card>
        <div className="px-4 pt-1">
          <Tabs
            label="Inventory sections"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'items', label: 'Stock items', count: state.inventory.length },
              { key: 'assets', label: 'Assets', count: state.assets.length },
              { key: 'movements', label: 'Stock movements', count: state.stockMovements.length },
            ]}
          />
        </div>
        {tab === 'items' && <ItemsTab />}
        {tab === 'assets' && <AssetsTab />}
        {tab === 'movements' && <MovementsTab />}
      </Card>
    </>
  )
}

function ItemsTab() {
  const { state } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('q')
  const [category, setCategory] = useQueryState<InventoryCategory | ''>('category')
  const [location, setLocation] = useQueryState<WarehouseLocation | ''>('location')
  const [stock, setStock] = useQueryState<StockFilter>('stock')

  const rows = useMemo(
    () =>
      state.inventory.filter((i) => {
        const s = stockStatus(i)
        return (
          (!category || i.category === category) &&
          (!location || i.location === location) &&
          (!stock || (stock === 'alerts' ? s !== 'In Stock' : s === stock)) &&
          includesText([i.name, i.code, i.category], q)
        )
      }),
    [state.inventory, category, location, stock, q],
  )

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Item',
      sortValue: (i) => i.name,
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{i.name}</p>
          <p className="font-mono text-xs text-slate-500">{i.code}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortValue: (i) => i.category, render: (i) => i.category, hideBelow: 'md' },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (i) => i.quantity,
      render: (i) => (
        <span>
          <span className="font-medium text-slate-900">{i.quantity.toLocaleString()}</span> <span className="text-xs text-slate-500">{i.unit}</span>
        </span>
      ),
    },
    { key: 'cost', header: 'Unit cost', align: 'right', sortValue: (i) => i.unitCostMinor, render: (i) => formatMoney(i.unitCostMinor), hideBelow: 'lg' },
    { key: 'value', header: 'Value', align: 'right', sortValue: (i) => itemValue(i), render: (i) => formatMoney(itemValue(i)), hideBelow: 'lg' },
    { key: 'location', header: 'Location', sortValue: (i) => i.location, render: (i) => i.location, hideBelow: 'md' },
    { key: 'status', header: 'Status', sortValue: (i) => stockStatus(i), render: (i) => <StatusBadge status={stockStatus(i)} /> },
  ]

  const exportCsv = () =>
    downloadCsv(`inventory-${todayISO()}`, rows, [
      { header: 'Item code', value: (i) => i.code },
      { header: 'Name', value: (i) => i.name },
      { header: 'Category', value: (i) => i.category },
      { header: 'Quantity', value: (i) => i.quantity },
      { header: 'Unit', value: (i) => i.unit },
      { header: 'Reorder level', value: (i) => i.reorderLevel },
      { header: 'Unit cost', value: (i) => minorToInput(i.unitCostMinor) },
      { header: 'Stock value', value: (i) => minorToInput(itemValue(i)) },
      { header: 'Location', value: (i) => i.location },
      { header: 'Preferred supplier', value: (i) => supplierName(state, i.preferredSupplierId) },
      { header: 'Status', value: (i) => stockStatus(i) },
    ])

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search item name or code…" label="Search inventory" />
        <FilterSelect label="Filter by category" value={category} onChange={setCategory} options={INVENTORY_CATEGORIES} allLabel="All categories" />
        <FilterSelect label="Filter by location" value={location} onChange={setLocation} options={WAREHOUSE_LOCATIONS} allLabel="All locations" />
        <FilterSelect
          label="Filter by stock status"
          value={stock}
          onChange={setStock}
          options={[
            { value: 'alerts', label: 'Alerts (low + out)' },
            { value: 'In Stock', label: 'In stock' },
            { value: 'Low Stock', label: 'Low stock' },
            { value: 'Out of Stock', label: 'Out of stock' },
          ]}
          allLabel="All stock levels"
        />
        <Button variant="secondary" size="sm" className="sm:ml-auto" icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        rowLabel={(i) => `Open ${i.name}`}
        onRowClick={(i) => navigate(`/inventory/items/${i.id}`)}
        initialSort={{ key: 'name', dir: 'asc' }}
        resetKey={`${q}|${category}|${location}|${stock}`}
      />
    </>
  )
}

function MovementsTab() {
  const { state } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useQueryState('mq')
  const [type, setType] = useQueryState<StockMovementType | ''>('mtype')
  const itemsById = useMemo(() => new Map(state.inventory.map((i) => [i.id, i])), [state.inventory])
  const rows = useMemo(
    () =>
      [...state.stockMovements]
        .filter((m) => (!type || m.type === type) && includesText([itemsById.get(m.itemId)?.name, m.reference, m.note, m.performedBy], q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.stockMovements, type, q, itemsById],
  )
  type Row = (typeof rows)[number]
  const columns: Column<Row>[] = [
    { key: 'date', header: 'Date', sortValue: (m) => m.date, render: (m) => <span className="whitespace-nowrap">{formatDate(m.date)}</span> },
    { key: 'item', header: 'Item', sortValue: (m) => itemsById.get(m.itemId)?.name ?? '', render: (m) => <span className="font-medium text-slate-800">{itemsById.get(m.itemId)?.name ?? 'Deleted item'}</span> },
    { key: 'type', header: 'Type', sortValue: (m) => m.type, render: (m) => <StatusBadge status={m.type} /> },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      sortValue: (m) => m.quantityChange,
      render: (m) => <span className={m.quantityChange > 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</span>,
    },
    { key: 'balance', header: 'Balance', align: 'right', sortValue: (m) => m.balanceAfter, render: (m) => m.balanceAfter.toLocaleString(), hideBelow: 'sm' },
    { key: 'ref', header: 'Reference', render: (m) => <span className="font-mono text-xs">{m.reference}</span>, hideBelow: 'md' },
    { key: 'by', header: 'By', render: (m) => m.performedBy, hideBelow: 'lg' },
  ]
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search item, reference, note…" label="Search stock movements" />
        <FilterSelect label="Filter by movement type" value={type} onChange={setType} options={['Receipt', 'Issue', 'Adjustment'] as const} allLabel="All movement types" />
        <span className="text-xs text-slate-500 sm:ml-auto">
          <PackageCheck className="mr-1 inline size-3.5" />
          Receipts from approved purchase requests appear here automatically.
        </span>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        rowLabel={(m) => `Open item for movement ${m.reference}`}
        onRowClick={(m) => itemsById.has(m.itemId) && navigate(`/inventory/items/${m.itemId}`)}
        initialSort={{ key: 'date', dir: 'desc' }}
        resetKey={`${q}|${type}`}
      />
    </>
  )
}
