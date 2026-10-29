/**
 * Central branding and locale configuration.
 * Change these values to rebrand the product or switch the display currency.
 */
export const APP_CONFIG = {
  productName: 'EMOCOM',
  productSuffix: 'ERP',
  /** Shared password for every demo account (demonstration only, not real security). */
  demoPassword: 'emocom2026',
  /** ISO 4217 currency code used for all money formatting. */
  currency: 'NGN',
  /** Number of minor units per major unit (kobo per naira). */
  minorUnitsPerMajor: 100,
  locale: 'en-NG',
  /** Bump when the shape of stored demo data changes; old data is re-seeded. */
  storageVersion: 4,
  storageKey: 'emocom-erp.demo-state',
} as const
