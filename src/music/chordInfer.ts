// Guesses one chord per bar (or half bar) from the notes sounding there, so
// the chord-aware part works even when nobody typed the chords in.

import { chordPcs, chordSymbol, diatonicTriads } from './theory'
import type { ChordEvent, Key, Note } from './types'

export function inferChords(notes: Note[], key: Key, beatsPerBar: number, lengthBeats: number, perBar = 1): ChordEvent[] {
  const span = beatsPerBar / perBar
  const triads = diatonicTriads(key)
  const out: ChordEvent[] = []
  let prev = -1
  for (let start = 0; start < lengthBeats - 1e-6; start += span) {
    const end = start + span
    const weight = new Array(12).fill(0)
    for (const n of notes) {
      const overlap = Math.min(end, n.start + n.dur) - Math.max(start, n.start)
      if (overlap <= 0) continue
      // Notes on the beat count more than passing notes.
      const onBeat = Math.abs(n.start - Math.round(n.start)) < 1e-6 ? 1.5 : 1
      weight[((Math.round(n.midi) % 12) + 12) % 12] += overlap * onBeat
    }
    let best = 0
    let bestScore = -Infinity
    triads.forEach((t, i) => {
      if (t.quality === 'dim') return // rarely the right guess
      const pcs = chordPcs(t)
      let s = 0
      for (let pc = 0; pc < 12; pc++) s += pcs.includes(pc) ? weight[pc] : -0.6 * weight[pc]
      s += weight[t.root] * 0.3 // the root itself sounding is strong evidence
      if (i === 0) s += 0.25 // slight pull to the home chord
      if (i === prev) s += 0.1
      if (s > bestScore) {
        bestScore = s
        best = i
      }
    })
    prev = best
    out.push({ start, dur: Math.min(span, lengthBeats - start), symbol: chordSymbol(triads[best]) })
  }
  return out
}
