import { describe, expect, it } from 'vitest'
import { detectBeats } from './beatDetect'

function clickTrack(bpm: number, offset: number, seconds: number, sr = 22050): Float32Array {
  const out = new Float32Array(sr * seconds)
  const period = 60 / bpm
  let k = 0
  for (let t = offset; t < seconds; t += period, k++) {
    const amp = k % 4 === 0 ? 0.9 : 0.4 // accented downbeats
    const i0 = Math.round(t * sr)
    for (let i = 0; i < 400 && i0 + i < out.length; i++) out[i0 + i] = amp * Math.exp(-i / 60) * Math.sin(i * 0.9)
  }
  return out
}

describe('detectBeats', () => {
  it.each([
    [100, 0.25],
    [124, 0.6],
    [88, 0.1],
  ])('finds %s bpm with first beat at %s s', (bpm, offset) => {
    const sr = 22050
    const info = detectBeats(clickTrack(bpm, offset, 20, sr), sr)
    expect(Math.abs(info.bpm - bpm)).toBeLessThan(0.5)
    const period = 60 / bpm
    const wrap = (x: number) => x - Math.round(x)
    const phaseErr = Math.abs(wrap((info.firstBeatSec - offset) / period)) * period
    expect(phaseErr).toBeLessThan(0.025)
    const downErr = Math.abs(wrap((info.downbeatSec - offset) / (period * 4))) * period * 4
    expect(downErr).toBeLessThan(0.025)
    expect(info.confidence).toBeGreaterThan(0.2)
  })
})
