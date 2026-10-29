import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogIn, ShieldAlert } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { DomainError, signIn } from '../../data/actions'
import { cn } from '../../lib/utils'
import { permissionsFor } from './permissions'
import type { AccessLevel } from '../../types'

const LEVEL_ORDER: Record<AccessLevel, number> = { CEO: 0, Administrator: 1, 'Head of Department': 2, Staff: 3 }

export default function LoginPage() {
  const { state, signedIn, commit } = useData()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    document.title = `Sign in · ${APP_CONFIG.productName} ${APP_CONFIG.productSuffix}`
  }, [])

  const groups = useMemo(() => {
    return state.departments
      .map((d) => ({
        department: d,
        accounts: state.users.filter((u) => u.departmentId === d.id).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]),
      }))
      .filter((g) => g.accounts.length > 0)
  }, [state.departments, state.users])

  if (signedIn) return <Navigate to={from} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      commit((s) => signIn(s, username, password))
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'Sign-in failed. Please try again.')
    }
  }

  const fill = (u: string) => {
    setUsername(u)
    setPassword(APP_CONFIG.demoPassword)
    setError(undefined)
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-ink-950 px-6 py-8 text-slate-300 sm:px-10 lg:min-h-screen lg:py-12">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-brand-500/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-lg font-bold text-ink-950">E</span>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-wide text-white">EMOCOM</p>
              <p className="text-xs tracking-wider text-brand-500 uppercase">Enterprise Resource Planning</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-md text-3xl leading-tight font-semibold text-white sm:text-4xl">
            One system for <span className="text-brand-500">people, projects, stock and finance.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Prototype ERP prepared for EMOCOM Technologies and Consulting Ltd. Each person signs in with their own account and sees only what their role and department allow.
          </p>
          <ul className="mt-8 hidden max-w-md grid-cols-2 gap-3 text-sm sm:grid">
            {['Department-based access', 'Purchase approvals by limit', 'Stock & asset control', 'Budgets & client invoices'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-10 rounded-xl border border-brand-500/25 bg-brand-500/5 p-4 text-xs leading-relaxed text-slate-300">
          <p className="flex items-center gap-1.5 font-semibold tracking-wider text-brand-500 uppercase">
            <ShieldAlert className="size-3.5" /> Demonstration
          </p>
          <p className="mt-1">All people, clients and figures are fictional. Sign-in here is for the demo only and is not real security. Changes are saved in this browser.</p>
        </div>
      </aside>

      {/* Sign-in */}
      <main className="px-4 py-8 sm:px-10 lg:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use your EMOCOM ERP account.</p>
            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. hod.sales"
                  className="block h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-slate-300 pr-10 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <button type="submit" className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 text-sm font-semibold text-brand-500 hover:bg-black">
                <LogIn className="size-4" /> Sign in
              </button>
            </form>
          </div>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Demo accounts</h2>
                <p className="text-sm text-slate-500">
                  Click an account to fill it in. Password for all accounts:{' '}
                  <code className="rounded bg-ink-900 px-1.5 py-0.5 text-xs font-semibold text-brand-500">{APP_CONFIG.demoPassword}</code>
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <KeyRound className="size-3.5" /> {state.users.length} accounts
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {groups.map(({ department, accounts }) => (
                <div key={department.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="px-1 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{department.name}</p>
                  <ul className="space-y-1">
                    {accounts.map((u) => {
                      const p = permissionsFor(u, state.departments)
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => fill(u.username)}
                            disabled={u.status !== 'Active'}
                            className={cn(
                              'w-full rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-50',
                              username === u.username ? 'border-brand-500 bg-brand-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                            )}
                            title={p.summary}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold text-slate-800">{u.username}</span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                  u.level === 'CEO' || u.level === 'Administrator' ? 'bg-ink-900 text-brand-500' : u.level === 'Head of Department' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                {u.level}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {u.name} · {u.title}
                              {u.status !== 'Active' && ' · suspended'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
