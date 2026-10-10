import { describe, expect, it } from 'vitest'
import { scoreTake, type ScoreFrame, type TimedTarget } from './score'
import { slidToMelody } from './drift'

const HOP = 0.005

/** Frames from `from` to `to` seconds with pitch given by fn(t). */
function frames(from: number, to: number, fn: (t: number) => number | null): ScoreFrame[] {
  const out: ScoreFrame[] = []
  for (let t = from; t < to; t += HOP) out.push({ t, midi: fn(t) })
  return out
}

const twoNotes: TimedTarget[] = [
  { startSec: 0, endSec: 1, midi: 64 },
  { startSec: 1, endSec: 2, midi: 67 },
]
const melody: TimedTarget[] = [
  { startSec: 0, endSec: 1, midi: 60 },
  { startSec: 1, endSec: 2, midi: 64 },
]
const target = (t: number) => (t < 1 ? 64 : 67)

describe('scoreTake', () => {
  it('scores a perfect take at 100% with zero cents off', () => {
    const r = scoreTake({ frames: frames(0, 2, target), targets: twoNotes, toleranceCents: 30 })
    expect(r.percentInTune).toBeGreaterThan(99)
    expect(r.averageCentsOff).toBe(0)
    expect(r.wrongNotes).toEqual([])
  })

  it('scores 0% when a semitone off everywhere and reports sharp', () => {
    const r = scoreTake({ frames: frames(0, 2, (t) => target(t) + 1), targets: twoNotes, toleranceCents: 30 })
    expect(r.percentInTune).toBe(0)
    expect(r.averageCentsOff).toBe(100)
    expect(r.wrongNotes.map((w) => w.problem)).toEqual(['sharp', 'sharp'])
  })

  it('respects tolerance: 20 cents flat passes at ±30, fails at ±15', () => {
    const f = frames(0, 2, (t) => target(t) - 0.2)
    expect(scoreTake({ frames: f, targets: twoNotes, toleranceCents: 30 }).percentInTune).toBeGreaterThan(99)
    const strict = scoreTake({ frames: f, targets: twoNotes, toleranceCents: 15 })
    expect(strict.percentInTune).toBe(0)
    expect(strict.wrongNotes[0].problem).toBe('flat')
  })

  it('ignores the scoop in the grace window', () => {
    const scoop = (t: number) => {
      const start = t < 1 ? 0 : 1
      return t - start < 0.1 ? target(t) - 1 : target(t)
    }
    expect(scoreTake({ frames: frames(0, 2, scoop), targets: twoNotes, toleranceCents: 30 }).percentInTune).toBeGreaterThan(99)
  })

  it('does not punish a short breath', () => {
    const breath = (t: number) => (t > 0.8 && t < 0.95 ? null : target(t))
    expect(scoreTake({ frames: frames(0, 2, breath), targets: twoNotes, toleranceCents: 30 }).percentInTune).toBeGreaterThan(99)
  })

  it('does punish long silence, and calls a silent note missed', () => {
    const silentSecond = (t: number) => (t >= 1 ? null : target(t))
    const r = scoreTake({ frames: frames(0, 2, silentSecond), targets: twoNotes, toleranceCents: 30 })
    expect(r.percentInTune).toBeLessThan(60)
    expect(r.wrongNotes).toEqual([{ name: 'G4', problem: 'missed', cents: 0 }])
  })

  it('applies the latency offset', () => {
    const late = frames(0, 2.2, (t) => (t < 0.2 ? null : target(t - 0.2)))
    const without = scoreTake({ frames: late, targets: twoNotes, toleranceCents: 30 })
    const withLatency = scoreTake({ frames: late, targets: twoNotes, toleranceCents: 30, latencySec: 0.2 })
    expect(withLatency.percentInTune).toBeGreaterThan(99)
    expect(withLatency.percentInTune).toBeGreaterThan(without.percentInTune)
  })

  it('names a slide onto the melody', () => {
    const slide = (t: number) => (t < 1 ? 64 : 64) // second note: singer stays on the melody's E
    const r = scoreTake({ frames: frames(0, 2, slide), targets: twoNotes, melody, toleranceCents: 30 })
    expect(r.slidToMelodyCount).toBe(1)
    expect(r.wrongNotes).toEqual([{ name: 'G4', problem: 'slidToMelody', cents: -300 }])
    expect(r.tip).toMatch(/slid to the melody/)
  })

  it('calls a wobbling but centred note unsteady', () => {
    const wobble = (t: number) => target(t) + 0.8 * Math.sin(t * 2 * Math.PI * 3)
    const r = scoreTake({ frames: frames(0, 2, wobble), targets: twoNotes, toleranceCents: 15 })
    expect(r.wrongNotes.map((w) => w.problem)).toContain('unsteady')
  })

  it('gives a sharp tip when consistently sharp', () => {
    const r = scoreTake({ frames: frames(0, 2, (t) => target(t) + 0.45), targets: twoNotes, toleranceCents: 30 })
    expect(r.tip).toMatch(/sharp/)
  })

  it('gives a flat tip when consistently flat', () => {
    const r = scoreTake({ frames: frames(0, 2, (t) => target(t) - 0.45), targets: twoNotes, toleranceCents: 30 })
    expect(r.tip).toMatch(/flat/)
  })

  it('handles an empty take without dividing by zero', () => {
    const r = scoreTake({ frames: [], targets: twoNotes, toleranceCents: 30 })
    expect(r.percentInTune).toBe(0)
    expect(Number.isFinite(r.averageCentsOff)).toBe(true)
  })
})

describe('slidToMelody (live)', () => {
  it('fires when sitting on the melody note', () => {
    expect(slidToMelody(new Array(40).fill(60.05), 64, 60, 30)).toBe(true)
  })
  it('does not fire on the right note, in silence, or when parts are the same', () => {
    expect(slidToMelody(new Array(40).fill(64), 64, 60, 30)).toBe(false)
    expect(slidToMelody(new Array(40).fill(null), 64, 60, 30)).toBe(false)
    expect(slidToMelody(new Array(40).fill(60), 60, 60, 30)).toBe(false)
  })
})
