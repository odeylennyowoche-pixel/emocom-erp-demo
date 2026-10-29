import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { AlertOctagon, Compass } from 'lucide-react'
import { buttonClasses } from '../components/ui/Button'

export function NotFoundPage({ title = 'Page not found', message = 'The page or record you’re looking for doesn’t exist or may have been removed.' }: { title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Compass className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
      <Link to="/" className={buttonClasses('primary', 'md', 'mt-6')}>
        Back to dashboard
      </Link>
    </div>
  )
}

/** Shown if a route throws while rendering — keeps the app recoverable. */
export function RouteError() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertOctagon className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">An unexpected error occurred on this page. Your demo data is safe.</p>
      <p className="mt-3 max-w-md rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600">{detail}</p>
      <div className="mt-6 flex gap-2">
        <button onClick={() => window.location.reload()} className={buttonClasses('primary')}>
          Reload this page
        </button>
        <a href="#/" className={buttonClasses('secondary')}>
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
