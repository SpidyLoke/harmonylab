import { describe, expect, it } from 'vitest'
import { inferChords } from './chordInfer'
import { parseMelody } from './notation'

describe('inferChords', () => {
  it('reads I–V–vi–IV from block chords', () => {
    const chords = [
      'C4/4', 'E4/4', 'G4/4',
    ].flatMap((x) => parseMelody(x, 0))
      .concat(['G3/4', 'B3/4', 'D4/4'].flatMap((x) => parseMelody(x, 4)))
      .concat(['A3/4', 'C4/4', 'E4/4'].flatMap((x) => parseMelody(x, 8)))
      .concat(['F3/4', 'A3/4', 'C4/4'].flatMap((x) => parseMelody(x, 12)))
    const out = inferChords(chords, { tonic: 0, mode: 'major' }, 4, 16)
    expect(out.map((c) => c.symbol)).toEqual(['C', 'G', 'Am', 'F'])
    expect(out.map((c) => c.start)).toEqual([0, 4, 8, 12])
  })

  it('guesses sensible chords from a melody alone', () => {
    const melody = parseMelody('C4/1 E4/1 G4/1 E4/1 B3/1 D4/1 G4/2')
    const out = inferChords(melody, { tonic: 0, mode: 'major' }, 4, 8)
    expect(out.map((c) => c.symbol)).toEqual(['C', 'G'])
  })
})
