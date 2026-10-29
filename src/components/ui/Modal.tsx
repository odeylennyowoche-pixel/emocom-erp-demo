import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Field, Textarea } from './Form'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

/** Accessible dialog: focus moves inside, Escape closes, focus is restored on close. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? [])
    const first = focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables().find((el) => el.tagName !== 'BUTTON') ?? focusables()[0]
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab') {
        const els = focusables()
        if (els.length === 0) return
        const firstEl = els[0]
        const lastEl = els[els.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('animate-pop-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (note: string) => void
  title: string
  message: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary' | 'success'
  /** When set, a text reason is collected and required. */
  noteLabel?: string
  notePlaceholder?: string
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, tone = 'primary', noteLabel, notePlaceholder }: ConfirmDialogProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (open) {
      setNote('')
      setError(undefined)
    }
  }, [open])

  const submit = () => {
    if (noteLabel && note.trim().length < 5) {
      setError('Please provide a reason (at least 5 characters).')
      return
    }
    onConfirm(note.trim())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} data-autofocus={noteLabel ? undefined : ''}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-50">
            <AlertTriangle className="size-5 text-rose-600" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-4 text-sm text-slate-600">
          <div>{message}</div>
          {noteLabel && (
            <Field label={noteLabel} required error={error}>
              {(id, desc) => (
                <Textarea id={id} aria-describedby={desc} invalid={!!error} value={note} placeholder={notePlaceholder} onChange={(e) => setNote(e.target.value)} />
              )}
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}
