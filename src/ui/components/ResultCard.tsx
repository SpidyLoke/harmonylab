// After a take: score, cents, the notes that went wrong, and one tip.

import { useEffect, useRef, type ReactNode } from 'react'
import type { NoteProblem, TakeResult } from '../../scoring/score'

const PROBLEM_LABEL: Record<NoteProblem, { icon: string; text: string }> = {
  ok: { icon: '✓', text: 'fine' },
  sharp: { icon: '▼', text: 'sharp' },
  flat: { icon: '▲', text: 'flat' },
  slidToMelody: { icon: '⇄', text: 'slid to melody' },
  missed: { icon: '○', text: 'not sung' },
  unsteady: { icon: '〰', text: 'wobbly' },
}

export function ResultCard({
  result,
  heading,
  verdict,
  actions,
}: {
  result: TakeResult
  heading?: string
  verdict?: ReactNode
  actions?: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  // Bring the result into view when a take finishes.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result])
  const pct = Math.round(result.percentInTune)
  const band = pct >= 80 ? 'text-good' : pct >= 60 ? 'text-near' : 'text-bad'
  const bandWord = pct >= 80 ? 'Great' : pct >= 60 ? 'Getting there' : 'Keep at it'
  return (
    <section ref={ref} className="mt-6 scroll-mb-24 rounded-3xl border border-line bg-surface p-5 shadow-xl" aria-live="polite" data-testid="result-card">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">{heading ?? 'Your take'}</div>
          <div className={`text-5xl font-bold tabular-nums ${band}`} data-testid="result-score">
            {pct}%
          </div>
          <div className="text-sm text-muted">
            of the time in tune · <span className={band}>{bandWord}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted">Average off</div>
          <div className="text-3xl font-semibold tabular-nums">{result.averageCentsOff} cents</div>
        </div>
      </div>
      {verdict && <div className="mt-4">{verdict}</div>}
      {result.wrongNotes.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted">Notes to work on</div>
          <ul className="flex flex-wrap gap-2">
            {result.wrongNotes.slice(0, 10).map((w, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-sm">
                <b>{w.name}</b>{' '}
                <span className="text-muted">
                  <span aria-hidden>{PROBLEM_LABEL[w.problem].icon}</span> {PROBLEM_LABEL[w.problem].text}
                  {(w.problem === 'sharp' || w.problem === 'flat') && ` (${w.cents > 0 ? '+' : ''}${w.cents})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 rounded-2xl border border-spot/30 bg-spot/10 p-4 text-sm" data-testid="result-tip">
        <b>Tip:</b> {result.tip}
      </p>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}
