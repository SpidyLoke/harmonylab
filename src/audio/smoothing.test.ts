import { describe, expect, it } from 'vitest'
import { MedianSmoother } from './smoothing'

describe('MedianSmoother', () => {
  it('removes a single-frame octave jump', () => {
    const s = new MedianSmoother()
    const out = [57, 57.05, 69.02, 57.1, 57].map((m) => s.push(m))
    expect(out[3]).toBeCloseTo(57.1, 6)
    expect(Math.max(...(out.slice(2) as number[]))).toBeLessThan(58)
  })

  it('passes silence through as null', () => {
    const s = new MedianSmoother()
    s.push(60)
    expect(s.push(null)).toBeNull()
  })

  it('survives a short dropout inside a note but resets after a real gap', () => {
    const s = new MedianSmoother(2)
    ;[60, 60, 60].forEach((m) => s.push(m))
    s.push(null)
    expect(s.push(72)).toBe(60) // history kept: median of [60, 60, 72]
    const t = new MedianSmoother(2)
    ;[60, 60, 60].forEach((m) => t.push(m))
    t.push(null)
    t.push(null)
    t.push(null)
    expect(t.push(72)).toBe(72) // history cleared: a new note starts clean
  })
})
