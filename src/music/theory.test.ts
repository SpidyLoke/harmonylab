import { describe, expect, it } from 'vitest'
import { chordPcs, chordSymbol, diatonicShift, diatonicTriads, inKey, parseChord, scalePcs } from './theory'
import { nameToMidi as n } from './notes'

const C = { tonic: 0, mode: 'major' as const }
const Am = { tonic: 9, mode: 'minor' as const }

describe('scales and diatonic steps', () => {
  it('builds scales', () => {
    expect(scalePcs(C)).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scalePcs(Am)).toEqual([9, 11, 0, 2, 4, 5, 7])
  })

  it('moves a third up and down within the key', () => {
    expect(diatonicShift(n('C4')!, 2, C)).toBe(n('E4'))
    expect(diatonicShift(n('E4')!, 2, C)).toBe(n('G4'))
    expect(diatonicShift(n('B4')!, 2, C)).toBe(n('D5'))
    expect(diatonicShift(n('C4')!, -2, C)).toBe(n('A3'))
    expect(diatonicShift(n('F4')!, -2, C)).toBe(n('D4'))
  })

  it('keeps chromatic notes parallel', () => {
    // F#4 in C: third above the scale note below (F4 → A4) plus the sharp → A#4.
    expect(diatonicShift(n('F#4')!, 2, C)).toBe(n('A#4'))
  })

  it('knows what is in the key', () => {
    expect(inKey(n('F#4')!, C)).toBe(false)
    expect(inKey(n('G#4')!, Am)).toBe(false)
  })
})

describe('chords', () => {
  it('parses common symbols', () => {
    expect(parseChord('Am')).toEqual({ root: 9, quality: 'min' })
    expect(parseChord('F#m7')).toEqual({ root: 6, quality: 'min7' })
    expect(parseChord('Bb')).toEqual({ root: 10, quality: 'maj' })
    expect(parseChord('G7')).toEqual({ root: 7, quality: '7' })
    expect(parseChord('Cmaj7')).toEqual({ root: 0, quality: 'maj7' })
    expect(parseChord('Bdim')).toEqual({ root: 11, quality: 'dim' })
    expect(parseChord('C/E')).toEqual({ root: 0, quality: 'maj' })
    expect(parseChord('Xyz')).toBeNull()
  })

  it('lists chord notes and names', () => {
    expect(chordPcs({ root: 7, quality: '7' })).toEqual([7, 11, 2, 5])
    expect(chordSymbol({ root: 9, quality: 'min' })).toBe('Am')
  })

  it('builds the diatonic triads', () => {
    expect(diatonicTriads(C).map(chordSymbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])
  })
})
