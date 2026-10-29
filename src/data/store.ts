import { createContext, useContext } from 'react'
import type { AppUser, DemoState } from '../types'
import type { Permissions } from '../features/auth/permissions'

export interface DataContextValue {
  state: DemoState
  /** True when someone is signed in. Pages inside the app shell can assume it. */
  signedIn: boolean
  /** The signed-in user (falls back to the first user only while signed out). */
  user: AppUser
  /** What the signed-in user may see and do. */
  perms: Permissions
  /**
   * Apply a pure state transition. Throws `DomainError` for business-rule
   * violations so callers can show a meaningful message.
   */
  commit: (fn: (s: DemoState) => DemoState) => void
  /** Like commit, but returns a value computed alongside the new state. */
  commitWith: <T>(fn: (s: DemoState) => { state: DemoState; record: T }) => T
  resetDemo: () => void
}

export const DataContext = createContext<DataContextValue | null>(null)

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
