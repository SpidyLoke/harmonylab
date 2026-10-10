import { describe, expect, it } from 'vitest'
import { BUILT_IN_SONGS } from './songs'

describe('built-in songs', () => {
  for (const s of BUILT_IN_SONGS) {
    it(`${s.title} is 8 full bars with chords covering it`, () => {
      const end = s.melody.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
      expect(end).toBeLessThanOrEqual(32)
      expect(end).toBeGreaterThan(28)
      // Notes never overlap.
      for (let i = 1; i < s.melody.length; i++) {
        expect(s.melody[i].start).toBeGreaterThanOrEqual(s.melody[i - 1].start + s.melody[i - 1].dur - 1e-9)
      }
      const chordEnd = s.chords.reduce((m, c) => Math.max(m, c.start + c.dur), 0)
      expect(chordEnd).toBe(32)
    })
  }
})
