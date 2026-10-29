import { formatMoney, formatMoneyCompact } from '../../lib/money'
import { APP_CONFIG } from '../../config/app'

/** Categorical palette used consistently across charts. */
export const CHART_COLORS = ['#c19a2e', '#27272a', '#0d9488', '#b45309', '#e11d48', '#0284c7', '#71717a', '#059669', '#7c3aed']

export const AXIS_PROPS = {
  tick: { fill: '#64748b', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

/** Axis tick formatter for values plotted in major units. */
export function compactMoneyTick(major: number): string {
  return formatMoneyCompact(Math.round(major * APP_CONFIG.minorUnitsPerMajor))
}

interface TooltipEntry {
  name?: string | number
  value?: number | string | Array<number | string>
  color?: string
  payload?: Record<string, unknown>
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  /** Values are in major units; shown as currency. */
  money?: boolean
  labelFormatter?: (label: string) => string
}

export function ChartTooltip({ active, payload, label, money = false, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && label !== '' && <p className="mb-1 font-medium text-slate-800">{labelFormatter ? labelFormatter(String(label)) : label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => {
          const v = Array.isArray(p.value) ? p.value[0] : p.value
          const num = typeof v === 'number' ? v : Number(v)
          return (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-slate-600">
              <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload?.fill as string | undefined) }} aria-hidden />
              <span>{p.name}</span>
              <span className="tabular ml-auto pl-4 font-medium text-slate-900">
                {money ? formatMoney(Math.round(num * APP_CONFIG.minorUnitsPerMajor)) : num.toLocaleString()}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="truncate text-slate-600">{label}</span>
      {value && <span className="tabular ml-auto font-medium text-slate-900">{value}</span>}
    </div>
  )
}
