// Building blocks for drill pieces. All pieces are written around middle C
// and transposed to the singer's range when played.

import { generatePart, type PartKind } from '../music/harmony/generator'
import { MAJOR_STEPS } from '../music/theory'
import type { BuiltInSong } from '../music/songs'
import type { Note, Piece } from '../music/types'

const end = (notes: Note[]) => notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)

function piece(bpm: number, parts: Omit<Piece, 'bpm' | 'beatsPerBar' | 'lengthBeats'>, beatsPerBar = 4): Piece {
  const all = [...parts.melody, ...parts.target, ...(parts.cues ?? []), ...(parts.others ?? []).flat()]
  const length = Math.ceil(end(all) / beatsPerBar) * beatsPerBar
  return { bpm, beatsPerBar, lengthBeats: length, ...parts }
}

/** Level 1: hear a note (cue), then sing it. */
export function matchNotes(midis: number[], cueBeats: number, singBeats: number, bpm = 80): Piece {
  const cues: Note[] = []
  const target: Note[] = []
  let t = 0
  for (const m of midis) {
    cues.push({ start: t, dur: cueBeats, midi: m })
    target.push({ start: t + cueBeats, dur: singBeats, midi: m })
    t += cueBeats + singBeats + 1 // a beat to breathe
  }
  return piece(bpm, { melody: [], target, cues })
}

/**
 * Levels 2 to 4: a drone (melody lane) with the singer holding a note a given
 * number of semitones above (+) or below (-) it, repeated with breaths between.
 */
export function droneHold(droneMidi: number, interval: number, reps: number, holdBeats: number, bpm = 72): Piece {
  const target: Note[] = []
  let t = 1
  for (let i = 0; i < reps; i++) {
    target.push({ start: t, dur: holdBeats, midi: droneMidi + interval })
    t += holdBeats + 1
  }
  const melody: Note[] = [{ start: 0, dur: t, midi: droneMidi }]
  return piece(bpm, { melody, target })
}

/** Level 5: a major scale as the melody, with diatonic thirds above it. */
export function parallelThirds(upAndDown: boolean, bpm = 76): Piece {
  const key = { tonic: 0, mode: 'major' as const }
  const degrees = upAndDown ? [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const melody: Note[] = degrees.map((d, i) => ({
    start: i * 2,
    dur: 2,
    midi: 60 + MAJOR_STEPS[d % 7] + 12 * Math.floor(d / 7), // C major from middle C
  }))
  return piece(bpm, { melody, target: generatePart('thirdAbove', melody, { key, beatsPerBar: 4 }) })
}

/** Level 6: hold one note while the melody moves around (and through) it, breathing every two bars. */
export function holdAgainstMelody(holdMidi: number, melody: Note[], bpm = 84): Piece {
  const len = end(melody)
  const target: Note[] = []
  for (let t = 0; t < len; t += 8) target.push({ start: t, dur: Math.min(7, len - t), midi: holdMidi })
  return piece(bpm, { melody, target })
}

/** Levels 7 to 10: a built-in song with a generated part for the singer. */
export function songPart(song: BuiltInSong, part: PartKind, withLowPart = false): Piece {
  const opts = { key: song.key, beatsPerBar: song.beatsPerBar, chords: song.chords }
  const target = generatePart(part, song.melody, opts)
  const others = withLowPart ? [generatePart('low', song.melody, opts)] : undefined
  return piece(song.bpm, { melody: song.melody, target, others, chords: song.chords }, song.beatsPerBar)
}
