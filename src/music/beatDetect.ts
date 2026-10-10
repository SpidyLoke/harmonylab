// Finds tempo and beat positions in a backing track so it can sync with the
// song automatically. It only looks for the beat, never the melody.
//
// Method: an onset-strength curve (rises in short-time energy), its
// autocorrelation for the beat period (with a gentle preference for
// 80 to 140 bpm), then the beat phase that lines up with the most onsets, and
// the bar position of the strongest beat as the downbeat.

export interface BeatInfo {
  bpm: number
  /** Time of the first detected beat, seconds. */
  firstBeatSec: number
  /** Time of the first detected bar start (downbeat), seconds. */
  downbeatSec: number
  /** 0 to 1: how clearly the track has a steady beat. */
  confidence: number
}

export function onsetEnvelope(
  samples: Float32Array,
  sampleRate: number,
  hop = 256,
): { env: Float32Array; accent: Float32Array; hopSec: number } {
  const frames = Math.floor(samples.length / hop)
  const energy = new Float32Array(frames)
  const level = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let s = 0
    const o = f * hop
    for (let i = 0; i < hop; i++) s += samples[o + i] * samples[o + i]
    energy[f] = Math.log(1e-9 + s / hop)
    level[f] = Math.sqrt(s / hop)
  }
  // Loudness rises (not log): used to tell accented beats from weak ones.
  const accent = new Float32Array(frames)
  for (let f = 1; f < frames; f++) accent[f] = Math.max(0, level[f] - level[f - 1])
  const env = new Float32Array(frames)
  for (let f = 1; f < frames; f++) env[f] = Math.max(0, energy[f] - energy[f - 1])
  // Remove slow drift: subtract a local mean.
  const w = 16
  const out = new Float32Array(frames)
  let acc = 0
  for (let f = 0; f < frames; f++) {
    acc += env[f]
    if (f >= w) acc -= env[f - w]
    out[f] = Math.max(0, env[f] - acc / Math.min(f + 1, w))
  }
  return { env: out, accent, hopSec: hop / sampleRate }
}

export function detectBeats(samples: Float32Array, sampleRate: number, beatsPerBar = 4): BeatInfo {
  const { env, accent, hopSec } = onsetEnvelope(samples, sampleRate)
  const n = env.length
  const minLag = Math.floor(60 / 180 / hopSec)
  const maxLag = Math.ceil(60 / 60 / hopSec)
  let bestLag = minLag
  let bestScore = -Infinity
  let total = 0
  const scores: number[] = []
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag]
    s /= n - lag
    const bpm = 60 / (lag * hopSec)
    const prior = Math.exp(-((Math.log2(bpm / 110)) ** 2) / (2 * 0.5 ** 2))
    const score = s * prior
    scores.push(score)
    total += score
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  // Parabolic refinement around the peak for sub-frame precision.
  const i0 = bestLag - minLag
  let lag = bestLag
  if (i0 > 0 && i0 < scores.length - 1) {
    const [a, b, c] = [scores[i0 - 1], scores[i0], scores[i0 + 1]]
    const denom = a - 2 * b + c
    if (denom !== 0) lag += (0.5 * (a - c)) / denom
  }
  // Refine tempo and phase together against the whole track: a tiny tempo
  // error adds up over a long song, so search finely around the estimate.
  const coarsePeriod = lag
  let periodFrames = coarsePeriod
  let bestPhase = 0
  let bestPhaseScore = -Infinity
  const sample = (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    return (env[i] ?? 0) * (1 - f) + (env[i + 1] ?? 0) * f
  }
  for (let pf = coarsePeriod * 0.98; pf <= coarsePeriod * 1.02; pf += coarsePeriod * 0.0005) {
    for (let p = 0; p < pf; p += 0.25) {
      let s = 0
      for (let k = 0; p + k * pf < n - 1; k++) s += sample(p + k * pf)
      if (s > bestPhaseScore) {
        bestPhaseScore = s
        bestPhase = p
        periodFrames = pf
      }
    }
  }
  const periodSec = periodFrames * hopSec
  const bpm = 60 / periodSec

  // Downbeat: the beat position within the bar that is loudest on average.
  const barSums = new Array(beatsPerBar).fill(0)
  for (let k = 0; bestPhase + k * periodFrames < n; k++) {
    const c = Math.round(bestPhase + k * periodFrames)
    barSums[k % beatsPerBar] += Math.max(accent[c - 1] ?? 0, accent[c] ?? 0, accent[c + 1] ?? 0)
  }
  const downIndex = barSums.indexOf(Math.max(...barSums))
  // env[f] is the rise into frame f, so the onset sits near the start of frame f.
  const firstBeatSec = Math.max(0, bestPhase * hopSec)
  const mean = total / Math.max(1, scores.length)
  return {
    bpm: Math.round(bpm * 10) / 10,
    firstBeatSec,
    downbeatSec: firstBeatSec + downIndex * periodSec,
    confidence: Math.max(0, Math.min(1, (bestScore / (mean || 1) - 1) / 3)),
  }
}
