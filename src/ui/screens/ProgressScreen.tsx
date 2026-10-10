// Dashboard: level, streak, minutes, accuracy trend, weakest intervals,
// per-exercise history, and backup.

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { db } from '../../db/schema'
import { localDay } from '../../db/repo'
import { accuracyTrend, exerciseHistory, streak, totalMinutes, weakestIntervals } from '../../progress/stats'
import { TrendChart } from '../components/TrendChart'
import { BackupPanel } from '../components/BackupPanel'

const KIND_LABEL = { curriculum: 'Drill', ear: 'Ear', song: 'Song', warmup: 'Warm-up', placement: 'Placement' } as const

export function ProgressScreen() {
  const attempts = useLiveQuery(() => db.attempts.toArray(), []) ?? []
  const levels = useLiveQuery(() => db.levels.toArray(), []) ?? []
  const [showAll, setShowAll] = useState(false)
  const level = Math.max(1, ...levels.filter((l) => l.unlocked).map((l) => l.level))
  const passed = levels.filter((l) => l.passed).length
  const days = [...new Set(attempts.map((a) => a.day))]
  const weak = weakestIntervals(attempts).slice(0, 5)
  const history = exerciseHistory(attempts)

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Progress</h1>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Current level" value={String(level)} sub={`${passed} of 10 passed`} />
        <Tile label="Daily streak" value={String(streak(days, localDay()))} sub="days in a row" />
        <Tile label="Practice time" value={String(totalMinutes(attempts))} sub="minutes in total" />
        <Tile label="Takes" value={String(attempts.length)} sub="sung and ear rounds" />
      </dl>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Accuracy over time</h2>
        <p className="mb-3 text-sm text-muted">Average % of time in tune per practice day, last 30 days you practised.</p>
        <TrendChart data={accuracyTrend(attempts)} />
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Weakest intervals</h2>
        <p className="mb-3 text-sm text-muted">From interval drills and ear training. Today's session leans on these.</p>
        {weak.length === 0 ? (
          <p className="text-muted">Not enough data yet: a few interval drills or ear rounds will fill this in.</p>
        ) : (
          <ul className="space-y-2.5" aria-label="Weakest intervals, accuracy">
            {weak.map((w) => (
              <li key={w.label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{w.label}</span>
                <span className="h-5 rounded-r bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-r bg-spot" style={{ width: `${Math.max(2, w.accuracy)}%` }} />
                </span>
                <span className="text-right tabular-nums">{Math.round(w.accuracy)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Exercise history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted">
            Nothing yet. Start with <Link to="/" className="text-spot underline">today's session</Link>.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 font-medium">Exercise</th>
                  <th className="hidden py-2 font-medium sm:table-cell">Type</th>
                  <th className="py-2 text-right font-medium">Best</th>
                  <th className="py-2 text-right font-medium">Last</th>
                  <th className="py-2 text-right font-medium">Times</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? history : history.slice(0, 12)).map((h) => (
                  <tr key={h.exerciseId} className="border-t border-line">
                    <td className="py-2 pr-2">{h.title}</td>
                    <td className="hidden py-2 text-muted sm:table-cell">{KIND_LABEL[h.kind]}</td>
                    <td className="py-2 text-right">{Math.round(h.best)}%</td>
                    <td className="py-2 text-right">{Math.round(h.last)}%</td>
                    <td className="py-2 text-right">{h.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length > 12 && (
              <button className="mt-2 min-h-11 text-sm text-spot" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${history.length}`}
              </button>
            )}
          </div>
        )}
      </section>

      <BackupPanel />
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1 text-4xl font-bold tabular-nums">{value}</dd>
      <dd className="text-sm text-muted">{sub}</dd>
    </div>
  )
}
