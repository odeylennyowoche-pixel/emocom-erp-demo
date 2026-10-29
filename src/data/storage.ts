/**
 * Local persistence for the DEMO ONLY. This module is the single place that
 * touches localStorage; a future backend would replace it with API calls.
 * Never store passwords, API keys or real organisational data here.
 */
import { z } from 'zod'
import { APP_CONFIG } from '../config/app'
import type { DemoState } from '../types'
import { createSeedState } from './seed'

const STORAGE_KEY = `${APP_CONFIG.storageKey}.v${APP_CONFIG.storageVersion}`

const record = z.object({ id: z.string() }).passthrough()

/** Shallow structural check — enough to reject corrupted or outdated data. */
const demoStateSchema = z
  .object({
    version: z.literal(APP_CONFIG.storageVersion),
    seededAt: z.string(),
    currentUserId: z.string().nullable(),
    organization: z.object({ name: z.string(), shortName: z.string() }).passthrough(),
    preferences: z.object({ accent: z.string(), pageSize: z.number() }).passthrough(),
    departments: z.array(record),
    users: z.array(record.extend({ username: z.string(), level: z.string() })).min(1),
    employees: z.array(record),
    inventory: z.array(record),
    stockMovements: z.array(record),
    assets: z.array(record),
    suppliers: z.array(record),
    purchaseRequests: z.array(record.extend({ lines: z.array(record), history: z.array(z.object({ status: z.string() }).passthrough()) })),
    expenses: z.array(record),
    invoices: z.array(record.extend({ lines: z.array(record) })),
    activity: z.array(record),
    notifications: z.array(record.extend({ readBy: z.array(z.string()) })),
    projects: z.array(record.extend({ milestones: z.array(record) })),
    tasks: z.array(record),
    opportunities: z.array(record),
    leaveRequests: z.array(record),
    proposals: z.array(record.extend({ lines: z.array(record), milestones: z.array(record) })),
    timesheets: z.array(record),
    securityPolicy: z.object({ mfaRequired: z.boolean() }).passthrough(),
  })
  .passthrough()

export type LoadResult =
  | { status: 'loaded'; state: DemoState }
  | { status: 'seeded'; state: DemoState }
  | { status: 'recovered'; state: DemoState; reason: string }

export function loadDemoState(): LoadResult {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'seeded', state: createSeedState() }
  }
  if (!raw) return { status: 'seeded', state: createSeedState() }
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = demoStateSchema.safeParse(parsed)
    if (!result.success) {
      return { status: 'recovered', state: createSeedState(), reason: 'Stored demo data was invalid and has been reset.' }
    }
    return { status: 'loaded', state: parsed as DemoState }
  } catch {
    return { status: 'recovered', state: createSeedState(), reason: 'Stored demo data could not be read and has been reset.' }
  }
}

export function saveDemoState(state: DemoState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearDemoState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    // remove keys from older storage versions as well
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(APP_CONFIG.storageKey)) localStorage.removeItem(key)
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
