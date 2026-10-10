// Progress numbers for the dashboard, computed from saved attempts.

import type { Attempt } from '../db/schema'

/** Consecutive days with practice, ending today (or yesterday, if today has none yet). */
export function streak(days: string[], today: string): number {
  const set = new Set(days)
  let d = new Date(`${today}T12:00:00`)
  if (!set.has(today)) d = new Date(d.getTime() - 86_400_000)
  let n = 0
  for (;;) {
    const key = fmt(d)
    if (!set.has(key)) return n
    n++
    d = new Date(d.getTime() - 86_400_000)
  }
}

function fmt(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function totalMinutes(attempts: Attempt[]): number {
  return Math.round(attempts.reduce((s, a) => s + a.seconds, 0) / 60)
}

export interface DayAccuracy {
  day: string
  /** Mean in-tune % of sung takes that day (ear rounds excluded). */
  accuracy: number
  takes: number
}

/** Daily average accuracy of sung takes, oldest first, last `days` days with practice. */
export function accuracyTrend(attempts: Attempt[], days = 30): DayAccuracy[] {
  const by = new Map<string, number[]>()
  for (const a of attempts) {
    if (a.kind === 'ear') continue
    ;(by.get(a.day) ?? by.set(a.day, []).get(a.day)!).push(a.score)
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([day, scores]) => ({ day, accuracy: scores.reduce((s, x) => s + x, 0) / scores.length, takes: scores.length }))
}

export interface IntervalStat {
  label: string
  accuracy: number
  samples: number
}

/** Interval accuracy across curriculum takes and ear rounds, weakest first. */
export function weakestIntervals(attempts: Attempt[], min = 3): IntervalStat[] {
  const tot = new Map<string, [number, number, number]>() // hits, total, samples
  for (const a of attempts) {
    for (const [label, [h, t]] of Object.entries(a.intervals ?? {})) {
      const cur = tot.get(label) ?? [0, 0, 0]
      tot.set(label, [cur[0] + h, cur[1] + t, cur[2] + 1])
    }
  }
  return [...tot.entries()]
    .filter(([, [, t, n]]) => t > 0 && n >= min)
    .map(([label, [h, t, n]]) => ({ label, accuracy: (100 * h) / t, samples: n }))
    .sort((a, b) => a.accuracy - b.accuracy)
}

export interface ExerciseHistory {
  exerciseId: string
  title: string
  kind: Attempt['kind']
  best: number
  last: number
  count: number
  lastAt: number
}

export function exerciseHistory(attempts: Attempt[]): ExerciseHistory[] {
  const by = new Map<string, ExerciseHistory>()
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    const cur = by.get(a.exerciseId)
    by.set(a.exerciseId, {
      exerciseId: a.exerciseId,
      title: a.title,
      kind: a.kind,
      best: Math.max(cur?.best ?? 0, a.score),
      last: a.score,
      count: (cur?.count ?? 0) + 1,
      lastAt: a.at,
    })
  }
  return [...by.values()].sort((a, b) => b.lastAt - a.lastAt)
}
