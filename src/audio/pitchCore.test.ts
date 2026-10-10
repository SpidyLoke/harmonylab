import { describe, expect, it } from 'vitest'
import { PitchCore, windowSizeFor } from './pitchCore'
import { hzToMidi } from '../music/notes'

const SR = 48000

function tone(hz: number, seconds: number, partials = [1], amp = 0.3, vibratoCents = 0): Float32Array {
  const n = Math.round(SR * seconds)
  const out = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const vib = vibratoCents ? Math.pow(2, (vibratoCents * Math.sin((2 * Math.PI * 5.5 * i) / SR)) / 1200) : 1
    phase += (2 * Math.PI * hz * vib) / SR
    let v = 0
    partials.forEach((a, k) => (v += a * Math.sin(phase * (k + 1))))
    out[i] = (amp * v) / partials.reduce((x, y) => x + y, 0)
  }
  return out
}

/** Feed in 128-sample blocks like the audio thread does; return every reading. */
function run(signal: Float32Array) {
  const core = new PitchCore(SR)
  const readings = []
  for (let i = 0; i + 128 <= signal.length; i += 128) {
    core.push(signal.subarray(i, i + 128))
    if ((i / 128) % 2 === 1 && core.ready) readings.push(core.analyse())
  }
  return readings
}

const centsErr = (hz: number, ref: number) => Math.abs(hzToMidi(hz) - hzToMidi(ref)) * 100

describe('PitchCore', () => {
  it('uses a ~24 ms window', () => {
    expect(windowSizeFor(48000)).toBe(1152)
    expect(windowSizeFor(44100)).toBe(1058)
  })

  it.each([77.78, 82.41, 110, 220, 440, 880, 1046.5])('finds a pure %s Hz tone within 3 cents', (hz) => {
    const r = run(tone(hz, 0.3))
    expect(r.length).toBeGreaterThan(20)
    for (const x of r) {
      expect(x.clarity).toBeGreaterThan(0.95)
      expect(centsErr(x.hz, hz)).toBeLessThan(3)
    }
  })

  it('finds the fundamental of a voice-like tone with a weak fundamental', () => {
    const r = run(tone(146.83, 0.3, [0.4, 1, 0.8, 0.5, 0.3, 0.2]))
    const bad = r.filter((x) => centsErr(x.hz, 146.83) > 5)
    expect(bad.length).toBe(0)
  })

  it('tracks vibrato around the note', () => {
    const r = run(tone(220, 0.6, [1, 0.5, 0.3], 0.3, 25))
    for (const x of r) expect(centsErr(x.hz, 220)).toBeLessThan(35)
  })

  it('reports noise as low clarity', () => {
    const n = new Float32Array(SR * 0.3)
    let seed = 1
    for (let i = 0; i < n.length; i++) {
      seed = (seed * 16807) % 2147483647
      n[i] = (seed / 2147483647 - 0.5) * 0.2
    }
    const r = run(n)
    const clear = r.filter((x) => x.hz > 0 && x.clarity >= 0.88)
    expect(clear.length / r.length).toBeLessThan(0.05)
  })

  it('reports silence as no pitch and very low level', () => {
    const r = run(new Float32Array(SR * 0.1))
    for (const x of r) {
      expect(x.hz).toBe(0)
      expect(x.db).toBe(-Infinity)
    }
  })

  it('reports loudness in dBFS', () => {
    const r = run(tone(440, 0.2, [1], 0.5))
    // Sine RMS = amp / √2 → 0.354 → about -9 dB.
    expect(r[r.length - 1].db).toBeCloseTo(-9.03, 0)
  })
})
