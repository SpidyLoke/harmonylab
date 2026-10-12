// Generates harmony parts from a melody.
//
// Method:
// - Thirds and sixths are diatonic: move two scale steps (or a third up, then
//   an octave down for a sixth below), so the part stays in key.
// - On strong beats (beats 1 and 3 in 4/4, beat 1 otherwise) a note that
//   clashes with the melody (a 2nd, 7th or tritone) or with the chord
//   underneath (a semitone against any chord note) is swapped for the nearest
//   note that fits, keeping the part on the same side of the melody.
// - The chord-aware part picks, for each melody note, a chord note 3 to 9
//   semitones below (or above) the melody, preferring 3rds and 6ths, then the
//   smallest jump from the previous harmony note.

import { chordPcs, diatonicShift, mod12, parseChord, scalePcs, type Chord } from '../theory'
import type { ChordEvent, Key, Note } from '../types'

export type PartKind = 'melody' | 'round' | 'thirdAbove' | 'thirdBelow' | 'sixthBelow' | 'chordBelow' | 'chordAbove' | 'low'

export const PART_LABELS: Record<PartKind, string> = {
  melody: 'Melody (sing along)',
  round: 'Second voice of the round',
  thirdAbove: 'Third above',
  thirdBelow: 'Third below',
  sixthBelow: 'Sixth below',
  chordBelow: 'Chord-aware (below)',
  chordAbove: 'Chord-aware (above)',
  low: 'Low part (chord roots)',
}

export interface HarmonyOptions {
  key: Key
  beatsPerBar: number
  chords?: ChordEvent[]
  /** For rounds: beats before the second voice comes in. */
  roundOffset?: number
}

/** Interval classes that clash when sounded against the melody. */
const MELODY_CLASH = new Set([1, 2, 6, 10, 11])
const SWEET = new Set([3, 4, 8, 9]) // 3rds and 6ths
const OPEN = new Set([5, 7]) // 4ths and 5ths

export function isStrongBeat(start: number, beatsPerBar: number): boolean {
  if (Math.abs(start - Math.round(start)) > 1e-6) return false
  const pos = ((Math.round(start) % beatsPerBar) + beatsPerBar) % beatsPerBar
  if (pos === 0) return true
  return beatsPerBar === 4 && pos === 2
}

export function chordAt(chords: ChordEvent[] | undefined, beat: number): Chord | null {
  if (!chords) return null
  const ev = chords.find((c) => c.start <= beat + 1e-6 && beat < c.start + c.dur - 1e-6)
  return ev ? parseChord(ev.symbol) : null
}

export function clashesWithMelody(harmony: number, melody: number): boolean {
  return MELODY_CLASH.has(mod12(Math.abs(harmony - melody)))
}

export function clashesWithChord(harmony: number, chord: Chord | null): boolean {
  if (!chord) return false
  const pc = mod12(harmony)
  return chordPcs(chord).some((c) => {
    const d = mod12(pc - c)
    return d === 1 || d === 11
  })
}

/** Nearest in-key note on the correct side of the melody that clashes with nothing. */
function fixClash(candidate: number, melody: number, above: boolean, key: Key, chord: Chord | null): number {
  const pcs = scalePcs(key)
  const ok = (m: number) => {
    const iv = above ? m - melody : melody - m
    if (iv < 3 || iv > 12) return false
    if (clashesWithMelody(m, melody) || clashesWithChord(m, chord)) return false
    return chord ? chordPcs(chord).includes(mod12(m)) || pcs.includes(mod12(m)) : pcs.includes(mod12(m))
  }
  for (let d = 1; d <= 4; d++) {
    // Prefer chord notes, then scale notes, nearest first.
    for (const m of [candidate - d, candidate + d]) {
      if (ok(m) && chord && chordPcs(chord).includes(mod12(m))) return m
    }
    for (const m of [candidate - d, candidate + d]) if (ok(m)) return m
  }
  return candidate
}

function parallel(melody: Note[], steps: number, octave: number, opts: HarmonyOptions): Note[] {
  const above = steps > 0 && octave === 0
  return melody.map((n) => {
    let m = diatonicShift(n.midi, steps, opts.key) + octave
    if (isStrongBeat(n.start, opts.beatsPerBar)) {
      const chord = chordAt(opts.chords, n.start)
      if (clashesWithMelody(m, n.midi) || clashesWithChord(m, chord)) {
        m = fixClash(m, n.midi, above, opts.key, chord)
      }
    }
    return { ...n, midi: m }
  })
}

function chordAware(melody: Note[], above: boolean, opts: HarmonyOptions): Note[] {
  let prev: number | null = null
  return melody.map((n) => {
    const chord = chordAt(opts.chords, n.start)
    const fallback = diatonicShift(n.midi, above ? 2 : -2, opts.key)
    if (!chord) {
      prev = fallback
      return { ...n, midi: fallback }
    }
    const pcs = chordPcs(chord)
    const candidates: number[] = []
    for (let iv = 3; iv <= 9; iv++) {
      const m = above ? n.midi + iv : n.midi - iv
      if (pcs.includes(mod12(m)) && mod12(m) !== mod12(n.midi) && !clashesWithMelody(m, n.midi)) candidates.push(m)
    }
    if (candidates.length === 0) {
      prev = fallback
      return { ...n, midi: fallback }
    }
    const score = (m: number) => {
      const iv = Math.abs(m - n.midi)
      const quality = SWEET.has(iv) ? 0 : OPEN.has(iv) ? 1.5 : 3
      const leap = prev === null ? 0 : Math.abs(m - prev) * 0.6
      return quality + leap
    }
    candidates.sort((a, b) => score(a) - score(b))
    prev = candidates[0]
    return { ...n, midi: candidates[0] }
  })
}

/** Chord roots placed below `upper`, one note per chord. */
function lowPart(upper: Note[], opts: HarmonyOptions, lengthBeats: number): Note[] {
  const chords = opts.chords ?? []
  const out: Note[] = []
  for (const ev of chords) {
    if (ev.start >= lengthBeats) break
    const chord = parseChord(ev.symbol)
    if (!chord) continue
    const during = upper.filter((n) => n.start < ev.start + ev.dur && n.start + n.dur > ev.start)
    const ceiling = (during.length ? Math.min(...during.map((n) => n.midi)) : 55) - 3
    let m = ceiling
    while (mod12(m) !== chord.root) m--
    out.push({ start: ev.start, dur: Math.min(ev.dur, lengthBeats - ev.start), midi: m })
  }
  return out
}

export function generatePart(kind: PartKind, melody: Note[], opts: HarmonyOptions): Note[] {
  switch (kind) {
    case 'melody':
      return melody.map((n) => ({ ...n }))
    case 'round':
      // The same tune, starting later: the oldest kind of harmony.
      return melody.map((n) => ({ ...n, start: n.start + (opts.roundOffset ?? opts.beatsPerBar * 2) }))
    case 'thirdAbove':
      return parallel(melody, 2, 0, opts)
    case 'thirdBelow':
      return parallel(melody, -2, 0, opts)
    case 'sixthBelow':
      // A sixth below is a third above, dropped an octave.
      return parallel(melody, 2, -12, opts)
    case 'chordBelow':
      return chordAware(melody, false, opts)
    case 'chordAbove':
      return chordAware(melody, true, opts)
    case 'low': {
      const middle = chordAware(melody, false, opts)
      const length = melody.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
      return lowPart(middle, opts, length)
    }
  }
}

/** Harmony parts that make sense for this song (the melody itself is always available too). */
export function availableParts(hasChords: boolean, isRound = false): PartKind[] {
  const base: PartKind[] = hasChords
    ? ['thirdAbove', 'thirdBelow', 'sixthBelow', 'chordBelow', 'chordAbove']
    : ['thirdAbove', 'thirdBelow', 'sixthBelow']
  return isRound ? ['round', ...base] : base
}
