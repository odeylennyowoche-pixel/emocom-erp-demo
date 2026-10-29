import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useData } from '../../data/store'
import { buttonClasses } from '../../components/ui/Button'
import { canOpen, type ModuleKey } from './permissions'

/** Shows the page only if the signed-in person may open this module. */
export function ModuleGuard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { perms } = useData()
  if (!canOpen(perms, module)) return <AccessDenied />
  return <>{children}</>
}

export function AccessDenied({ message }: { message?: string }) {
  const { user, perms } = useData()
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-ink-900 text-brand-500">
        <Lock className="size-5" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access restricted</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {message ?? `Your account (${user.level}, ${perms.department?.name ?? 'no department'}) does not have access to this area.`}
      </p>
      <Link to="/" className={buttonClasses('primary', 'md', 'mt-6')}>
        Back to my dashboard
      </Link>
    </div>
  )
}
