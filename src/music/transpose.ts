// Fits a part into the singer's range by moving it whole semitones.

import type { Note, Piece } from './types'

/**
 * Best semitone shift so `midis` sit inside [low, high]. Minimises how far
 * notes fall outside the range, then centres the part in the range.
 */
export function fitShift(midis: number[], low: number, high: number): number {
  if (midis.length === 0) return 0
  const lo = Math.min(...midis)
  const hi = Math.max(...midis)
  const partCentre = (lo + hi) / 2
  const rangeCentre = (low + high) / 2
  let best = 0
  let bestCost = Infinity
  for (let s = -36; s <= 36; s++) {
    const overflow = Math.max(0, low - (lo + s)) + Math.max(0, hi + s - high)
    const off = Math.abs(partCentre + s - rangeCentre)
    const cost = overflow * 100 + off + Math.abs(s) * 0.01 // ties: move as little as possible
    if (cost < bestCost) {
      bestCost = cost
      best = s
    }
  }
  return best + 0 // normalise -0
}

const shiftNotes = (notes: Note[], s: number) => notes.map((n) => ({ ...n, midi: n.midi + s }))

/** Transposes the whole piece so the singer's part fits their range. */
export function fitPieceToRange(piece: Piece, low: number, high: number): { piece: Piece; shift: number } {
  const s = fitShift(
    piece.target.map((n) => n.midi),
    low,
    high,
  )
  if (s === 0) return { piece, shift: 0 }
  return {
    shift: s,
    piece: {
      ...piece,
      melody: shiftNotes(piece.melody, s),
      target: shiftNotes(piece.target, s),
      cues: piece.cues && shiftNotes(piece.cues, s),
      others: piece.others?.map((o) => shiftNotes(o, s)),
      // Chord symbols are re-spelled by the pad from the shifted root at play time.
      chords: piece.chords?.map((c) => ({ ...c, symbol: transposeSymbol(c.symbol, s) })),
    },
  }
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function transposeSymbol(symbol: string, s: number): string {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol)
  if (!m) return symbol
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]!
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return NAMES[(((base + acc + s) % 12) + 12) % 12] + m[3]
}
