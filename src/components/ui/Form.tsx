import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const control =
  'block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

export function controlClass(invalid?: boolean, extra?: string) {
  return cn(control, invalid ? 'border-rose-400' : 'border-slate-300', extra)
}

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Accessible label + control + error wrapper. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const descId = error || hint ? `${id}-desc` : undefined
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500" aria-hidden>*</span>}
      </label>
      {children(id, descId)}
      {error ? (
        <p id={descId} className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={controlClass(invalid, cn('h-9.5', className))} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={controlClass(invalid, cn('h-9.5 pr-8', className))} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={controlClass(invalid, cn('py-2', className))} rows={3} {...rest} />
})

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }>(function Checkbox(
  { label, description, ...rest },
  ref,
) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input ref={ref} id={id} type="checkbox" className="mt-0.5 size-4 rounded border-slate-300 accent-[var(--brand-600)]" {...rest} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-slate-500">{description}</span>}
      </label>
    </div>
  )
})
