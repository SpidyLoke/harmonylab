import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { PLACEMENT_TASKS, placementLevel } from './placement'
import { fitPieceToRange } from '../music/transpose'

describe('curriculum', () => {
  it('has ten levels in order, each with drills and an explainer', () => {
    expect(LEVELS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const l of LEVELS) {
      expect(l.drills.length).toBeGreaterThan(0)
      const words = l.explainer.join(' ').split(/\s+/).length
      expect(words, `level ${l.n} explainer`).toBeLessThan(220) // about a minute to read
    }
  })

  it('every drill builds a piece whose part fits a low and a high voice', () => {
    const ids = new Set<string>()
    for (const l of LEVELS) {
      for (const d of l.drills) {
        expect(ids.has(d.id)).toBe(false)
        ids.add(d.id)
        const p = d.build()
        expect(p.target.length).toBeGreaterThan(0)
        expect(p.lengthBeats).toBeGreaterThanOrEqual(Math.max(...p.target.map((n) => n.start + n.dur)))
        for (const [low, high] of [[43, 62], [55, 79]]) {
          const fit = fitPieceToRange(p, low, high).piece
          const span = Math.max(...p.target.map((n) => n.midi)) - Math.min(...p.target.map((n) => n.midi))
          if (span <= high - low) {
            fit.target.forEach((n) => {
              expect(n.midi).toBeGreaterThanOrEqual(low)
              expect(n.midi).toBeLessThanOrEqual(high)
            })
          }
        }
      }
    }
  })

  it('drone drills put the target at the stated interval', () => {
    const l3 = LEVELS[2].drills.map((d) => d.build())
    expect(l3.map((p) => p.target[0].midi - p.melody[0].midi)).toEqual([12, 7, 4, 9])
    const l4 = LEVELS[3].drills.map((d) => d.build())
    expect(l4.map((p) => p.target[0].midi - p.melody[0].midi)).toEqual([-12, -7, -4, -9])
  })
})

describe('placement', () => {
  it('has five tasks', () => expect(PLACEMENT_TASKS).toHaveLength(5))
  it('counts passes in a row, capped at level 5', () => {
    expect(placementLevel([])).toBe(1)
    expect(placementLevel([50])).toBe(1)
    expect(placementLevel([90, 80, 40])).toBe(3)
    expect(placementLevel([90, 40, 95, 95])).toBe(2)
    expect(placementLevel([90, 90, 90, 90, 90])).toBe(5)
  })
})
