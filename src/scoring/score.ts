// Scores a take: how much of the sung time was in tune, which notes went
// wrong and how, and one specific tip.
//
// Rules:
// - Times are audio-clock seconds. Each reading is shifted back by the
//   singer's measured latency before it is matched to a note.
// - The first 120 ms of every note is a grace window: scooping into a note
//   is normal and not a mistake.
// - Silence (breaths, gaps) is not a wrong note. Up to a quarter of each
//   note's time may be silent at no cost; beyond that it counts against you.
// - A reading in tune with the melody instead of the harmony is a "slide to
//   the melody", the classic harmony failure, and is reported as such.

import { centsOff, midiToDisplayName } from '../music/notes'
import { classify } from './pitchState'

export interface TimedTarget {
  startSec: number
  endSec: number
  midi: number
}

export interface ScoreFrame {
  t: number
  midi: number | null
}

export interface ScoreInput {
  frames: ScoreFrame[]
  targets: TimedTarget[]
  /** Melody notes sounding at the same time, for slide detection. */
  melody?: TimedTarget[]
  toleranceCents: number
  latencySec?: number
  graceSec?: number
}

export type NoteProblem = 'ok' | 'sharp' | 'flat' | 'slidToMelody' | 'missed' | 'unsteady'

export interface NoteResult {
  target: TimedTarget
  /** 0..1 share of counted time in tune. */
  inTune: number
  /** Mean signed cents while singing (positive = sharp). */
  meanCents: number
  /** Standard deviation of cents: how wobbly. */
  wobbleCents: number
  /** 0..1 share of the note's scored time with voice. */
  coverage: number
  /** 0..1 share of voiced time sitting on the melody instead. */
  onMelody: number
  /** Cents off in the first 300 ms after the grace window (late or scooped entries). */
  entryCents: number | null
  problem: NoteProblem
}

export interface TakeResult {
  /** 0..100. */
  percentInTune: number
  /** Mean absolute cents off while singing. */
  averageCentsOff: number
  notes: NoteResult[]
  wrongNotes: { name: string; problem: NoteProblem; cents: number }[]
  slidToMelodyCount: number
  tip: string
  /** Seconds of singing that were counted. */
  sungSeconds: number
}

const SILENCE_ALLOWANCE = 0.25

export function scoreTake(input: ScoreInput): TakeResult {
  const { frames, targets, melody = [], toleranceCents, latencySec = 0, graceSec = 0.12 } = input
  const hop = estimateHop(frames)

  let inTuneTotal = 0
  let voicedTotal = 0
  let expectedTotal = 0
  let absCentsSum = 0
  const notes: NoteResult[] = []

  for (const target of targets) {
    const from = target.startSec + graceSec
    const to = target.endSec
    if (to <= from) continue
    const expected = (to - from) / hop
    let voiced = 0
    let inTune = 0
    let onMelody = 0
    const cents: number[] = []
    const entry: number[] = []

    for (const f of frames) {
      const t = f.t - latencySec
      if (t < from || t >= to || f.midi === null) continue
      voiced++
      const c = centsOff(f.midi, target.midi)
      cents.push(c)
      if (t < from + 0.3) entry.push(c)
      if (classify(c, toleranceCents).state === 'inTune') {
        inTune++
      } else {
        const mel = melody.find((m) => m.startSec <= t && t < m.endSec)
        if (
          mel &&
          Math.abs(mel.midi - target.midi) > 0.5 &&
          Math.abs(centsOff(f.midi, mel.midi)) <= Math.max(toleranceCents, 35)
        ) {
          onMelody++
        }
      }
    }

    const counted = Math.max(voiced, expected * (1 - SILENCE_ALLOWANCE))
    inTuneTotal += inTune
    voicedTotal += voiced
    expectedTotal += counted
    absCentsSum += cents.reduce((s, c) => s + Math.abs(c), 0)

    const mean = cents.length ? cents.reduce((a, b) => a + b, 0) / cents.length : 0
    const wobble = cents.length
      ? Math.sqrt(cents.reduce((s, c) => s + (c - mean) ** 2, 0) / cents.length)
      : 0
    const share = counted ? inTune / counted : 0
    const coverage = expected ? Math.min(1, voiced / expected) : 0
    const melodyShare = voiced ? onMelody / voiced : 0

    let problem: NoteProblem = 'ok'
    if (coverage < 0.3) problem = 'missed'
    else if (melodyShare >= 0.4) problem = 'slidToMelody'
    else if (share < 0.5) problem = wobble > 45 && Math.abs(mean) < toleranceCents ? 'unsteady' : mean > 0 ? 'sharp' : 'flat'

    notes.push({
      target,
      inTune: share,
      meanCents: mean,
      wobbleCents: wobble,
      coverage,
      onMelody: melodyShare,
      entryCents: entry.length ? entry.reduce((a, b) => a + b, 0) / entry.length : null,
      problem,
    })
  }

  const percent = expectedTotal ? (100 * inTuneTotal) / expectedTotal : 0
  const wrongNotes = notes
    .filter((n) => n.problem !== 'ok')
    .map((n) => ({ name: midiToDisplayName(n.target.midi), problem: n.problem, cents: Math.round(n.meanCents) }))
  const result: TakeResult = {
    percentInTune: Math.round(percent * 10) / 10,
    averageCentsOff: voicedTotal ? Math.round(absCentsSum / voicedTotal) : 0,
    notes,
    wrongNotes,
    slidToMelodyCount: notes.filter((n) => n.problem === 'slidToMelody').length,
    tip: '',
    sungSeconds: voicedTotal * hop,
  }
  result.tip = pickTip(result, toleranceCents)
  return result
}

function estimateHop(frames: ScoreFrame[]): number {
  if (frames.length < 2) return 0.005
  const span = frames[frames.length - 1].t - frames[0].t
  return span > 0 ? span / (frames.length - 1) : 0.005
}

/** One specific, actionable tip for the biggest problem in the take. */
export function pickTip(r: TakeResult, toleranceCents: number): string {
  const n = r.notes.length || 1
  const count = (p: NoteProblem) => r.notes.filter((x) => x.problem === p).length
  const sung = r.notes.filter((x) => x.coverage >= 0.3)
  const meanSigned = sung.length ? sung.reduce((s, x) => s + x.meanCents, 0) / sung.length : 0
  const lateEntries = sung.filter((x) => x.entryCents !== null && Math.abs(x.entryCents) > 2 * toleranceCents).length

  if (count('missed') / n >= 0.4) {
    return 'Keep singing through each note. Breathe in the gaps between notes, not in the middle of them.'
  }
  if (r.slidToMelodyCount >= 1 && r.slidToMelodyCount / n >= 0.2) {
    return `You slid to the melody on ${r.slidToMelodyCount} note${r.slidToMelodyCount > 1 ? 's' : ''}. Turn the melody down a little, cup a hand over one ear, and think of your note as its own tune.`
  }
  if (r.percentInTune >= 80) {
    return 'Solid take. Move the guide down a stage, or try the next drill.'
  }
  if (meanSigned < -toleranceCents * 0.6) {
    return 'You are sitting flat (a little low). Lift your eyebrows and keep your breath moving on long notes: flatness is usually tiredness or running out of air.'
  }
  if (meanSigned > toleranceCents * 0.6) {
    return 'You are a little sharp (high). Ease off the volume and relax your jaw; pushing harder drives the pitch up.'
  }
  if (count('unsteady') / n >= 0.25) {
    return 'The pitch is wobbling. Sing one steady "ah" with even breath, and aim for a straight tone before adding any vibrato.'
  }
  if (lateEntries / n >= 0.3) {
    return 'Your notes start off-pitch and then settle. Hear the next note in your head a beat early and breathe in before it arrives.'
  }
  return 'Listen to the guide once more, then sing along at half volume so you can hear both yourself and the target.'
}
