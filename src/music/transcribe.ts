// Turns a sung or hummed pitch track into notes, then onto a beat grid.

import type { Note } from './types'

export interface PitchFrame {
  /** Seconds (any clock, consistent within a recording). */
  t: number
  /** Fractional MIDI pitch, or null when not singing. */
  midi: number | null
}

export interface TimedNote {
  startSec: number
  endSec: number
  midi: number
}

export interface TranscribeOptions {
  /** Shorter blips are dropped. */
  minNoteSec?: number
  /** A move of this many semitones away from the current note starts a new one... */
  splitSemitones?: number
  /** ...if it lasts at least this long. */
  splitHoldSec?: number
  /** Silence longer than this ends a note. */
  gapSec?: number
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function framesToNotes(frames: PitchFrame[], opts: TranscribeOptions = {}): TimedNote[] {
  const { minNoteSec = 0.09, splitSemitones = 0.7, splitHoldSec = 0.05, gapSec = 0.06 } = opts
  const out: TimedNote[] = []
  let seg: PitchFrame[] = []
  let deviant: PitchFrame[] = []
  let lastVoiced = -Infinity

  const close = (endSec: number) => {
    if (seg.length && endSec - seg[0].t >= minNoteSec) {
      // Skip the first fifth when picking the pitch: singers scoop into notes.
      const body = seg.slice(Math.floor(seg.length / 5)).map((f) => f.midi as number)
      out.push({ startSec: seg[0].t, endSec, midi: Math.round(median(body)) })
    }
    seg = []
  }

  for (const f of frames) {
    if (f.midi === null) {
      if (seg.length && f.t - lastVoiced > gapSec) {
        close(lastVoiced)
        deviant = []
      }
      continue
    }
    lastVoiced = f.t
    if (!seg.length) {
      seg.push(f)
      continue
    }
    const centre = median(seg.slice(-15).map((x) => x.midi as number))
    if (Math.abs(f.midi - centre) > splitSemitones) {
      deviant.push(f)
      if (deviant[deviant.length - 1].t - deviant[0].t >= splitHoldSec) {
        close(deviant[0].t)
        seg = deviant
        deviant = []
      }
    } else {
      seg.push(...deviant, f)
      deviant = []
    }
  }
  if (seg.length) close(lastVoiced)

  // Merge a note split by a tiny gap at the same pitch.
  const merged: TimedNote[] = []
  for (const n of out) {
    const p = merged[merged.length - 1]
    if (p && p.midi === n.midi && n.startSec - p.endSec < gapSec * 1.5) p.endSec = n.endSec
    else merged.push({ ...n })
  }
  return merged
}

/** Snaps timed notes onto a beat grid. `originSec` is the time of beat 0. */
export function quantize(notes: TimedNote[], bpm: number, originSec: number, grid = 0.25): Note[] {
  const toBeat = (s: number) => Math.round((((s - originSec) * bpm) / 60) / grid) * grid
  const out: Note[] = []
  for (const n of notes) {
    const start = Math.max(0, toBeat(n.startSec))
    const end = Math.max(start + grid, toBeat(n.endSec))
    const prev = out[out.length - 1]
    if (prev && start < prev.start + prev.dur) {
      if (start <= prev.start) continue // two notes on one grid slot: keep the first
      prev.dur = start - prev.start
    }
    out.push({ start, dur: end - start, midi: n.midi })
  }
  return out
}

/**
 * Estimates tempo from note onsets by finding the beat grid (with half-beat
 * subdivisions) the onsets line up with best. Leans towards 70 to 140 bpm.
 */
export function estimateTempo(onsetsSec: number[]): { bpm: number; originSec: number } {
  if (onsetsSec.length < 3) return { bpm: 90, originSec: onsetsSec[0] ?? 0 }
  let best = { bpm: 90, originSec: onsetsSec[0], score: -Infinity }
  const sigma = 0.035
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const half = 30 / bpm
    for (const anchor of onsetsSec.slice(0, 4)) {
      let s = 0
      for (const o of onsetsSec) {
        const k = Math.round((o - anchor) / half)
        const d = o - anchor - k * half
        s += Math.exp(-(d * d) / (2 * sigma * sigma)) * (k % 2 === 0 ? 1 : 0.6)
      }
      const prior = Math.exp(-((Math.log2(bpm / 100)) ** 2) / (2 * 0.45 ** 2))
      const score = s * (0.7 + 0.3 * prior)
      if (score > best.score) best = { bpm, originSec: anchor, score }
    }
  }
  return { bpm: best.bpm, originSec: best.originSec }
}
