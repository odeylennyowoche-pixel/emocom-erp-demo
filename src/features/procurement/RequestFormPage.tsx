import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Save, Send, Trash2 } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { savePurchaseRequest } from '../../data/actions'
import { fullName } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { addDays, todayISO } from '../../lib/dates'
import { formatMoney, lineTotal, minorToInput, MONEY_INPUT_PATTERN, parseMoneyToMinor, sumMinor } from '../../lib/money'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea, controlClass } from '../../components/ui/Form'
import { NotFoundPage } from '../../app/RouteError'
import { AccessDenied } from '../auth/Guards'
import { visibleRequests } from '../auth/permissions'
import { approvalRoute } from './approvalPolicy'

const lineSchema = z.object({
  inventoryItemId: z.string(),
  description: z.string().trim().min(2, 'Describe the item'),
  quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, 'Whole number ≥ 1'),
  unitPrice: z
    .string()
    .trim()
    .regex(MONEY_INPUT_PATTERN, 'Invalid amount')
    .refine((v) => (parseMoneyToMinor(v) ?? 0) > 0, 'Must be > 0'),
})

const requestSchema = z.object({
  title: z.string().trim().min(5, 'Give the request a short descriptive title').max(90),
  requesterId: z.string().min(1, 'Select the requester'),
  departmentId: z.string().min(1, 'Select a department'),
  supplierId: z.string().min(1, 'Select a supplier'),
  neededBy: z.string().min(1, 'Select a date').refine((d) => d >= todayISO(), 'Needed-by date cannot be in the past'),
  justification: z.string().trim().min(10, 'Explain the business need (at least 10 characters)').max(500),
  lines: z.array(lineSchema).min(1, 'Add at least one line item').max(20),
})

type RequestForm = z.infer<typeof requestSchema>

export default function RequestFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { state, user, perms, commitWith } = useData()
  const navigate = useNavigate()
  const run = useAction()
  const existing = id ? state.purchaseRequests.find((p) => p.id === id) : undefined
  const prefillItem = state.inventory.find((i) => i.id === params.get('item'))
  const requesterDefault = state.employees.find((e) => e.id === user.employeeId)

  const defaults: RequestForm = existing
    ? {
        title: existing.title,
        requesterId: existing.requesterId,
        departmentId: existing.departmentId,
        supplierId: existing.supplierId,
        neededBy: existing.neededBy < todayISO() ? addDays(todayISO(), 14) : existing.neededBy,
        justification: existing.justification,
        lines: existing.lines.map((l) => ({ inventoryItemId: l.inventoryItemId ?? '', description: l.description, quantity: String(l.quantity), unitPrice: minorToInput(l.unitPriceMinor) })),
      }
    : {
        title: prefillItem ? `Restock: ${prefillItem.name}` : '',
        requesterId: requesterDefault?.id ?? '',
        departmentId: requesterDefault?.departmentId ?? '',
        supplierId: prefillItem?.preferredSupplierId ?? '',
        neededBy: addDays(todayISO(), 14),
        justification: prefillItem ? `Stock is at ${prefillItem.quantity} ${prefillItem.unit}(s), at or near the reorder level of ${prefillItem.reorderLevel}.` : '',
        lines: [
          prefillItem
            ? { inventoryItemId: prefillItem.id, description: prefillItem.name, quantity: String(Math.max(1, prefillItem.reorderLevel * 2)), unitPrice: minorToInput(prefillItem.unitCostMinor) }
            : { inventoryItemId: '', description: '', quantity: '1', unitPrice: '' },
        ],
      }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestForm>({ resolver: zodResolver(requestSchema), defaultValues: defaults })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = watch('lines')
  const total = useMemo(
    () => sumMinor(lines.map((l) => (/^\d+$/.test(l.quantity) ? lineTotal(Number(l.quantity), parseMoneyToMinor(l.unitPrice) ?? 0) : 0))),
    [lines],
  )

  const visibleRequestIds = new Set(visibleRequests(perms, state.purchaseRequests).map((p) => p.id))
  if (id && !existing) return <NotFoundPage title="Purchase request not found" />
  if (existing && existing.status !== 'Draft') {
    return <NotFoundPage title="This request can no longer be edited" message={`${existing.code} is ${existing.status}. Only draft requests can be edited.`} />
  }

  const activeSuppliers = state.suppliers.filter((s) => s.active || s.id === existing?.supplierId)
  // Staff raise requests for themselves; heads for their department; Procurement and executives for anyone.
  const activeEmployees = state.employees.filter(
    (e) =>
      e.status !== 'Inactive' &&
      (perms.procurement === 'all' || (perms.procurement === 'department' ? e.departmentId === user.departmentId : e.id === user.employeeId)),
  )
  const lockDepartment = perms.procurement !== 'all'
  if (existing && !visibleRequestIds.has(existing.id)) return <AccessDenied message="You can only edit requests you have access to." />

  const save = (submit: boolean) =>
    handleSubmit((v) => {
      const input = {
        title: v.title,
        requesterId: v.requesterId,
        departmentId: v.departmentId,
        supplierId: v.supplierId,
        neededBy: v.neededBy,
        justification: v.justification,
        lines: v.lines.map((l) => ({ inventoryItemId: l.inventoryItemId || undefined, description: l.description, quantity: Number(l.quantity), unitPriceMinor: parseMoneyToMinor(l.unitPrice)! })),
      }
      let recordId = ''
      const ok = run(
        () => {
          recordId = commitWith((s) => savePurchaseRequest(s, input, { submit, id: existing?.id })).id
        },
        { title: submit ? 'Submitted for approval' : 'Draft saved', description: submit ? 'Approvers have been notified.' : 'You can submit it for approval later.' },
      )
      if (ok) navigate(`/procurement/requests/${recordId}`)
    })

  return (
    <>
      <PageHeader title={existing ? `Edit ${existing.code}` : 'New purchase request'} description="Requests over the requester’s approval limit are routed to a manager or administrator." />
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Request details" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Title" required error={errors.title?.message} className="sm:col-span-2 lg:col-span-3">
              {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.title} placeholder="e.g. Laptops for new analysts" {...register('title')} />}
            </Field>
            <Field label="Requester" required error={errors.requesterId?.message}>
              {(fid, d) => (
                <Select
                  id={fid}
                  aria-describedby={d}
                  invalid={!!errors.requesterId}
                  {...register('requesterId', {
                    onChange: (e) => {
                      const emp = state.employees.find((x) => x.id === e.target.value)
                      if (emp) setValue('departmentId', emp.departmentId, { shouldValidate: true })
                    },
                  })}
                >
                  <option value="">Select requester…</option>
                  {activeEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)} — {e.jobTitle}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Department" required error={errors.departmentId?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} invalid={!!errors.departmentId} {...register('departmentId')}>
                  <option value="">Select department…</option>
                  {state.departments.filter((dep) => !lockDepartment || dep.id === user.departmentId).map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Supplier" required error={errors.supplierId?.message}>
              {(fid, d) => (
                <Select id={fid} aria-describedby={d} invalid={!!errors.supplierId} {...register('supplierId')}>
                  <option value="">Select supplier…</option>
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Needed by" required error={errors.neededBy?.message}>
              {(fid, d) => <Input id={fid} type="date" min={todayISO()} aria-describedby={d} invalid={!!errors.neededBy} {...register('neededBy')} />}
            </Field>
            <Field label="Business justification" required error={errors.justification?.message} className="sm:col-span-2">
              {(fid, d) => <Textarea id={fid} aria-describedby={d} invalid={!!errors.justification} rows={2} {...register('justification')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Line items"
            description="Link a line to an inventory item so stock updates automatically when goods are received."
            actions={
              <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => append({ inventoryItemId: '', description: '', quantity: '1', unitPrice: '' })} disabled={fields.length >= 20}>
                Add line
              </Button>
            }
          />
          <div className="divide-y divide-slate-100">
            {fields.map((f, idx) => {
              const le = errors.lines?.[idx]
              const l = lines[idx]
              const amount = l && /^\d+$/.test(l.quantity) ? lineTotal(Number(l.quantity), parseMoneyToMinor(l.unitPrice) ?? 0) : 0
              return (
                <div key={f.id} className="grid gap-3 px-5 py-4 md:grid-cols-12 md:items-start">
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`line-item-${idx}`}>
                      Inventory item
                    </label>
                    <select
                      id={`line-item-${idx}`}
                      className={controlClass(false, 'h-9.5 pr-8')}
                      {...register(`lines.${idx}.inventoryItemId`, {
                        onChange: (e) => {
                          const item = state.inventory.find((i) => i.id === e.target.value)
                          if (item) {
                            setValue(`lines.${idx}.description`, item.name, { shouldValidate: true })
                            setValue(`lines.${idx}.unitPrice`, minorToInput(item.unitCostMinor), { shouldValidate: true })
                          }
                        },
                      })}
                    >
                      <option value="">Non-stock / service</option>
                      {state.inventory.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} — {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`line-desc-${idx}`}>
                      Description *
                    </label>
                    <Input id={`line-desc-${idx}`} invalid={!!le?.description} {...register(`lines.${idx}.description`)} />
                    {le?.description && <p className="mt-1 text-xs text-rose-600">{le.description.message}</p>}
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`line-qty-${idx}`}>
                      Qty *
                    </label>
                    <Input id={`line-qty-${idx}`} inputMode="numeric" invalid={!!le?.quantity} {...register(`lines.${idx}.quantity`)} />
                    {le?.quantity && <p className="mt-1 text-xs text-rose-600">{le.quantity.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`line-price-${idx}`}>
                      Unit price ({APP_CONFIG.currency}) *
                    </label>
                    <Input id={`line-price-${idx}`} inputMode="decimal" placeholder="0.00" invalid={!!le?.unitPrice} {...register(`lines.${idx}.unitPrice`)} />
                    {le?.unitPrice && <p className="mt-1 text-xs text-rose-600">{le.unitPrice.message}</p>}
                  </div>
                  <div className="flex items-end justify-between gap-2 md:col-span-2 md:flex-col md:items-end">
                    <span className="text-xs font-medium text-slate-600 md:mb-1">Amount</span>
                    <span className="tabular text-sm font-semibold text-slate-900 md:leading-9">{formatMoney(amount)}</span>
                  </div>
                  {fields.length > 1 && (
                    <div className="md:col-span-12 md:-mt-2 md:text-right">
                      <button type="button" onClick={() => remove(idx)} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700">
                        <Trash2 className="size-3.5" /> Remove line
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {errors.lines?.root?.message && <p className="px-5 pb-3 text-sm text-rose-600">{errors.lines.root.message}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <p className="text-xs text-slate-500">
              Demo approval limits: team manager up to ₦5m, finance manager up to ₦20m, CEO above that (capital). This request goes to: {approvalRoute(total)}.
            </p>
            <p className="text-sm text-slate-600">
              Request total <span className="tabular ml-2 text-lg font-semibold text-slate-900">{formatMoney(total)}</span>
            </p>
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(existing ? `/procurement/requests/${existing.id}` : '/procurement')}>
            Cancel
          </Button>
          <Button variant="secondary" icon={<Save className="size-4" />} onClick={save(false)}>
            Save as draft
          </Button>
          <Button icon={<Send className="size-4" />} onClick={save(true)}>
            Submit for approval
          </Button>
        </div>
      </form>
    </>
  )
}
