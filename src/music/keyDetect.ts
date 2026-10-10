// Suggests a key from the notes, using the Krumhansl-Kessler key profiles
// correlated against a duration-weighted pitch-class histogram.

import { chordPcs, parseChord } from './theory'
import type { ChordEvent, Key, Note } from './types'

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlate(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length
  const mb = b.reduce((s, x) => s + x, 0) / b.length
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

export interface KeyGuess {
  key: Key
  score: number
}

export function rankKeys(notes: Note[], chords: ChordEvent[] = []): KeyGuess[] {
  const hist = new Array(12).fill(0)
  for (const n of notes) hist[((Math.round(n.midi) % 12) + 12) % 12] += n.dur
  // Chords, when known, are strong evidence: their notes count, and the
  // first chord usually is the home chord.
  chords.forEach((c, i) => {
    const chord = parseChord(c.symbol)
    if (!chord) return
    for (const pc of chordPcs(chord)) hist[pc] += c.dur * 0.5
    if (i === 0) hist[chord.root] += c.dur
  })
  // Slight extra weight for the last note: tunes usually end on home.
  const last = notes.reduce<Note | null>((a, n) => (!a || n.start >= a.start ? n : a), null)
  if (last) hist[((Math.round(last.midi) % 12) + 12) % 12] += 0.5

  const out: KeyGuess[] = []
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - tonic + 12) % 12])
    out.push({ key: { tonic, mode: 'major' }, score: correlate(hist, rot(MAJOR_PROFILE)) })
    out.push({ key: { tonic, mode: 'minor' }, score: correlate(hist, rot(MINOR_PROFILE)) })
  }
  return out.sort((a, b) => b.score - a.score)
}

export function detectKey(notes: Note[], chords: ChordEvent[] = []): Key {
  if (notes.length === 0) return { tonic: 0, mode: 'major' }
  return rankKeys(notes, chords)[0].key
}
