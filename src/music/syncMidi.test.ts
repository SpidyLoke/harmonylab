import { describe, expect, it } from 'vitest'
import { candidateStretches, syncMidiToAudio } from './syncMidi'

const SR = 22050

/** A "recording": a click wherever the MIDI has a note, starting `offset` s in, played `stretch` times slower. */
function render(onsets: number[], offset: number, stretch: number, seconds: number): Float32Array {
  const out = new Float32Array(SR * seconds)
  // Some noise so silence isn't perfectly flat.
  let seed = 3
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647
    out[i] = (seed / 2147483647 - 0.5) * 0.002
  }
  for (const o of onsets) {
    const i0 = Math.round((offset + o * stretch) * SR)
    for (let i = 0; i < 300 && i0 + i < out.length; i++) out[i0 + i] += 0.6 * Math.exp(-i / 50) * Math.sin(i * 0.7)
  }
  return out
}

// An irregular, song-like rhythm (so only one alignment fits).
const rhythm = [0, 0.5, 0.75, 1.5, 2, 3, 3.25, 3.5, 4.5, 5, 6, 6.75, 7, 8, 8.5, 9.5, 10, 11, 11.25, 12, 13.5, 14, 15, 15.5]

describe('syncMidiToAudio', () => {
  it('finds the offset of a recording that starts with an intro', () => {
    const r = syncMidiToAudio(rhythm, render(rhythm, 3.4, 1, 25), SR)
    expect(Math.abs(r.offsetSec - 3.4)).toBeLessThan(0.03)
    expect(r.confidence).toBeGreaterThan(0.3)
  })

  it('finds a small tempo difference', () => {
    const r = syncMidiToAudio(rhythm, render(rhythm, 1.2, 1.02, 25), SR, { stretches: candidateStretches(100, 98) })
    expect(Math.abs(r.offsetSec - 1.2)).toBeLessThan(0.04)
    expect(Math.abs(r.stretch - 1.02)).toBeLessThan(0.006)
  })

  it('offers stretches near the tempo ratio, including half and double time', () => {
    expect(candidateStretches(120, null)).toEqual([1])
    expect(candidateStretches(120, 60).some((k) => Math.abs(k - 1) < 0.001)).toBe(true)
    expect(candidateStretches(100, 98).some((k) => Math.abs(k - 100 / 98) < 0.003)).toBe(true)
  })
})
