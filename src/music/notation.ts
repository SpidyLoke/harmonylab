// Compact text form for writing melodies and chord charts in code.
//   melody: "E4/.5 E4/.5 G4/1 r/1 C5/1.5"   (note/beats, r = rest)
//   chords: "C | G | Am | F G"             (one bar each, split evenly inside a bar)

import { nameToMidi } from './notes'
import type { ChordEvent, Note } from './types'

export function parseMelody(text: string, startBeat = 0): Note[] {
  const notes: Note[] = []
  let t = startBeat
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue
    const [name, durText] = token.split('/')
    const dur = Number(durText ?? '1')
    if (!(dur > 0)) throw new Error(`Bad duration in "${token}"`)
    if (name !== 'r') {
      const midi = nameToMidi(name)
      if (midi === null) throw new Error(`Bad note in "${token}"`)
      notes.push({ start: t, dur, midi })
    }
    t += dur
  }
  return notes
}

export function parseChordChart(text: string, beatsPerBar: number, startBeat = 0): ChordEvent[] {
  const out: ChordEvent[] = []
  text
    .split('|')
    .map((bar) => bar.trim().split(/\s+/).filter(Boolean))
    .forEach((symbols, bar) => {
      const each = beatsPerBar / Math.max(1, symbols.length)
      symbols.forEach((symbol, i) =>
        out.push({ start: startBeat + bar * beatsPerBar + i * each, dur: each, symbol }),
      )
    })
  return out
}

export function endOf(notes: Note[]): number {
  return notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
}
