import { useEffect, type ReactNode } from 'react'
import { APP_CONFIG } from '../../config/app'

/** Page title row with contextual actions; also sets the document title. */
export function PageHeader({ title, description, actions, meta }: { title: string; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ${APP_CONFIG.productName} ${APP_CONFIG.productSuffix}`
  }, [title])
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
