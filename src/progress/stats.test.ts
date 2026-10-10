import { describe, expect, it } from 'vitest'
import { accuracyTrend, exerciseHistory, streak, totalMinutes, weakestIntervals } from './stats'
import type { Attempt } from '../db/schema'

const a = (p: Partial<Attempt>): Attempt => ({ at: 0, day: '2026-10-10', kind: 'curriculum', exerciseId: 'x', title: 'X', score: 50, avgCents: 10, seconds: 60, ...p })

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10')).toBe(3)
  })
  it('still counts when today has no practice yet', () => {
    expect(streak(['2026-10-08', '2026-10-09'], '2026-10-10')).toBe(2)
  })
  it('breaks on a missed day and crosses month ends', () => {
    expect(streak(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03'], '2026-10-03')).toBe(1)
    expect(streak(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2)
    expect(streak([], '2026-10-01')).toBe(0)
  })
})

describe('totals and trend', () => {
  it('sums minutes', () => {
    expect(totalMinutes([a({ seconds: 90 }), a({ seconds: 30 })])).toBe(2)
  })
  it('averages per day, sung takes only, oldest first', () => {
    const t = accuracyTrend([
      a({ day: '2026-10-09', score: 60 }),
      a({ day: '2026-10-08', score: 40 }),
      a({ day: '2026-10-09', score: 80 }),
      a({ day: '2026-10-09', kind: 'ear', score: 0 }),
    ])
    expect(t).toEqual([
      { day: '2026-10-08', accuracy: 40, takes: 1 },
      { day: '2026-10-09', accuracy: 70, takes: 2 },
    ])
  })
})

describe('weakest intervals', () => {
  it('ranks by accuracy and ignores thin data', () => {
    const rows = [
      ...[1, 2, 3].map(() => a({ intervals: { 'Third above': [9, 10] } })),
      ...[1, 2, 3].map(() => a({ intervals: { 'Sixth below': [4, 10] } })),
      a({ intervals: { 'Octave above': [0, 10] } }),
    ]
    expect(weakestIntervals(rows).map((x) => x.label)).toEqual(['Sixth below', 'Third above'])
  })
})

describe('exercise history', () => {
  it('keeps best and last per exercise, most recent first', () => {
    const h = exerciseHistory([
      a({ exerciseId: 'd1', at: 1, score: 70 }),
      a({ exerciseId: 'd1', at: 3, score: 60 }),
      a({ exerciseId: 'd2', at: 2, score: 90 }),
    ])
    expect(h.map((x) => [x.exerciseId, x.best, x.last, x.count])).toEqual([
      ['d1', 70, 60, 2],
      ['d2', 90, 90, 1],
    ])
  })
})
