import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn, uid } from '../../lib/utils'
import { ToastContext, type ToastApi, type ToastInput } from './toast-context'

interface ToastItem extends ToastInput {
  id: string
}

const ICONS = {
  success: <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />,
  danger: <XCircle className="size-5 text-rose-600" aria-hidden />,
  warning: <AlertTriangle className="size-5 text-amber-600" aria-hidden />,
  info: <Info className="size-5 text-brand-600" aria-hidden />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (t: ToastInput) => {
      const id = uid('toast')
      setToasts((list) => [...list.slice(-3), { ...t, id }])
      window.setTimeout(() => dismiss(id), t.tone === 'danger' ? 6500 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'danger' }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            className={cn(
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white p-3.5 shadow-lg shadow-slate-900/10',
              t.tone === 'danger' ? 'border-rose-200' : t.tone === 'warning' ? 'border-amber-200' : 'border-slate-200',
            )}
          >
            {ICONS[t.tone ?? 'info']}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-slate-600">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Dismiss notification">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
