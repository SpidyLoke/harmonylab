import { describe, expect, it } from 'vitest'
import { EAR_DRILLS, sungCorrect } from './drills'

describe('ear drills', () => {
  it('accept a sung note within 50 cents in any octave', () => {
    expect(sungCorrect(64.3, 64)).toBe(true)
    expect(sungCorrect(52.2, 64)).toBe(true)
    expect(sungCorrect(64.6, 64)).toBe(false)
    expect(sungCorrect(63, 64)).toBe(false)
  })

  for (const d of EAR_DRILLS) {
    it(`${d.title}: questions stay in range and have a valid answer`, () => {
      for (const core of [true, false]) {
        for (const item of d.items(core)) {
          for (let k = 0; k < 20; k++) {
            const q = d.make(item, 48, 64, core)
            if (q.answer.type === 'sing') {
              expect(q.answer.targetMidi).toBeGreaterThanOrEqual(48 - 1)
              expect(q.answer.targetMidi).toBeLessThanOrEqual(64 + 1)
            } else {
              expect(q.answer.options.map((o) => o.value)).toContain(q.answer.correct)
            }
          }
        }
      }
    })
  }
})
