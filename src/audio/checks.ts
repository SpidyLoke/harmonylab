// First-run measurements: headphone bleed, vocal range, latency.

import { getAudioContext, unlockAudio } from './context'
import { makeClickSynth, makeGuideSynth } from './instruments'
import { pitchEngine, type LiveFrame } from './pitchEngine'
import { hzToMidi, midiToHz } from '../music/notes'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Collects every reading until `stop()` is called. */
export class FrameRecorder {
  frames: LiveFrame[] = []
  private off: () => void
  constructor() {
    this.off = pitchEngine.onFrame((f) => this.frames.push(f))
  }
  stop(): LiveFrame[] {
    this.off()
    return this.frames
  }
}

// ---------- Headphones ----------

export interface BleedResult {
  bleed: boolean
  /** Share of each tone's time the mic heard that tone. */
  perTone: number[]
}

/**
 * Plays three guide tones while the singer stays quiet. If the mic hears
 * them, sound is leaking from speakers or open headphones into the mic.
 */
export async function headphoneCheck(): Promise<BleedResult> {
  await unlockAudio()
  const ctx = getAudioContext()
  const synth = makeGuideSynth()
  const tones = [69, 74, 77] // A4, D5, F5: clear of most speaking voices
  const rec = new FrameRecorder()
  const t0 = ctx.currentTime + 0.3
  tones.forEach((m, i) => synth.triggerAttackRelease(midiToHz(m), 0.8, t0 + i * 1.0))
  await wait(3500)
  const frames = rec.stop()
  synth.dispose()
  const perTone = tones.map((m, i) => {
    const from = t0 + i * 1.0 + 0.15
    const to = from + 0.6
    const window = frames.filter((f) => f.t >= from && f.t < to)
    if (!window.length) return 0
    const heard = window.filter((f) => {
      if (!(f.rawHz > 0) || f.clarity < 0.8) return false
      const cents = ((hzToMidi(f.rawHz) - m) * 100) % 1200
      const pcOff = Math.min(Math.abs(cents), 1200 - Math.abs(cents))
      return pcOff < 60
    }).length
    return heard / window.length
  })
  return { bleed: perTone.filter((x) => x > 0.3).length >= 2, perTone }
}

// ---------- Holding a steady note (range test, sung answers) ----------

export interface StableNoteProgress {
  /** 0..1 how much of the hold is done. */
  progress: number
  /** Current pitch, if singing. */
  midi: number | null
}

/**
 * Resolves with the median pitch once the singer holds a steady note
 * (within ±35 cents) for `holdSec`, or null after `timeoutSec`.
 */
export function captureStableNote(
  onProgress: (p: StableNoteProgress) => void,
  { holdSec = 1.0, timeoutSec = 8, signal }: { holdSec?: number; timeoutSec?: number; signal?: AbortSignal } = {},
): Promise<number | null> {
  return new Promise((resolve) => {
    const window: { t: number; m: number | null }[] = []
    let started = -1
    let done = false
    const finish = (v: number | null) => {
      if (done) return
      done = true
      off()
      clearTimeout(timer)
      resolve(v)
    }
    const off = pitchEngine.onFrame((f) => {
      if (started < 0) started = f.t
      window.push({ t: f.t, m: f.midi })
      while (window.length && window[0].t < f.t - holdSec) window.shift()
      const voiced = window.filter((x) => x.m !== null).map((x) => x.m as number)
      const covered = window.length ? window[window.length - 1].t - window[0].t : 0
      let progress = 0
      if (voiced.length >= 5) {
        const sorted = [...voiced].sort((a, b) => a - b)
        const med = sorted[sorted.length >> 1]
        const steady = voiced.filter((m) => Math.abs(m - med) <= 0.35).length / window.length
        // Progress builds while the note is steady.
        const tail = [...window].reverse()
        let held = 0
        for (const x of tail) {
          if (x.m === null || Math.abs(x.m - med) > 0.35) break
          held = f.t - x.t
        }
        progress = Math.min(1, held / holdSec)
        if (covered >= holdSec * 0.95 && steady >= 0.85) finish(med)
      }
      onProgress({ progress, midi: f.midi })
    })
    const timer = setTimeout(() => finish(null), timeoutSec * 1000)
    signal?.addEventListener('abort', () => finish(null))
  })
}

// ---------- Latency ----------

export interface LatencyResult {
  latencyMs: number
  matched: number
  method: 'clap' | 'tap'
}

const CLAP_BPM = 90
const CLAP_COUNT_IN = 4
const CLAP_BEATS = 8

/** Finds sudden loudness jumps (claps) in a list of readings. Returns their times. */
export function findOnsets(frames: { t: number; db: number }[]): number[] {
  const out: number[] = []
  let floor = -60
  let last = -Infinity
  for (let i = 3; i < frames.length; i++) {
    const f = frames[i]
    const before = Math.max(frames[i - 1].db, frames[i - 2].db, frames[i - 3].db)
    floor = floor * 0.98 + Math.min(f.db, floor + 3) * 0.02
    if (f.db > Math.max(-42, floor + 18) && f.db - before > 9 && f.t - last > 0.18) {
      out.push(f.t)
      last = f.t
    }
  }
  return out
}

/** Median offset between each expected time and the nearest onset in [-100, +400] ms. */
export function matchOffsets(expected: number[], onsets: number[]): number[] {
  const offs: number[] = []
  for (const e of expected) {
    const near = onsets.filter((o) => o - e > -0.1 && o - e < 0.4)
    if (near.length) offs.push(near.reduce((a, b) => (Math.abs(a - e) < Math.abs(b - e) ? a : b)) - e)
  }
  return offs
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

/** Schedules count-in plus clicks; returns their audio times (scored clicks only). */
async function playClicks(): Promise<{ times: number[]; endMs: number }> {
  await unlockAudio()
  const ctx = getAudioContext()
  const click = makeClickSynth()
  click.volume.value = -6
  const spb = 60 / CLAP_BPM
  const t0 = ctx.currentTime + 0.4
  const times: number[] = []
  for (let i = 0; i < CLAP_COUNT_IN + CLAP_BEATS; i++) {
    const t = t0 + i * spb
    click.triggerAttackRelease(i < CLAP_COUNT_IN ? 1320 : 1760, 0.05, t)
    if (i >= CLAP_COUNT_IN) times.push(t)
  }
  const endMs = (t0 + (CLAP_COUNT_IN + CLAP_BEATS) * spb - ctx.currentTime + 0.6) * 1000
  setTimeout(() => click.dispose(), endMs + 500)
  return { times, endMs }
}

/** Clap test: the singer claps on the clicks; the mic hears the claps. */
export async function clapLatencyTest(): Promise<LatencyResult | null> {
  const rec = new FrameRecorder()
  const { times, endMs } = await playClicks()
  await wait(endMs)
  const frames = rec.stop()
  const offs = matchOffsets(times, findOnsets(frames))
  if (offs.length < 4) return null
  return { latencyMs: Math.round(median(offs) * 1000), matched: offs.length, method: 'clap' }
}

/**
 * Tap test fallback: the singer taps the screen on the clicks. Measures
 * headphone and touch delay, not the mic, so the browser-reported mic delay
 * is added.
 */
export function tapLatencyTest(): { tap: () => void; result: Promise<LatencyResult | null> } {
  const taps: number[] = []
  const tap = () => taps.push(getAudioContext().currentTime)
  const result = (async () => {
    const { times, endMs } = await playClicks()
    await wait(endMs)
    const offs = matchOffsets(times, taps)
    if (offs.length < 4) return null
    const mic = pitchEngine.latency().inputMs ?? 10
    return { latencyMs: Math.round(median(offs) * 1000 + mic), matched: offs.length, method: 'tap' as const }
  })()
  return { tap, result }
}
