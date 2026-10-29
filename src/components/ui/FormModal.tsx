import { useEffect, useState, type ReactNode } from 'react'
import { parseMoneyToMinor } from '../../lib/money'
import { Button } from './Button'
import { Field, Input, Select, Textarea } from './Form'
import { Modal } from './Modal'

export interface FieldSpec {
  name: string
  label: string
  type?: 'text' | 'email' | 'number' | 'money' | 'date' | 'select' | 'textarea'
  required?: boolean
  options?: ReadonlyArray<string | { value: string; label: string }>
  hint?: string
  min?: number
  max?: number
  /** Span both columns. */
  full?: boolean
  placeholder?: string
}

export type FormValues = Record<string, string>

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  fields: FieldSpec[]
  initial?: FormValues
  submitLabel?: string
  /** Return true to close the dialog (false keeps it open, e.g. on a business-rule error). */
  onSubmit: (values: FormValues) => boolean
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(fields: FieldSpec[], v: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const raw = (v[f.name] ?? '').trim()
    if (!raw) {
      if (f.required) errors[f.name] = `${f.label} is required.`
      continue
    }
    if (f.type === 'email' && !EMAIL.test(raw)) errors[f.name] = 'Enter a valid email address.'
    if (f.type === 'money' && parseMoneyToMinor(raw) === null) errors[f.name] = 'Enter an amount such as 125000 or 125000.50.'
    if (f.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) errors[f.name] = 'Enter a number.'
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Must be at least ${f.min}.`
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Must be at most ${f.max}.`
    }
    if ((f.type === 'text' || f.type === 'textarea' || !f.type) && f.min !== undefined && raw.length < f.min) errors[f.name] = `Enter at least ${f.min} characters.`
  }
  return errors
}

/** Small schema-driven form in a dialog, used by the role-based modules. */
export function FormModal({ open, onClose, title, description, fields, initial, submitLabel = 'Save', onSubmit, size = 'md', children }: FormModalProps) {
  const [values, setValues] = useState<FormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) {
      setValues({ ...Object.fromEntries(fields.map((f) => [f.name, ''])), ...initial })
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = () => {
    const errs = validate(fields, values)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (onSubmit(Object.fromEntries(Object.entries(values).map(([k, val]) => [k, val.trim()])))) onClose()
  }
  const set = (name: string, val: string) => setValues((s) => ({ ...s, [name]: val }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{submitLabel}</Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
      >
        {fields.map((f) => (
          <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]} hint={f.hint} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
            {(id, desc) =>
              f.type === 'select' ? (
                <Select id={id} aria-describedby={desc} invalid={!!errors[f.name]} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Select…</option>
                  {(f.options ?? []).map((o) =>
                    typeof o === 'string' ? (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ) : (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ),
                  )}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea id={id} aria-describedby={desc} invalid={!!errors[f.name]} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <Input
                  id={id}
                  aria-describedby={desc}
                  invalid={!!errors[f.name]}
                  type={f.type === 'money' ? 'text' : f.type === 'number' ? 'number' : f.type ?? 'text'}
                  inputMode={f.type === 'money' ? 'decimal' : undefined}
                  step={f.type === 'number' ? 'any' : undefined}
                  value={values[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )
            }
          </Field>
        ))}
        {children && <div className="sm:col-span-2">{children}</div>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

/** Helpers to read typed values from FormModal results. */
export const formValue = {
  money: (v: string) => parseMoneyToMinor(v) ?? 0,
  number: (v: string) => Number(v),
  optional: (v: string) => (v ? v : undefined),
}
