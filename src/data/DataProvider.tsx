import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DemoState } from '../types'
import { currentUser } from './actions'
import { permissionsFor } from '../features/auth/permissions'
import { createSeedState } from './seed'
import { clearDemoState, loadDemoState, saveDemoState } from './storage'
import { DataContext, type DataContextValue } from './store'
import { useToast } from '../components/ui/toast-context'

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const initial = useRef(loadDemoState())
  const [state, setState] = useState<DemoState>(initial.current.state)
  const stateRef = useRef(state)
  stateRef.current = state

  // Surface recovery from malformed storage once on start-up.
  useEffect(() => {
    const result = initial.current
    if (result.status === 'recovered') toast.show({ tone: 'warning', title: 'Demo data reset', description: result.reason })
  }, [toast])

  // Persist every change. Failure (e.g. storage full/blocked) is reported but non-fatal.
  const saveFailed = useRef(false)
  useEffect(() => {
    const ok = saveDemoState(state)
    if (!ok && !saveFailed.current) {
      saveFailed.current = true
      toast.show({ tone: 'danger', title: 'Changes are not being saved', description: 'Browser storage is unavailable. Changes will be lost on refresh.' })
    }
  }, [state, toast])

  // Apply the accent colour preference to the document.
  useEffect(() => {
    document.documentElement.dataset.accent = state.preferences.accent
  }, [state.preferences.accent])

  const commit = useCallback((fn: (s: DemoState) => DemoState) => {
    const next = fn(stateRef.current) // may throw DomainError → caller handles
    stateRef.current = next
    setState(next)
  }, [])

  const commitWith = useCallback(<T,>(fn: (s: DemoState) => { state: DemoState; record: T }): T => {
    const result = fn(stateRef.current)
    stateRef.current = result.state
    setState(result.state)
    return result.record
  }, [])

  const resetDemo = useCallback(() => {
    clearDemoState()
    const fresh = createSeedState()
    stateRef.current = fresh
    setState(fresh)
  }, [])

  const value = useMemo<DataContextValue>(() => {
    const user = currentUser(state)
    return { state, signedIn: !!state.currentUserId && state.users.some((u) => u.id === state.currentUserId && u.status === 'Active'), user, perms: permissionsFor(user, state.departments), commit, commitWith, resetDemo }
  }, [state, commit, commitWith, resetDemo])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
