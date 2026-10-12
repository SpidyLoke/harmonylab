// Lines a MIDI file up with a recording of the same song, automatically.
//
// Method: every note start in the MIDI (drums and all) is a moment the
// recording should get louder. Slide the MIDI along the recording's onset
// curve (and stretch it very slightly, in case the tempos differ) and keep
// the position where the most note starts land on rises in the audio.

import { onsetEnvelope } from './beatDetect'

export interface MidiAudioSync {
  /** Seconds into the audio where MIDI time 0 falls. */
  offsetSec: number
  /** Audio seconds per MIDI second (1 = same tempo). */
  stretch: number
  /** 0 to 1: how much better the best fit is than a typical one. */
  confidence: number
}

export function syncMidiToAudio(
  onsetsSec: number[],
  samples: Float32Array,
  sampleRate: number,
  opts: { maxOffsetSec?: number; minOffsetSec?: number; stretches?: number[] } = {},
): MidiAudioSync {
  const { env, hopSec } = onsetEnvelope(samples, sampleRate)
  // Smear the curve by a frame either side so near-misses still count.
  const soft = new Float32Array(env.length)
  for (let i = 0; i < env.length; i++) soft[i] = Math.max(env[i], env[i - 1] ?? 0, env[i + 1] ?? 0)
  const onsets = onsetsSec.filter((t) => t < 90) // the first minute and a half is plenty
  const audioLen = env.length * hopSec
  const minOff = opts.minOffsetSec ?? -5
  const maxOff = Math.min(opts.maxOffsetSec ?? 60, audioLen)
  const stretches = opts.stretches ?? [1]

  let best = { offsetSec: 0, stretch: 1, score: -Infinity }
  let sum = 0
  let count = 0
  for (const k of stretches) {
    for (let off = minOff; off <= maxOff; off += hopSec) {
      let s = 0
      for (const o of onsets) {
        const f = Math.round((off + o * k) / hopSec)
        if (f >= 0 && f < soft.length) s += soft[f]
      }
      sum += s
      count++
      if (s > best.score) best = { offsetSec: off, stretch: k, score: s }
    }
  }
  const mean = count ? sum / count : 0
  return {
    offsetSec: best.offsetSec,
    stretch: best.stretch,
    confidence: Math.max(0, Math.min(1, (best.score / (mean || 1) - 1) / 2)),
  }
}

/** Stretch factors to try, given the MIDI tempo and the tempo heard in the audio. */
export function candidateStretches(midiBpm: number, audioBpm: number | null): number[] {
  const out = new Set<number>([1])
  if (audioBpm) {
    for (const f of [0.5, 1, 2]) {
      const k = midiBpm / (audioBpm * f)
      if (Math.abs(k - 1) < 0.06) for (let d = -0.01; d <= 0.0101; d += 0.0025) out.add(Math.round((k + d) * 10000) / 10000)
    }
  }
  return [...out]
}
