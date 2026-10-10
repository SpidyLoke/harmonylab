// Scales, keys, diatonic steps and chords.

import type { Key } from './types'

export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
/** Natural minor. */
export const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export const mod12 = (n: number) => ((n % 12) + 12) % 12

export function pcName(pc: number): string {
  return PC_NAMES[mod12(pc)].replace('#', '♯').replace('b', '♭')
}

export function keyName(key: Key): string {
  return `${pcName(key.tonic)} ${key.mode}`
}

export function scalePcs(key: Key): number[] {
  return (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => mod12(key.tonic + s))
}

export function inKey(midi: number, key: Key): boolean {
  return scalePcs(key).includes(mod12(Math.round(midi)))
}

/** Nearest scale note at or below `midi`. */
export function scaleNoteAtOrBelow(midi: number, key: Key): number {
  const pcs = scalePcs(key)
  let m = Math.round(midi)
  while (!pcs.includes(mod12(m))) m--
  return m
}

/**
 * Moves `steps` scale steps up (positive) or down (negative) within the key.
 * Two steps is a third, five a sixth, seven an octave. A note outside the key
 * keeps its accidental relative to the scale note below it.
 */
export function diatonicShift(midi: number, steps: number, key: Key): number {
  const pcs = scalePcs(key)
  const base = scaleNoteAtOrBelow(midi, key)
  const offset = Math.round(midi) - base
  let m = base
  const dir = Math.sign(steps)
  for (let i = 0; i < Math.abs(steps); i++) {
    do m += dir
    while (!pcs.includes(mod12(m)))
  }
  return m + offset
}

// ---------- Chords ----------

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7' | 'min7' | 'sus2' | 'sus4'

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
}

export interface Chord {
  root: number
  quality: ChordQuality
}

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Parses "C", "Am", "F#m7", "Bb", "G7", "Cmaj7", "Bdim", "Dsus4", "C/E" (bass ignored). */
export function parseChord(symbol: string): Chord | null {
  const m = /^([A-Ga-g])([#♯b♭]?)(.*)$/.exec(symbol.trim().split('/')[0])
  if (!m) return null
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
  const root = mod12(LETTER[m[1].toUpperCase()] + acc)
  const rest = m[3]
  const table: [RegExp, ChordQuality][] = [
    [/^(maj7|M7|Δ7?)$/, 'maj7'],
    [/^(m7|min7|-7)$/, 'min7'],
    [/^(m|min|-)$/, 'min'],
    [/^(dim|°|o)$/, 'dim'],
    [/^(aug|\+)$/, 'aug'],
    [/^7$/, '7'],
    [/^sus2$/, 'sus2'],
    [/^sus4?$/, 'sus4'],
    [/^(maj|M)?$/, 'maj'],
  ]
  for (const [re, q] of table) if (re.test(rest)) return { root, quality: q }
  return null
}

export function chordPcs(chord: Chord): number[] {
  return CHORD_INTERVALS[chord.quality].map((i) => mod12(chord.root + i))
}

export function chordSymbol(chord: Chord): string {
  const suffix: Record<ChordQuality, string> = {
    maj: '',
    min: 'm',
    dim: 'dim',
    aug: 'aug',
    '7': '7',
    maj7: 'maj7',
    min7: 'm7',
    sus2: 'sus2',
    sus4: 'sus4',
  }
  return PC_NAMES[chord.root] + suffix[chord.quality]
}

/** The seven triads built on each degree of the key. */
export function diatonicTriads(key: Key): Chord[] {
  const qualities: ChordQuality[] =
    key.mode === 'major'
      ? ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
      : ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
  return steps.map((s, i) => ({ root: mod12(key.tonic + s), quality: qualities[i] }))
}

// ---------- Intervals ----------

export interface IntervalInfo {
  semitones: number
  short: string
  name: string
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 0, short: 'P1', name: 'unison' },
  { semitones: 1, short: 'm2', name: 'minor 2nd' },
  { semitones: 2, short: 'M2', name: 'major 2nd' },
  { semitones: 3, short: 'm3', name: 'minor 3rd' },
  { semitones: 4, short: 'M3', name: 'major 3rd' },
  { semitones: 5, short: 'P4', name: 'perfect 4th' },
  { semitones: 6, short: 'TT', name: 'tritone' },
  { semitones: 7, short: 'P5', name: 'perfect 5th' },
  { semitones: 8, short: 'm6', name: 'minor 6th' },
  { semitones: 9, short: 'M6', name: 'major 6th' },
  { semitones: 10, short: 'm7', name: 'minor 7th' },
  { semitones: 11, short: 'M7', name: 'major 7th' },
  { semitones: 12, short: 'P8', name: 'octave' },
]

export function intervalInfo(semitones: number): IntervalInfo {
  const s = Math.abs(semitones)
  return INTERVALS[s > 12 ? mod12(s) : s]
}
