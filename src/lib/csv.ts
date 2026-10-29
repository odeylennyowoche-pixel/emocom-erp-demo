export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | undefined
}

function escapeCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return ''
  const s = String(value)
  // Guard against spreadsheet formula injection, then quote if needed.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = '﻿' + toCsv(rows, columns) // BOM so Excel reads UTF-8 (₦)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
