import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { useData } from '../data/store'
import { cn, initials } from '../lib/utils'
import { NAV_GROUPS } from './navigation'
import { canOpen } from '../features/auth/permissions'
import { checkTransition } from '../features/procurement/workflow'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { state, perms } = useData()
  // Badge = requests waiting for THIS person's approval.
  const awaitingMe = state.purchaseRequests.filter((p) => p.status === 'Pending Approval' && checkTransition(p, 'approve', perms).allowed).length
  const badges: Record<string, number> = { '/procurement': awaitingMe }
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => canOpen(perms, i.module))
      .map((i) => (i.module === 'employees' && perms.employees === 'self' ? { ...i, label: 'My profile', to: `/employees/${perms.user.employeeId}` } : i)),
  })).filter((g) => g.items.length > 0)

  const content = (isMobile: boolean) => {
    const narrow = collapsed && !isMobile
    return (
      <div className="flex h-full flex-col bg-ink-900 text-slate-300">
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-white/5', narrow ? 'justify-center px-2' : 'px-5')}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-ink-950 shadow-inner">
            {initials(state.organization.shortName).slice(0, 1) || 'E'}
          </div>
          {!narrow && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{state.organization.shortName}</p>
              <p className="truncate text-xs text-brand-500">Enterprise Resource Planning</p>
            </div>
          )}
          {isMobile && (
            <button onClick={onCloseMobile} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close navigation">
              <X className="size-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              {!narrow ? (
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{group.label}</p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={isMobile ? onCloseMobile : undefined}
                      title={narrow ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors',
                          narrow ? 'justify-center px-2' : 'px-3',
                          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r bg-brand-500" aria-hidden />}
                          <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-500' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden />
                          {!narrow && <span className="truncate">{item.label}</span>}
                          {badges[item.to] ? (
                            <span
                              className={cn(
                                'tabular rounded-full bg-brand-500 text-[11px] font-semibold text-ink-950',
                                narrow ? 'absolute top-1 right-1 size-2 p-0 text-[0px]' : 'ml-auto px-1.5 py-px',
                              )}
                              aria-label={`${badges[item.to]} pending`}
                            >
                              {badges[item.to]}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          {!narrow && (
            <div className="mb-2 space-y-2">
              <div className="rounded-lg bg-white/5 px-3 py-2 text-xs">
                <p className="text-slate-400">Signed in as</p>
                <p className="truncate font-medium text-white">{perms.user.level}</p>
                <p className="truncate text-brand-500">{perms.department?.name}</p>
              </div>
              <div className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-brand-200 ring-1 ring-brand-500/25">
                <span className="font-semibold text-brand-500">DEMO DATA</span> — all records are fictional.
              </div>
            </div>
          )}
          {!isMobile && (
            <button
              onClick={onToggleCollapsed}
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white', narrow && 'justify-center px-2')}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              {!narrow && 'Collapse'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <aside className={cn('no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block', collapsed ? 'w-[72px]' : 'w-64')}>{content(false)}</aside>
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/60" onClick={onCloseMobile} aria-hidden />
          <aside className="animate-pop-in absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{content(true)}</aside>
        </div>
      )}
    </>
  )
}
