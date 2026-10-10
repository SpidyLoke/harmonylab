import { describe, expect, it } from 'vitest'
import { fitPieceToRange, fitShift, transposeSymbol } from './transpose'

describe('fitShift', () => {
  it('leaves a part that already fits roughly centred', () => {
    expect(fitShift([57, 60, 64], 50, 70)).toBe(0)
  })

  it('moves a part down into a low voice', () => {
    const s = fitShift([67, 69, 72, 76], 45, 62) // G4..E5 into A2..D4
    expect(67 + s).toBeGreaterThanOrEqual(45)
    expect(76 + s).toBeLessThanOrEqual(62)
  })

  it('moves up into a high voice', () => {
    const s = fitShift([48, 52, 55], 60, 79)
    expect(48 + s).toBeGreaterThanOrEqual(60)
    expect(55 + s).toBeLessThanOrEqual(79)
  })

  it('centres when the range is wider than needed', () => {
    const s = fitShift([60, 62], 48, 76)
    expect(61 + s).toBe(62)
  })

  it('minimises overflow when the part is wider than the range', () => {
    const s = fitShift([50, 70], 55, 65)
    expect(Math.max(0, 55 - (50 + s)) + Math.max(0, 70 + s - 65)).toBe(10)
  })
})

describe('fitPieceToRange', () => {
  it('shifts every part and the chord names together', () => {
    const { piece, shift } = fitPieceToRange(
      {
        bpm: 90,
        beatsPerBar: 4,
        lengthBeats: 4,
        melody: [{ start: 0, dur: 4, midi: 72 }],
        target: [{ start: 0, dur: 4, midi: 76 }],
        chords: [{ start: 0, dur: 4, symbol: 'C' }],
      },
      45,
      60,
    )
    expect(Number.isInteger(shift)).toBe(true)
    expect(piece.target[0].midi).toBeLessThanOrEqual(60)
    expect(piece.melody[0].midi - piece.target[0].midi).toBe(-4)
    expect(piece.chords![0].symbol).toBe(transposeSymbol('C', shift))
  })

  it('transposes chord symbols keeping the quality', () => {
    expect(transposeSymbol('Am7', 2)).toBe('Bm7')
    expect(transposeSymbol('F', -1)).toBe('E')
    expect(transposeSymbol('C', -12)).toBe('C')
  })
})
