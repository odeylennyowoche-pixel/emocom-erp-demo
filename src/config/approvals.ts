/**
 * DEMO DELEGATION OF AUTHORITY (approval limits).
 * Placeholder values agreed for the demo; replace with EMOCOM's real matrix.
 * In production these limits must be enforced by the server.
 */
import { APP_CONFIG } from './app'

const M = APP_CONFIG.minorUnitsPerMajor

export const LIMITS = {
  /** Managers approve their own team's purchase requests up to this amount. */
  managerPurchaseMinor: 5_000_000 * M,
  /** The finance manager approves any purchase request up to this amount. */
  financePurchaseMinor: 20_000_000 * M,
  /** Projects / contracts above this value need the CEO's final approval. */
  ceoProjectThresholdMinor: 50_000_000 * M,
  /** Managers approve change requests on their projects up to this cost impact. */
  managerChangeRequestMinor: 10_000_000 * M,
} as const
