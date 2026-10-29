import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, ChevronDown, ChevronRight, LogOut, Menu, RotateCcw, Settings, UserCog } from 'lucide-react'
import { useData } from '../data/store'
import { ACCESS_LEVEL_LABELS } from '../types'
import { markAllNotificationsRead, markNotificationRead, signOut } from '../data/actions'
import { canSeeNotification } from '../features/auth/permissions'
import { fullName } from '../data/selectors'
import { usePopover } from '../hooks/usePopover'
import { timeAgo } from '../lib/dates'
import { cn, initials } from '../lib/utils'
import { useToast } from '../components/ui/toast-context'
import { GlobalSearch } from './GlobalSearch'
import { SEGMENT_LABELS } from './navigation'

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button onClick={onOpenMobileNav} className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </button>
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span className="hidden items-center rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold tracking-wider text-amber-700 ring-1 ring-amber-600/20 md:inline-flex">DEMO DATA</span>
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
      <Breadcrumbs />
    </header>
  )
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const { state } = useData()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs: Array<{ label: string; to?: string }> = [{ label: 'Dashboard', to: '/' }]
  let path = ''
  segments.forEach((seg, i) => {
    path += `/${seg}`
    const known = SEGMENT_LABELS[seg]
    const isLast = i === segments.length - 1
    let label: string | undefined = known?.label
    if (!label) {
      // dynamic id segment → resolve a friendly name
      const prev = segments[i - 1]
      if (prev === 'employees') label = fullName(state.employees.find((e) => e.id === seg))
      else if (prev === 'items') label = state.inventory.find((x) => x.id === seg)?.code
      else if (prev === 'requests') label = state.purchaseRequests.find((x) => x.id === seg)?.code
      else if (prev === 'invoices') label = state.invoices.find((x) => x.id === seg)?.number
      label = label && label !== '—' ? label : 'Not found'
    }
    crumbs.push({ label: label ?? seg, to: isLast ? undefined : (known?.to ?? path) })
  })

  return (
    <nav aria-label="Breadcrumb" className="border-t border-slate-100 px-4 py-2 sm:px-6">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 text-slate-300" aria-hidden />}
            {c.to ? (
              <Link to={c.to} className="hover:text-slate-800">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

const toneDot = { info: 'bg-sky-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500' }

function NotificationsMenu() {
  const { state, perms, user, commit } = useData()
  const navigate = useNavigate()
  const { open, setOpen, toggle, ref } = usePopover()
  const mine = state.notifications.filter((n) => canSeeNotification(perms, n))
  const isRead = (n: (typeof mine)[number]) => n.readBy.includes(user.id)
  const unread = mine.filter((n) => !isRead(n)).length
  const items = mine.slice(0, 8)

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Notifications (${unread} unread)`} aria-expanded={open} aria-haspopup="true">
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="tabular absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="animate-pop-in absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              onClick={() => commit((s) => markAllNotificationsRead(s, mine.map((n) => n.id)))}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:text-slate-400"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You’re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    commit((s) => markNotificationRead(s, n.id))
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !isRead(n) && 'bg-brand-50/50')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', isRead(n) ? 'bg-slate-200' : toneDot[n.tone])} aria-hidden />
                  <span className="min-w-0">
                    <span className={cn('block text-sm', isRead(n) ? 'text-slate-600' : 'font-medium text-slate-900')}>{n.title}</span>
                    <span className="block text-xs text-slate-500">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ProfileMenu() {
  const { user, perms, commit } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { open, setOpen, toggle, ref } = usePopover()

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-expanded={open} aria-haspopup="true" aria-label="Open profile menu">
        <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xs font-semibold text-ink-950">{initials(user.name)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{user.name}</span>
          <span className="block max-w-40 truncate text-xs text-slate-500">
            {ACCESS_LEVEL_LABELS[user.level]} · {perms.department?.code}
          </span>
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 md:block" aria-hidden />
      </button>
      {open && (
        <div className="animate-pop-in absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.title}</p>
            <p className="truncate text-xs text-slate-500">{perms.department?.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-medium text-brand-500">{ACCESS_LEVEL_LABELS[user.level]}</span>
              <span className="font-mono text-[11px] text-slate-400">@{user.username}</span>
            </div>
            <p className="mt-2 text-xs leading-snug text-slate-600">{perms.summary}</p>
          </div>
          <div className="px-2 py-1">
            {user.employeeId && (
              <button onClick={() => go(`/employees/${user.employeeId}`)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <UserCog className="size-4 text-slate-400" /> My profile
              </button>
            )}
            {perms.settings && (
              <>
                <button onClick={() => go('/settings')} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings className="size-4 text-slate-400" /> Settings
                </button>
                <button onClick={() => go('/settings?tab=data')} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <RotateCcw className="size-4 text-slate-400" /> Reset demo data
                </button>
              </>
            )}
            <button
              onClick={() => {
                setOpen(false)
                commit(signOut)
                toast.show({ tone: 'info', title: 'Signed out', description: 'Sign in with another account to see a different view.' })
                navigate('/login')
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="size-4 text-slate-400" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
