import { describe, expect, it } from 'vitest'
import { findOnsets, matchOffsets, median } from './checks'

describe('latency helpers', () => {
  it('finds claps as loudness jumps', () => {
    const frames = []
    for (let t = 0; t < 3; t += 0.005) {
      const sinceClap = [0.5, 1.2, 2.0].map((c) => t - c).filter((d) => d >= 0 && d < 0.05)
      frames.push({ t, db: sinceClap.length ? -12 : -58 })
    }
    const on = findOnsets(frames)
    expect(on).toHaveLength(3)
    on.forEach((o, i) => expect(Math.abs(o - [0.5, 1.2, 2.0][i])).toBeLessThan(0.011))
  })

  it('matches claps to clicks and takes the median offset', () => {
    const clicks = [1, 2, 3, 4, 5]
    const claps = [1.12, 2.1, 3.15, 4.11, 7]
    const offs = matchOffsets(clicks, claps)
    expect(offs).toHaveLength(4)
    expect(median(offs)).toBeCloseTo(0.115, 3)
  })
})
