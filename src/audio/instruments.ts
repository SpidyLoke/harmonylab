// Guide voices. A pure sine is surprisingly hard to pitch-match, so the guide
// uses a soft tone with a few quiet overtones.

import * as Tone from 'tone'
import { midiToHz } from '../music/notes'

const GUIDE_PARTIALS = [1, 0.45, 0.2, 0.1, 0.05]

function makeVoice(volumeDb: number): Tone.Synth {
  return new Tone.Synth({
    oscillator: { type: 'custom', partials: GUIDE_PARTIALS },
    envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.35 },
    volume: volumeDb,
  }).toDestination()
}

let guide: Tone.Synth | null = null
let drone: Tone.Synth | null = null
let droneMidi: number | null = null

/** Plays a single reference note. */
export function playNote(midi: number, seconds = 1.5): void {
  guide ??= makeVoice(-10)
  guide.triggerAttackRelease(midiToHz(midi), seconds)
}

/** Starts (or retunes) a sustained drone. */
export function startDrone(midi: number): void {
  drone ??= makeVoice(-14)
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
