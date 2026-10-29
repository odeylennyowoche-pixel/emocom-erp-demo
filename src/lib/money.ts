import { APP_CONFIG } from '../config/app'
import type { Minor } from '../types'

/**
 * Money helpers. All arithmetic is performed on integer minor units
 * (e.g. kobo) so totals never suffer from floating-point drift.
 */

const formatter = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency',
  currency: APP_CONFIG.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency',
  currency: APP_CONFIG.currency,
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatMoney(minor: Minor): string {
  return formatter.format(minor / APP_CONFIG.minorUnitsPerMajor)
}

export function formatMoneyCompact(minor: Minor): string {
  return compactFormatter.format(minor / APP_CONFIG.minorUnitsPerMajor)
}

/** Major-unit number for chart axes only (display, never for arithmetic). */
export function toMajorForDisplay(minor: Minor): number {
  return minor / APP_CONFIG.minorUnitsPerMajor
}

export const MONEY_INPUT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/

/**
 * Parse a user-entered major-unit amount ("1250.5", "1,250.50") into integer
 * minor units using string arithmetic (no float multiplication).
 * Returns null for invalid input.
 */
export function parseMoneyToMinor(input: string): Minor | null {
  const cleaned = input.replace(/[,\s]/g, '')
  if (!MONEY_INPUT_PATTERN.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const fractionPadded = (fraction + '00').slice(0, 2)
  return Number(whole) * APP_CONFIG.minorUnitsPerMajor + Number(fractionPadded)
}

/** Convert minor units back into an editable major-unit string ("1250.50"). */
export function minorToInput(minor: Minor): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  const whole = Math.floor(abs / APP_CONFIG.minorUnitsPerMajor)
  const fraction = String(abs % APP_CONFIG.minorUnitsPerMajor).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

export function sumMinor(values: Minor[]): Minor {
  return values.reduce((acc, v) => acc + v, 0)
}

/** quantity must be an integer; result stays an integer. */
export function lineTotal(quantity: number, unitPriceMinor: Minor): Minor {
  return Math.round(quantity) * unitPriceMinor
}

export function currencySymbol(): string {
  const part = formatter.formatToParts(0).find((p) => p.type === 'currency')
  return part?.value ?? APP_CONFIG.currency
}
