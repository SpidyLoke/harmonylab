// Pure pitch analysis, shared by the audio-thread processor and the unit tests.
// No Web Audio or DOM dependencies here.

import { PitchDetector } from 'pitchy'

/** Analysis window length. 24 ms holds two periods of 83 Hz (E2), the bottom of a bass voice. */
export const WINDOW_SECONDS = 0.024
/** How often a reading is produced, in 128-sample render blocks. 2 blocks ≈ 5.3 ms at 48 kHz. */
export const HOP_BLOCKS = 2
export const BLOCK_SIZE = 128

/** Readings outside this range are treated as not-a-voice. */
export const MIN_HZ = 55
export const MAX_HZ = 1600

export interface PitchReading {
  /** Detected fundamental in Hz, or 0 when nothing usable was found. */
  hz: number
  /** McLeod "clarity", 0..1. How periodic (voice-like) the window is. */
  clarity: number
  /** Window loudness in dBFS. */
  db: number
}

export function windowSizeFor(sampleRate: number): number {
  return Math.round(sampleRate * WINDOW_SECONDS)
}

export class PitchCore {
  readonly sampleRate: number
  readonly windowSize: number
  private readonly ring: Float32Array
  private readonly linear: Float32Array
  private writeIndex = 0
  private filled = 0
  private readonly detector: PitchDetector<Float32Array>

  constructor(sampleRate: number, windowSize = windowSizeFor(sampleRate)) {
    this.sampleRate = sampleRate
    this.windowSize = windowSize
    this.ring = new Float32Array(windowSize)
    this.linear = new Float32Array(windowSize)
    // Default volume floor is 0, so pitchy never gates; loudness gating happens
    // on the main thread where it can be tuned live.
    this.detector = PitchDetector.forFloat32Array(windowSize)
  }

  /** Append samples to the rolling window. */
  push(samples: Float32Array): void {
    const n = samples.length
    for (let i = 0; i < n; i++) {
      this.ring[this.writeIndex] = samples[i]
      this.writeIndex = (this.writeIndex + 1) % this.windowSize
    }
    this.filled = Math.min(this.windowSize, this.filled + n)
  }

  get ready(): boolean {
    return this.filled >= this.windowSize
  }

  /** Analyse the most recent window. */
  analyse(): PitchReading {
    const w = this.windowSize
    const tail = w - this.writeIndex
    this.linear.set(this.ring.subarray(this.writeIndex), 0)
    this.linear.set(this.ring.subarray(0, this.writeIndex), tail)

    let sum = 0
    for (let i = 0; i < w; i++) sum += this.linear[i] * this.linear[i]
    const rms = Math.sqrt(sum / w)
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity

    if (rms < 1e-5) return { hz: 0, clarity: 0, db }

    const [hz, clarity] = this.detector.findPitch(this.linear, this.sampleRate)
    if (!(hz >= MIN_HZ && hz <= MAX_HZ)) return { hz: 0, clarity, db }
    return { hz, clarity, db }
  }
}
