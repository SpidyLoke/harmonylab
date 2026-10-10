// Plays a Piece on the shared audio clock: count-in, melody, other parts,
// chord pad, optional backing track, and the guide (the singer's part) at the
// volume set by the guide stage. Supports looping a section with a different
// guide stage on each pass, and slowing down without changing pitch.

import * as Tone from 'tone'
import { getAudioContext, unlockAudio } from './context'
import { makeClickSynth, makeGuideSynth, makeMelodySynth, makePadSynth, sliderToDb } from './instruments'
import { midiToHz } from '../music/notes'
import { chordPcs, parseChord } from '../music/theory'
import type { Note, Piece } from '../music/types'
import type { TimedTarget } from '../scoring/score'
import type { LaneTarget } from '../ui/components/PitchLane'
import type { GuideStage } from '../db/schema'

/** Guide level per stage, in dB relative to the guide volume. */
export const STAGE_DB: Record<GuideStage, number> = { 0: 0, 1: -6, 2: -16, 3: -Infinity }
export const STAGE_LABELS: Record<GuideStage, string> = { 0: 'Full', 1: 'Half', 2: 'Quiet', 3: 'Off' }

export interface RunOptions {
  piece: Piece
  /** 0.5 to 1. Slows playback without changing pitch. */
  tempo?: number
  stage: GuideStage
  /** Stage per pass when looping (overrides `stage`). */
  stageForPass?: (pass: number) => GuideStage
  melodyVolume?: number
  guideVolume?: number
  countInBeats?: number
  loop?: { startBeat: number; endBeat: number } | null
  /** Passes to play. Default 1, or until stopped when looping. */
  passes?: number
  /** Metronome during the piece (always on in the count-in). */
  click?: boolean
  backing?: { buffer: AudioBuffer; offsetSec: number; volume: number } | null
  onPassEnd?: (pass: number, timedTargets: TimedTarget[]) => void
  onEnd?: () => void
}

export interface Pass {
  index: number
  startSec: number
  endSec: number
  stage: GuideStage
  targets: TimedTarget[]
  melody: TimedTarget[]
}

export class PieceRunner {
  readonly opts: RunOptions
  readonly spb: number
  passes: Pass[] = []
  laneTargets: LaneTarget[] = []
  private disposables: { dispose(): unknown }[] = []
  private guide!: Tone.PolySynth
  private melody!: Tone.PolySynth
  private pad!: Tone.PolySynth
  private click!: Tone.Synth
  private timer: number | null = null
  private stopped = false
  private range: { a: number; b: number }

  constructor(opts: RunOptions) {
    this.opts = opts
    const tempo = opts.tempo ?? 1
    this.spb = 60 / (opts.piece.bpm * tempo)
    this.range = opts.loop
      ? { a: opts.loop.startBeat, b: opts.loop.endBeat }
      : { a: 0, b: opts.piece.lengthBeats }
  }

  /** Seconds from start() to the end of the first pass. */
  get firstPassSeconds(): number {
    return (this.range.b - this.range.a) * this.spb
  }

  async start(): Promise<void> {
    await unlockAudio()
    const ctx = getAudioContext()
    this.guide = makeGuideSynth()
    this.melody = makeMelodySynth()
    this.pad = makePadSynth()
    this.click = makeClickSynth()
    this.disposables.push(this.guide, this.melody, this.pad, this.click)
    this.guide.volume.value = -8 + sliderToDb(this.opts.guideVolume ?? 1)
    this.melody.volume.value = -12 + sliderToDb(this.opts.melodyVolume ?? 1)

    const t0 = ctx.currentTime + 0.2
    const countIn = this.opts.countInBeats ?? this.opts.piece.beatsPerBar
    for (let i = 0; i < countIn; i++) {
      this.click.triggerAttackRelease(i % this.opts.piece.beatsPerBar === 0 ? 1760 : 1320, 0.05, t0 + i * this.spb)
    }
    this.schedulePass(0, t0 + countIn * this.spb)

    const total = this.opts.passes ?? (this.opts.loop ? Infinity : 1)
    this.timer = window.setInterval(() => {
      if (this.stopped) return
      const now = ctx.currentTime
      const last = this.passes[this.passes.length - 1]
      if (this.passes.length < total && now > last.endSec - 0.6) this.schedulePass(this.passes.length, last.endSec)
      for (const p of this.passes) {
        if (!this.reported.has(p.index) && now > p.endSec + 0.25) {
          this.reported.add(p.index)
          this.opts.onPassEnd?.(p.index, p.targets)
        }
      }
      if (this.passes.length >= total && now > last.endSec + 0.3) this.finish()
    }, 50)
  }

  private reported = new Set<number>()

  private stageFor(pass: number): GuideStage {
    return this.opts.stageForPass?.(pass) ?? this.opts.stage
  }

  private schedulePass(index: number, startSec: number) {
    const { piece } = this.opts
    const { a, b } = this.range
    const stage = this.stageFor(index)
    const at = (beat: number) => startSec + (beat - a) * this.spb
    const inRange = (n: Note) => n.start >= a - 1e-6 && n.start < b - 1e-6
    const durOf = (n: Note) => (Math.min(n.start + n.dur, b) - n.start) * this.spb

    const targets: TimedTarget[] = []
    const melody: TimedTarget[] = []

    for (const n of piece.melody.filter(inRange)) {
      this.melody.triggerAttackRelease(midiToHz(n.midi), durOf(n) * 0.97, at(n.start))
      melody.push({ startSec: at(n.start), endSec: at(n.start) + durOf(n), midi: n.midi })
      this.laneTargets.push({ start: at(n.start), end: at(n.start) + durOf(n), midi: n.midi, kind: 'melody' })
    }
    for (const part of piece.others ?? []) {
      for (const n of part.filter(inRange)) {
        this.melody.triggerAttackRelease(midiToHz(n.midi), durOf(n) * 0.97, at(n.start), 0.7)
        this.laneTargets.push({ start: at(n.start), end: at(n.start) + durOf(n), midi: n.midi, kind: 'melody' })
      }
    }
    for (const n of (piece.cues ?? []).filter(inRange)) {
      this.guide.triggerAttackRelease(midiToHz(n.midi), durOf(n) * 0.9, at(n.start))
      this.laneTargets.push({ start: at(n.start), end: at(n.start) + durOf(n), midi: n.midi, kind: 'cue' })
    }
    const velocity = Math.pow(10, STAGE_DB[stage] / 20)
    for (const n of piece.target.filter(inRange)) {
      if (stage < 3) this.guide.triggerAttackRelease(midiToHz(n.midi), durOf(n) * 0.97, at(n.start), velocity)
      targets.push({ startSec: at(n.start), endSec: at(n.start) + durOf(n), midi: n.midi })
      this.laneTargets.push({ start: at(n.start), end: at(n.start) + durOf(n), midi: n.midi, kind: 'harmony' })
    }
    for (const c of (piece.chords ?? []).filter((c) => c.start >= a - 1e-6 && c.start < b - 1e-6)) {
      const chord = parseChord(c.symbol)
      if (!chord) continue
      const voicing = chordPcs(chord).map((pc) => 48 + ((pc - 4 + 12) % 12) + 4) // E3..D#4 band
      this.pad.triggerAttackRelease(
        voicing.map((m) => midiToHz(m)),
        (Math.min(c.start + c.dur, b) - c.start) * this.spb * 0.98,
        at(c.start),
      )
    }
    if (this.opts.click) {
      for (let beat = Math.ceil(a); beat < b; beat++) {
        this.click.triggerAttackRelease(beat % piece.beatsPerBar === 0 ? 1760 : 1320, 0.04, at(beat), 0.5)
      }
    }
    if (this.opts.backing) this.scheduleBacking(startSec, at(b))

    this.passes.push({ index, startSec, endSec: at(b), stage, targets, melody })
    // Keep the lane list from growing without bound on long loops.
    const cutoff = startSec - 30
    if (this.laneTargets.length > 2000) this.laneTargets = this.laneTargets.filter((t) => t.end > cutoff)
  }

  private scheduleBacking(startSec: number, endSec: number) {
    const bk = this.opts.backing!
    const tempo = this.opts.tempo ?? 1
    const offset = bk.offsetSec + (this.range.a * 60) / this.opts.piece.bpm
    // Full speed: plain player (best quality). Slowed: granular player keeps pitch.
    const player =
      tempo >= 0.999
        ? new Tone.Player(bk.buffer).toDestination()
        : new Tone.GrainPlayer({ url: bk.buffer, playbackRate: tempo, grainSize: 0.1, overlap: 0.05 }).toDestination()
    player.volume.value = sliderToDb(bk.volume) - 4
    if (offset >= 0) player.start(startSec, offset)
    else player.start(startSec - offset / tempo, 0)
    player.stop(endSec)
    this.disposables.push(player)
  }

  /** Time of beat 0 of the first pass. */
  get startSec(): number {
    return this.passes[0]?.startSec ?? 0
  }

  get endSec(): number {
    return this.passes[this.passes.length - 1]?.endSec ?? 0
  }

  private finish() {
    if (this.stopped) return
    this.stop()
    this.opts.onEnd?.()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    // Let release tails ring briefly, then free everything.
    const toFree = this.disposables
    this.disposables = []
    for (const d of toFree) {
      if (d instanceof Tone.PolySynth) d.releaseAll()
      if (d instanceof Tone.Player || d instanceof Tone.GrainPlayer) {
        try {
          d.stop()
        } catch {
          /* not started */
        }
      }
      if ('volume' in d) (d as unknown as { volume: Tone.Param<'decibels'> }).volume.rampTo(-Infinity, 0.15)
    }
    window.setTimeout(() => toFree.forEach((d) => d.dispose()), 600)
  }

  get isStopped(): boolean {
    return this.stopped
  }
}
