import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Star } from 'lucide-react'
import { useData } from '../../data/store'
import { addSupplier, updateSupplier } from '../../data/actions'
import { prTotal } from '../../data/selectors'
import { useQueryState } from '../../hooks/useQueryState'
import { useAction } from '../../hooks/useAction'
import { formatMoney, sumMinor } from '../../lib/money'
import { includesText } from '../../lib/utils'
import type { Supplier } from '../../types'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterSelect, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Checkbox, Field, Input, Select } from '../../components/ui/Form'

export function SuppliersTab() {
  const { state, perms } = useData()
  const canManage = perms.canManageSuppliers
  const [q, setQ] = useQueryState('q')
  const [category, setCategory] = useQueryState('category')
  const [active, setActive] = useQueryState<'active' | 'inactive' | ''>('active')
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  const categories = useMemo(() => [...new Set(state.suppliers.map((s) => s.category))].sort(), [state.suppliers])
  const stats = useMemo(() => {
    const m = new Map<string, { spend: number; open: number }>()
    for (const s of state.suppliers) m.set(s.id, { spend: 0, open: 0 })
    for (const p of state.purchaseRequests) {
      const entry = m.get(p.supplierId)
      if (!entry) continue
      if (p.status === 'Received') entry.spend += prTotal(p)
      if (p.status === 'Pending Approval' || p.status === 'Approved') entry.open++
    }
    return m
  }, [state.suppliers, state.purchaseRequests])

  const rows = state.suppliers.filter(
    (s) => (!category || s.category === category) && (!active || (active === 'active') === s.active) && includesText([s.name, s.code, s.contactName, s.email, s.city], q),
  )

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortValue: (s) => s.name,
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{s.name}</p>
          <p className="font-mono text-xs text-slate-500">{s.code}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortValue: (s) => s.category, render: (s) => s.category, hideBelow: 'md' },
    {
      key: 'contact',
      header: 'Contact',
      render: (s) => (
        <div className="min-w-0 text-sm">
          <p className="truncate text-slate-800">{s.contactName}</p>
          <p className="truncate text-xs text-slate-500">{s.email}</p>
        </div>
      ),
      hideBelow: 'lg',
    },
    { key: 'city', header: 'City', sortValue: (s) => s.city, render: (s) => s.city, hideBelow: 'lg' },
    {
      key: 'rating',
      header: 'Rating',
      sortValue: (s) => s.rating,
      render: (s) => (
        <span className="inline-flex items-center gap-0.5" aria-label={`${s.rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={i < s.rating ? 'size-3.5 fill-amber-400 text-amber-400' : 'size-3.5 text-slate-200'} aria-hidden />
          ))}
        </span>
      ),
      hideBelow: 'sm',
    },
    { key: 'open', header: 'Open POs', align: 'right', sortValue: (s) => stats.get(s.id)?.open ?? 0, render: (s) => stats.get(s.id)?.open ?? 0, hideBelow: 'md' },
    { key: 'spend', header: 'Received spend', align: 'right', sortValue: (s) => stats.get(s.id)?.spend ?? 0, render: (s) => formatMoney(stats.get(s.id)?.spend ?? 0) },
    { key: 'active', header: 'Status', render: (s) => (s.active ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>) },
  ]

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search supplier, contact, city…" label="Search suppliers" />
        <FilterSelect label="Filter by supplier category" value={category} onChange={setCategory} options={categories} allLabel="All categories" />
        <FilterSelect
          label="Filter by supplier status"
          value={active}
          onChange={setActive}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          allLabel="Active & inactive"
        />
        <span className="hidden text-xs text-slate-500 lg:inline">
          Total received spend: <strong className="text-slate-700">{formatMoney(sumMinor([...stats.values()].map((s) => s.spend)))}</strong>
        </span>
        {canManage && (
          <Button size="sm" className="sm:ml-auto" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Add supplier
          </Button>
        )}
      </Toolbar>
      <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} rowLabel={(s) => `Edit ${s.name}`} onRowClick={canManage ? (s) => setEditing(s) : undefined} initialSort={{ key: 'name', dir: 'asc' }} resetKey={`${q}|${category}|${active}`} />
      <SupplierModal supplier={editing} categories={categories} onClose={() => setEditing(null)} />
    </>
  )
}

const supplierSchema = z.object({
  name: z.string().trim().min(3, 'Enter the supplier name').max(80),
  category: z.string().trim().min(2, 'Enter a category'),
  contactName: z.string().trim().min(3, 'Enter a contact person'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number'),
  city: z.string().trim().min(2, 'Enter a city'),
  rating: z.string().regex(/^[1-5]$/),
  active: z.boolean(),
})
type SupplierForm = z.infer<typeof supplierSchema>

function SupplierModal({ supplier, categories, onClose }: { supplier: Supplier | 'new' | null; categories: string[]; onClose: () => void }) {
  const { commit, commitWith } = useData()
  const run = useAction()
  const existing = supplier && supplier !== 'new' ? supplier : undefined
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierForm>({ resolver: zodResolver(supplierSchema) })

  useEffect(() => {
    if (!supplier) return
    reset(existing ? { ...existing, rating: String(existing.rating) } : { name: '', category: '', contactName: '', email: '', phone: '+234 ', city: 'Lagos', rating: '3', active: true })
  }, [supplier, existing, reset])

  const onSubmit = (v: SupplierForm) => {
    const input = { ...v, rating: Number(v.rating) }
    const ok = existing
      ? run(() => commit((s) => updateSupplier(s, existing.id, input)), { title: 'Supplier updated', description: v.name })
      : run(() => void commitWith((s) => addSupplier(s, input)), { title: 'Supplier added', description: v.name })
    if (ok) onClose()
  }

  return (
    <Modal
      open={supplier !== null}
      onClose={onClose}
      title={existing ? `Edit ${existing.name}` : 'Add supplier'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form">
            {existing ? 'Save changes' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier name" required error={errors.name?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="Category" required error={errors.category?.message}>
          {(id, d) => (
            <>
              <Input id={id} list="supplier-categories" aria-describedby={d} invalid={!!errors.category} {...register('category')} />
              <datalist id="supplier-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="City" required error={errors.city?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.city} {...register('city')} />}
        </Field>
        <Field label="Contact person" required error={errors.contactName?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.contactName} {...register('contactName')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(id, d) => <Input id={id} type="email" aria-describedby={d} invalid={!!errors.email} {...register('email')} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          {(id, d) => <Input id={id} type="tel" aria-describedby={d} invalid={!!errors.phone} {...register('phone')} />}
        </Field>
        <Field label="Performance rating">
          {(id) => (
            <Select id={id} {...register('rating')}>
              {['5', '4', '3', '2', '1'].map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox label="Active supplier" description="Inactive suppliers cannot be selected on new purchase requests." {...register('active')} />
        </div>
      </form>
    </Modal>
  )
}
