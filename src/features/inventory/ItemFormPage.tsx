import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { addItem, updateItem } from '../../data/actions'
import { useAction } from '../../hooks/useAction'
import { minorToInput, MONEY_INPUT_PATTERN, parseMoneyToMinor } from '../../lib/money'
import { INVENTORY_CATEGORIES, WAREHOUSE_LOCATIONS } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Form'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'

const wholeNumber = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, `${label} must be a whole number (0 or more)`)

const itemSchema = z.object({
  name: z.string().trim().min(3, 'Enter the item name').max(80),
  category: z.enum(INVENTORY_CATEGORIES),
  unit: z.string().trim().min(1, 'Enter a unit, e.g. piece, box, litre').max(20),
  quantity: wholeNumber('Opening quantity'),
  reorderLevel: wholeNumber('Reorder level'),
  unitCost: z
    .string()
    .trim()
    .regex(MONEY_INPUT_PATTERN, 'Enter an amount with up to 2 decimal places')
    .refine((v) => (parseMoneyToMinor(v) ?? 0) > 0, 'Unit cost must be greater than zero'),
  location: z.enum(WAREHOUSE_LOCATIONS),
  preferredSupplierId: z.string(),
})

type ItemForm = z.infer<typeof itemSchema>

export default function ItemFormPage() {
  const { id } = useParams()
  const { state, perms, commit, commitWith } = useData()
  const navigate = useNavigate()
  const run = useAction()
  const existing = id ? state.inventory.find((i) => i.id === id) : undefined

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          category: existing.category,
          unit: existing.unit,
          quantity: String(existing.quantity),
          reorderLevel: String(existing.reorderLevel),
          unitCost: minorToInput(existing.unitCostMinor),
          location: existing.location,
          preferredSupplierId: existing.preferredSupplierId ?? '',
        }
      : { name: '', category: 'Networking & Wi-Fi', unit: 'unit', quantity: '0', reorderLevel: '10', unitCost: '', location: 'Lekki HQ Store', preferredSupplierId: '' },
  })

  if (id && !existing) return <NotFoundPage title="Item not found" />
  if (perms.inventory !== 'manage') return <AccessDenied message="Only Procurement & Logistics and executives can add or edit stock items." />

  const onSubmit = (v: ItemForm) => {
    const base = {
      name: v.name,
      category: v.category,
      unit: v.unit,
      reorderLevel: Number(v.reorderLevel),
      unitCostMinor: parseMoneyToMinor(v.unitCost)!,
      location: v.location,
      preferredSupplierId: v.preferredSupplierId || undefined,
    }
    if (existing) {
      const ok = run(() => commit((s) => updateItem(s, existing.id, base)), { title: 'Item updated', description: v.name })
      if (ok) navigate(`/inventory/items/${existing.id}`)
    } else {
      let newId = ''
      const ok = run(
        () => {
          newId = commitWith((s) => addItem(s, { ...base, quantity: Number(v.quantity) })).id
        },
        { title: 'Item added', description: `${v.name} is now tracked in inventory.` },
      )
      if (ok) navigate(`/inventory/items/${newId}`)
    }
  }

  return (
    <>
      <PageHeader title={existing ? `Edit ${existing.name}` : 'Add inventory item'} description={existing ? `${existing.code} · quantity changes are made with stock movements on the item page.` : 'Create a new stock line. Fields marked * are required.'} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Item details" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Item name" required error={errors.name?.message} className="sm:col-span-2">
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
            </Field>
            <Field label="Category" required>
              {(fid) => (
                <Select id={fid} {...register('category')}>
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Unit of measure" required error={errors.unit?.message}>
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.unit} {...register('unit')} />}
            </Field>
            <Field label={`Unit cost (${APP_CONFIG.currency})`} required error={errors.unitCost?.message}>
              {(fid, d) => <Input id={fid} inputMode="decimal" placeholder="0.00" aria-describedby={d} invalid={!!errors.unitCost} {...register('unitCost')} />}
            </Field>
            <Field label="Storage location" required>
              {(fid) => (
                <Select id={fid} {...register('location')}>
                  {WAREHOUSE_LOCATIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Preferred supplier">
              {(fid) => (
                <Select id={fid} {...register('preferredSupplierId')}>
                  <option value="">None</option>
                  {state.suppliers
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Stock control" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Opening quantity" required={!existing} error={errors.quantity?.message} hint={existing ? `Current stock: ${existing.quantity}. Use Receive / Issue / Adjust on the item page.` : 'Recorded as an opening-balance stock movement.'}>
              {(fid, d) => <Input id={fid} inputMode="numeric" aria-describedby={d} invalid={!!errors.quantity} disabled={!!existing} {...register('quantity')} />}
            </Field>
            <Field label="Reorder level" required error={errors.reorderLevel?.message} hint="An alert is raised when stock falls to this level.">
              {(fid, d) => <Input id={fid} inputMode="numeric" aria-describedby={d} invalid={!!errors.reorderLevel} {...register('reorderLevel')} />}
            </Field>
          </CardBody>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(existing ? `/inventory/items/${existing.id}` : '/inventory')}>
            Cancel
          </Button>
          <Button type="submit" icon={<Save className="size-4" />} disabled={!!existing && !isDirty}>
            {existing ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </form>
    </>
  )
}
