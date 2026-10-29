import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Printer, Send } from 'lucide-react'
import { APP_CONFIG } from '../../config/app'
import { useData } from '../../data/store'
import { setInvoiceStatus } from '../../data/actions'
import { invoiceTotal } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import { formatDate, todayISO } from '../../lib/dates'
import { formatMoney, lineTotal } from '../../lib/money'
import type { InvoiceStatus } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { NotFoundPage } from '../../app/RouteError'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const { state, perms, commit } = useData()
  const canManage = perms.canManageInvoices
  const run = useAction()
  const [target, setTarget] = useState<InvoiceStatus | null>(null)
  const inv = state.invoices.find((i) => i.id === id)
  if (!inv) return <NotFoundPage title="Invoice not found" />

  const total = invoiceTotal(inv)
  const org = state.organization
  const pastDue = inv.dueDate < todayISO()

  const copy: Partial<Record<InvoiceStatus, { title: string; message: string; label: string; tone: 'primary' | 'success' | 'danger' }>> = {
    Sent: { title: `Mark ${inv.number} as sent?`, message: 'Records that the invoice was issued to the customer. No email is sent from the demo.', label: 'Mark as sent', tone: 'primary' },
    Paid: { title: `Record payment for ${inv.number}?`, message: `Records full payment of ${formatMoney(total)} received today. Revenue and transactions update immediately.`, label: 'Record payment', tone: 'success' },
    Overdue: { title: `Mark ${inv.number} as overdue?`, message: 'Flags the invoice for follow-up on the dashboard.', label: 'Mark overdue', tone: 'danger' },
  }

  return (
    <>
      <PageHeader
        title={inv.number}
        meta={<StatusBadge status={inv.status} />}
        description={`${inv.customer.name} · issued ${formatDate(inv.issueDate)}`}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print / PDF
            </Button>
            {canManage && inv.status === 'Draft' && (
              <Button icon={<Send className="size-4" />} onClick={() => setTarget('Sent')}>
                Mark as sent
              </Button>
            )}
            {canManage && inv.status === 'Sent' && pastDue && (
              <Button variant="secondary" icon={<AlertTriangle className="size-4 text-rose-600" />} onClick={() => setTarget('Overdue')}>
                Mark overdue
              </Button>
            )}
            {canManage && (inv.status === 'Sent' || inv.status === 'Overdue') && (
              <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={() => setTarget('Paid')}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <article className="print-area mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 font-bold text-ink-950">{org.shortName.slice(0, 1)}</span>
              <div>
                <p className="text-lg font-semibold text-slate-900">{org.name}</p>
                <p className="text-xs text-slate-500">{org.industry}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{org.address}</p>
            <p className="text-sm text-slate-600">
              {org.email} · {org.phone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">INVOICE</p>
            <p className="mt-1 font-mono text-sm text-slate-600">{inv.number}</p>
            <div className="mt-2">
              <StatusBadge status={inv.status} />
            </div>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Bill to</p>
            <p className="mt-1 font-medium text-slate-900">{inv.customer.name}</p>
            <p className="text-sm text-slate-600">{inv.customer.address}</p>
            <p className="text-sm text-slate-600">{inv.customer.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Issue date</p>
            <p className="mt-1 text-sm text-slate-900">{formatDate(inv.issueDate)}</p>
            <p className="mt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Due date</p>
            <p className={pastDue && inv.status !== 'Paid' ? 'mt-1 text-sm font-medium text-rose-700' : 'mt-1 text-sm text-slate-900'}>{formatDate(inv.dueDate)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Amount due</p>
            <p className="tabular mt-1 text-2xl font-semibold text-slate-900">{inv.status === 'Paid' ? formatMoney(0) : formatMoney(total)}</p>
            {inv.paidDate && <p className="mt-1 text-sm text-emerald-700">Paid on {formatDate(inv.paidDate)}</p>}
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-3 py-2.5 text-left">Description</th>
                <th scope="col" className="px-3 py-2.5 text-right">Qty</th>
                <th scope="col" className="px-3 py-2.5 text-right">Unit price</th>
                <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-3 text-slate-800">{l.description}</td>
                  <td className="tabular px-3 py-3 text-right">{l.quantity}</td>
                  <td className="tabular px-3 py-3 text-right">{formatMoney(l.unitPriceMinor)}</td>
                  <td className="tabular px-3 py-3 text-right font-medium text-slate-900">{formatMoney(lineTotal(l.quantity, l.unitPriceMinor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd className="tabular">{formatMoney(total)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Tax</dt>
              <dd>Not calculated (demo)</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <dt>Total ({APP_CONFIG.currency})</dt>
              <dd className="tabular">{formatMoney(total)}</dd>
            </div>
          </dl>
        </div>

        {inv.notes && <p className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">{inv.notes}</p>}
        <p className="mt-4 text-center text-[11px] tracking-wide text-slate-400 uppercase">Demonstration document · fictional data · not a tax invoice</p>
      </article>

      {target && copy[target] && (
        <ConfirmDialog
          open
          onClose={() => setTarget(null)}
          title={copy[target]!.title}
          message={copy[target]!.message}
          confirmLabel={copy[target]!.label}
          tone={copy[target]!.tone}
          onConfirm={() => {
            const status = target
            const ok = run(() => commit((s) => setInvoiceStatus(s, inv.id, status)), { title: `${inv.number} updated`, description: `Status is now ${status}.` })
            if (ok) setTarget(null)
          }}
        />
      )}
    </>
  )
}
