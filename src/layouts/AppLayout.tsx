import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Info, X } from 'lucide-react'
import { useData } from '../data/store'
import { updatePreferences } from '../data/actions'
import { cn } from '../lib/utils'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PageLoader } from '../components/ui/PageLoader'

const COLLAPSE_KEY = 'enterpriseone.ui.sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const { state, commit, signedIn } = useData()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  // Close the mobile drawer and scroll to top on navigation.
  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (!signedIn) return <Navigate to="/login" replace state={{ from: pathname }} />

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        {state.preferences.showDemoBanner && (
          <div className="no-print flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:items-center sm:px-6">
            <Info className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
            <p className="flex-1">
              <span className="font-semibold">Demonstration environment.</span> Prototype for EMOCOM Technologies. All people, clients and figures are fictional; changes are saved only in this browser.
            </p>
            <button onClick={() => commit((s) => updatePreferences(s, { showDemoBanner: false }))} className="rounded p-0.5 text-amber-700 hover:bg-amber-100" aria-label="Hide demo banner">
              <X className="size-4" />
            </button>
          </div>
        )}
        <main id="main" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
