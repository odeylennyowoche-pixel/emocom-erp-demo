import { useEffect, useState } from 'react'
import { useData } from '../../data/store'
import { saveAppraisal } from '../../data/workActions'
import { fullName } from '../../data/selectors'
import { useAction } from '../../hooks/useAction'
import type { Appraisal, KPI } from '../../types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Textarea } from '../../components/ui/Form'
import { Rating } from '../../components/ui/Progress'
import { cn } from '../../lib/utils'

const SCORE_LABELS = ['', 'Below expectations', 'Partly meets', 'Meets', 'Exceeds', 'Outstanding']

/** KPI scoring form. Read-only when completed or when the viewer is not the reviewer/HR. */
export function AppraisalModal({ appraisal, onClose }: { appraisal: Appraisal | null; onClose: () => void }) {
  const { state, perms, commit } = useData()
  const run = useAction()
  const [kpis, setKpis] = useState<KPI[]>([])
  const [comments, setComments] = useState('')
  useEffect(() => {
    if (appraisal) {
      setKpis(appraisal.kpis.map((k) => ({ ...k })))
      setComments(appraisal.comments ?? '')
    }
  }, [appraisal])
  if (!appraisal) return null
  const emp = state.employees.find((e) => e.id === appraisal.employeeId)
  const editable = appraisal.status !== 'Completed' && (appraisal.reviewerId === perms.user.employeeId || perms.canManageHR)
  const save = (complete: boolean) => {
    if (run(() => commit((s) => saveAppraisal(s, appraisal.id, kpis, comments.trim(), complete)), { title: complete ? 'Appraisal completed' : 'Appraisal saved' })) onClose()
  }
  return (
    <Modal
      open={!!appraisal}
      onClose={onClose}
      size="lg"
      title={`${appraisal.period} appraisal — ${fullName(emp)}`}
      description={`${emp?.jobTitle ?? ''} · Reviewer: ${fullName(state.employees.find((e) => e.id === appraisal.reviewerId))} · ${appraisal.status}`}
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={() => save(false)}>
              Save draft
            </Button>
            <Button onClick={() => save(true)}>Complete appraisal</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-3">KPI</th>
              <th className="py-2 pr-3">Target</th>
              <th className="py-2 pr-3 text-right">Weight</th>
              <th className="py-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kpis.map((k, i) => (
              <tr key={k.name}>
                <td className="py-2.5 pr-3 font-medium text-slate-800">{k.name}</td>
                <td className="py-2.5 pr-3 text-slate-600">{k.target}</td>
                <td className="tabular py-2.5 pr-3 text-right text-slate-600">{k.weight}%</td>
                <td className="py-2.5">
                  {editable ? (
                    <div className="flex gap-1" role="radiogroup" aria-label={`Score for ${k.name}`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          role="radio"
                          aria-checked={k.score === n}
                          title={SCORE_LABELS[n]}
                          onClick={() => setKpis((ks) => ks.map((x, j) => (j === i ? { ...x, score: n } : x)))}
                          className={cn('size-7 rounded-md text-xs font-semibold ring-1', k.score === n ? 'bg-ink-900 text-brand-500 ring-ink-900' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50')}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Rating value={k.score} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && <p className="text-xs text-slate-500">1 = below expectations · 3 = meets · 5 = outstanding</p>}
        {appraisal.overall && !editable && (
          <p className="text-sm">
            Overall rating: <span className="font-semibold">{appraisal.overall.toFixed(1)} / 5</span>
          </p>
        )}
        <Field label="Comments">
          {(id) => <Textarea id={id} value={comments} disabled={!editable} onChange={(e) => setComments(e.target.value)} placeholder="Strengths, development areas and agreed actions" />}
        </Field>
      </div>
    </Modal>
  )
}
