import { describe, expect, it } from 'vitest'
import { estimateTempo, framesToNotes, quantize, type PitchFrame } from './transcribe'

const HOP = 0.005

/** Builds a pitch track: [midi or null, seconds][] with a little scoop and wobble. */
function track(parts: [number | null, number][], scoop = true): PitchFrame[] {
  const frames: PitchFrame[] = []
  let t = 0
  for (const [midi, secs] of parts) {
    const n = Math.round(secs / HOP)
    for (let i = 0; i < n; i++) {
      let m: number | null = midi
      if (m !== null) {
        if (scoop && i < 8) m -= 0.5 * (1 - i / 8)
        m += 0.1 * Math.sin(i / 6)
      }
      frames.push({ t, midi: m })
      t += HOP
    }
  }
  return frames
}

describe('framesToNotes', () => {
  it('finds separate notes split by breaths', () => {
    const notes = framesToNotes(track([[60, 0.4], [null, 0.1], [64, 0.4], [null, 0.1], [67, 0.6]]))
    expect(notes.map((x) => x.midi)).toEqual([60, 64, 67])
    expect(notes[0].startSec).toBeCloseTo(0, 1)
    expect(notes[2].endSec - notes[2].startSec).toBeCloseTo(0.6, 1)
  })

  it('splits a legato slide into two notes without a gap', () => {
    const notes = framesToNotes(track([[62, 0.5], [65, 0.5]], false))
    expect(notes.map((x) => x.midi)).toEqual([62, 65])
  })

  it('ignores blips and a one-frame glitch', () => {
    const frames = track([[60, 0.6]])
    frames[40].midi = 72
    frames.push(...track([[null, 0.1], [70, 0.04]]).map((f) => ({ ...f, t: f.t + 0.6 })))
    expect(framesToNotes(frames).map((x) => x.midi)).toEqual([60])
  })

  it('merges a note split by a tiny dropout', () => {
    const notes = framesToNotes(track([[60, 0.3], [null, 0.03], [60, 0.3]], false))
    expect(notes).toHaveLength(1)
  })
})

describe('quantize', () => {
  it('snaps to the beat grid at the given tempo', () => {
    const notes = quantize(
      [
        { startSec: 1.02, endSec: 1.48, midi: 60 },
        { startSec: 1.51, endSec: 2.47, midi: 62 },
      ],
      120,
      1.0,
    )
    expect(notes).toEqual([
      { start: 0, dur: 1, midi: 60 },
      { start: 1, dur: 2, midi: 62 },
    ])
  })

  it('trims overlaps and keeps a minimum length', () => {
    const notes = quantize(
      [
        { startSec: 0, endSec: 0.6, midi: 60 },
        { startSec: 0.5, endSec: 0.52, midi: 62 },
      ],
      120,
      0,
    )
    expect(notes[0].dur).toBe(1)
    expect(notes[1]).toEqual({ start: 1, dur: 0.25, midi: 62 })
  })
})

describe('estimateTempo', () => {
  it('recovers 96 bpm from onsets on beats and half-beats', () => {
    const beat = 60 / 96
    const onsets = [0, 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7, 8].map((b) => 0.4 + b * beat + (b % 2 ? 0.01 : -0.01))
    const { bpm, originSec } = estimateTempo(onsets)
    expect(bpm).toBeGreaterThan(94)
    expect(bpm).toBeLessThan(98)
    expect(Math.abs(((originSec - 0.4) / beat) % 0.5)).toBeLessThan(0.1)
  })
})
