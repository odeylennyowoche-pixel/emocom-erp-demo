import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useData } from '../../data/store'
import { adjustStock } from '../../data/actions'
import { useAction } from '../../hooks/useAction'
import type { InventoryItem, StockMovementType } from '../../types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'

const schema = z.object({
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, 'Enter a whole number'),
  reference: z.string().trim().max(30),
  note: z.string().trim().max(200),
})
type Form = z.infer<typeof schema>

const COPY: Record<StockMovementType, { title: string; qtyLabel: string; hint: string; button: string }> = {
  Receipt: { title: 'Receive stock', qtyLabel: 'Quantity received', hint: 'Adds to the current stock level.', button: 'Record receipt' },
  Issue: { title: 'Issue stock', qtyLabel: 'Quantity issued', hint: 'Deducts from the current stock level.', button: 'Record issue' },
  Adjustment: { title: 'Stock count adjustment', qtyLabel: 'Counted quantity', hint: 'Sets stock to the physically counted quantity.', button: 'Save adjustment' },
}

export function StockAdjustModal({ item, type, onClose }: { item: InventoryItem; type: StockMovementType | null; onClose: () => void }) {
  const { commit } = useData()
  const run = useAction()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { quantity: '', reference: '', note: '' } })

  useEffect(() => {
    if (type) reset({ quantity: type === 'Adjustment' ? String(item.quantity) : '', reference: '', note: '' })
  }, [type, item.quantity, reset])

  if (!type) return null
  const copy = COPY[type]
  const qty = Number(watch('quantity') || 0)
  const projected = type === 'Receipt' ? item.quantity + qty : type === 'Issue' ? item.quantity - qty : qty

  const onSubmit = (v: Form) => {
    const n = Number(v.quantity)
    if (type !== 'Adjustment' && n === 0) return setError('quantity', { message: 'Quantity must be greater than zero' })
    if (type === 'Issue' && n > item.quantity) return setError('quantity', { message: `Only ${item.quantity} available to issue` })
    const ok = run(() => commit((s) => adjustStock(s, { itemId: item.id, type, quantity: n, reference: v.reference, note: v.note || undefined })), {
      title: `${copy.title} recorded`,
      description: `${item.name}: stock is now ${type === 'Adjustment' ? n : projected} ${item.unit}(s).`,
    })
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      description={`${item.name} · current stock ${item.quantity.toLocaleString()} ${item.unit}(s)`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="stock-form">
            {copy.button}
          </Button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label={copy.qtyLabel} required error={errors.quantity?.message} hint={copy.hint}>
          {(id, d) => <Input id={id} inputMode="numeric" aria-describedby={d} invalid={!!errors.quantity} {...register('quantity')} />}
        </Field>
        <Field label="Reference" hint="e.g. GRN number, issue slip or count sheet">
          {(id, d) => <Input id={id} aria-describedby={d} {...register('reference')} />}
        </Field>
        <Field label="Note">{(id) => <Textarea id={id} rows={2} {...register('note')} />}</Field>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Stock after this movement:{' '}
          <span className={projected < 0 ? 'font-semibold text-rose-600' : projected <= item.reorderLevel ? 'font-semibold text-amber-700' : 'font-semibold text-slate-900'}>
            {Number.isFinite(projected) ? projected.toLocaleString() : '—'} {item.unit}(s)
          </span>
          {projected >= 0 && projected <= item.reorderLevel && <span className="text-amber-700"> · at or below reorder level ({item.reorderLevel})</span>}
        </p>
      </form>
    </Modal>
  )
}
