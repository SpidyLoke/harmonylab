// Sounds. A pure sine is surprisingly hard to pitch-match, so the guide uses a
// soft tone with a few quiet overtones. The melody uses a brighter, different
// timbre so the ear can tell the two parts apart.

import * as Tone from 'tone'
import { midiToHz } from '../music/notes'

const GUIDE_PARTIALS = [1, 0.45, 0.2, 0.1, 0.05]
const MELODY_PARTIALS = [1, 0.7, 0.45, 0.3, 0.2, 0.12, 0.08]

/** 0..1 slider to decibels. */
export function sliderToDb(v: number): number {
  return v <= 0.001 ? -Infinity : 20 * Math.log10(v)
}

export function makeGuideSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: GUIDE_PARTIALS },
    envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.25 },
    volume: -8,
  }).toDestination()
}

export function makeMelodySynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: MELODY_PARTIALS },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.6, release: 0.3 },
    volume: -12,
  }).toDestination()
}

export function makePadSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 0.8 },
    volume: -24,
  }).toDestination()
}

export function makeClickSynth(): Tone.Synth {
  return new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -14,
  }).toDestination()
}

// ---------- One-off sounds for the sandbox and drills ----------

let guide: Tone.PolySynth | null = null
let drone: Tone.Synth | null = null
let droneMidi: number | null = null

/** Plays a single reference note now (or at `when`, audio-clock seconds). */
export function playNote(midi: number, seconds = 1.5, when?: number): void {
  guide ??= makeGuideSynth()
  guide.triggerAttackRelease(midiToHz(midi), seconds, when)
}

/** Plays several notes together. */
export function playChord(midis: number[], seconds = 1.5, when?: number): void {
  guide ??= makeGuideSynth()
  guide.triggerAttackRelease(
    midis.map((m) => midiToHz(m)),
    seconds,
    when,
  )
}

/** Starts (or retunes) a sustained drone. */
export function startDrone(midi: number): void {
  drone ??= new Tone.Synth({
    oscillator: { type: 'custom', partials: MELODY_PARTIALS },
    envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.4 },
    volume: -16,
  }).toDestination()
  if (droneMidi === null) drone.triggerAttack(midiToHz(midi))
  else drone.setNote(midiToHz(midi))
  droneMidi = midi
}

export function stopDrone(): void {
  if (drone && droneMidi !== null) drone.triggerRelease()
  droneMidi = null
}

export function isDroneOn(): boolean {
  return droneMidi !== null
}

export function stopOneOffs(): void {
  stopDrone()
  guide?.releaseAll()
}
