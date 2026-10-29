import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Plus } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { addAsset, updateAsset } from '../../data/actions'
import { departmentName, employeeById, fullName } from '../../data/selectors'
import { useQueryState } from '../../hooks/useQueryState'
import { useAction } from '../../hooks/useAction'
import { downloadCsv } from '../../lib/csv'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, minorToInput, MONEY_INPUT_PATTERN, parseMoneyToMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import { ASSET_CATEGORIES, ASSET_STATUSES, WAREHOUSE_LOCATIONS, type Asset, type AssetCategory, type AssetStatus } from '../../types'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { StatusBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Form'

export function AssetsTab() {
  const { state, perms } = useData()
  const canManage = perms.inventory === 'manage'
  const [q, setQ] = useQueryState('q')
  const [category, setCategory] = useQueryState<AssetCategory | ''>('category')
  const [status, setStatus] = useQueryState<AssetStatus | ''>('status')
  const [editing, setEditing] = useState<Asset | 'new' | null>(null)

  const rows = useMemo(
    () =>
      state.assets.filter((a) => {
        const assignee = employeeById(state, a.assignedToId)
        return (!category || a.category === category) && (!status || a.status === status) && includesText([a.name, a.tag, a.serialNumber, assignee && fullName(assignee)], q)
      }),
    [state, category, status, q],
  )

  const columns: Column<Asset>[] = [
    {
      key: 'name',
      header: 'Asset',
      sortValue: (a) => a.name,
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{a.name}</p>
          <p className="font-mono text-xs text-slate-500">
            {a.tag} · {a.serialNumber}
          </p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortValue: (a) => a.category, render: (a) => a.category, hideBelow: 'md' },
    {
      key: 'assigned',
      header: 'Assigned to',
      sortValue: (a) => fullName(employeeById(state, a.assignedToId)),
      render: (a) => {
        const e = employeeById(state, a.assignedToId)
        return e ? fullName(e) : <span className="text-slate-400">{departmentName(state, a.departmentId)} (pool)</span>
      },
      hideBelow: 'sm',
    },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (a) => a.costMinor, render: (a) => formatMoney(a.costMinor), hideBelow: 'lg' },
    { key: 'purchased', header: 'Purchased', sortValue: (a) => a.purchaseDate, render: (a) => formatDate(a.purchaseDate), hideBelow: 'lg' },
    { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
  ]

  const exportCsv = () =>
    downloadCsv(`assets-${todayISO()}`, rows, [
      { header: 'Asset tag', value: (a) => a.tag },
      { header: 'Name', value: (a) => a.name },
      { header: 'Category', value: (a) => a.category },
      { header: 'Serial number', value: (a) => a.serialNumber },
      { header: 'Status', value: (a) => a.status },
      { header: 'Assigned to', value: (a) => fullName(employeeById(state, a.assignedToId)) },
      { header: 'Department', value: (a) => departmentName(state, a.departmentId) },
      { header: 'Purchase date', value: (a) => a.purchaseDate },
      { header: 'Cost', value: (a) => minorToInput(a.costMinor) },
      { header: 'Location', value: (a) => a.location },
    ])

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search tag, serial, assignee…" label="Search assets" />
        <FilterSelect label="Filter by asset category" value={category} onChange={setCategory} options={ASSET_CATEGORIES} allLabel="All categories" />
        <FilterSelect label="Filter by asset status" value={status} onChange={setStatus} options={ASSET_STATUSES} allLabel="All statuses" />
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
            Export
          </Button>
          {canManage && (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              Register asset
            </Button>
          )}
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(a) => a.id}
        rowLabel={(a) => `Edit asset ${a.tag}`}
        onRowClick={canManage ? (a) => setEditing(a) : undefined}
        initialSort={{ key: 'name', dir: 'asc' }}
        resetKey={`${q}|${category}|${status}`}
      />
      <AssetModal asset={editing} onClose={() => setEditing(null)} />
    </>
  )
}

const assetSchema = z
  .object({
    name: z.string().trim().min(3, 'Enter the asset name'),
    category: z.enum(ASSET_CATEGORIES),
    serialNumber: z.string().trim().min(4, 'Enter a serial number'),
    status: z.enum(ASSET_STATUSES),
    assignedToId: z.string(),
    departmentId: z.string().min(1, 'Select a department'),
    purchaseDate: z.string().min(1, 'Select a date').refine((d) => d <= todayISO(), 'Purchase date cannot be in the future'),
    cost: z.string().trim().regex(MONEY_INPUT_PATTERN, 'Enter an amount such as 1450000 or 1450000.50'),
    location: z.enum(WAREHOUSE_LOCATIONS),
  })
  .refine((v) => !(v.status === 'In Use' && !v.assignedToId && (v.category === 'Laptop' || v.category === 'Phone')), {
    path: ['assignedToId'],
    message: 'Laptops and phones in use must be assigned to an employee',
  })

type AssetForm = z.infer<typeof assetSchema>

function AssetModal({ asset, onClose }: { asset: Asset | 'new' | null; onClose: () => void }) {
  const { state, commit, commitWith } = useData()
  const run = useAction()
  const existing = asset && asset !== 'new' ? asset : undefined
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetForm>({ resolver: zodResolver(assetSchema) })

  useEffect(() => {
    if (!asset) return
    reset(
      existing
        ? { ...existing, assignedToId: existing.assignedToId ?? '', cost: minorToInput(existing.costMinor) }
        : { name: '', category: 'Laptop', serialNumber: '', status: 'In Storage', assignedToId: '', departmentId: '', purchaseDate: todayISO(), cost: '', location: 'Lekki HQ Store' },
    )
  }, [asset, existing, reset])

  const onSubmit = (v: AssetForm) => {
    const input = {
      name: v.name,
      category: v.category,
      serialNumber: v.serialNumber.toUpperCase(),
      status: v.status,
      assignedToId: v.assignedToId || undefined,
      departmentId: v.departmentId,
      purchaseDate: v.purchaseDate,
      costMinor: parseMoneyToMinor(v.cost) ?? 0,
      location: v.location,
    }
    const ok = existing
      ? run(() => commit((s) => updateAsset(s, existing.id, input)), { title: 'Asset updated', description: existing.tag })
      : run(() => void commitWith((s) => addAsset(s, input)), { title: 'Asset registered', description: input.name })
    if (ok) onClose()
  }

  const employees = state.employees.filter((e) => e.status !== 'Inactive')

  return (
    <Modal
      open={asset !== null}
      onClose={onClose}
      title={existing ? `Edit asset ${existing.tag}` : 'Register asset'}
      description="Equipment such as laptops, monitors, vehicles and furniture."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="asset-form">
            {existing ? 'Save changes' : 'Register asset'}
          </Button>
        </>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset name" required error={errors.name?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="Category" required>
          {(id) => (
            <Select id={id} {...register('category')}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Serial number" required error={errors.serialNumber?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.serialNumber} {...register('serialNumber')} />}
        </Field>
        <Field label="Status" required>
          {(id) => (
            <Select id={id} {...register('status')}>
              {ASSET_STATUSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Assigned to" error={errors.assignedToId?.message}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} invalid={!!errors.assignedToId} {...register('assignedToId')}>
              <option value="">Unassigned (department pool)</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e)} — {departmentName(state, e.departmentId)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Department" required error={errors.departmentId?.message}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} invalid={!!errors.departmentId} {...register('departmentId')}>
              <option value="">Select department…</option>
              {state.departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Location" required>
          {(id) => (
            <Select id={id} {...register('location')}>
              {WAREHOUSE_LOCATIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Purchase date" required error={errors.purchaseDate?.message}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} invalid={!!errors.purchaseDate} {...register('purchaseDate')} />}
        </Field>
        <Field label={`Purchase cost (${APP_CONFIG.currency})`} required error={errors.cost?.message}>
          {(id, d) => <Input id={id} inputMode="decimal" placeholder="0.00" aria-describedby={d} invalid={!!errors.cost} {...register('cost')} />}
        </Field>
      </form>
    </Modal>
  )
}
