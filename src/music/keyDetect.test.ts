import { describe, expect, it } from 'vitest'
import { detectKey } from './keyDetect'
import { parseMelody } from './notation'
import { BUILT_IN_SONGS } from './songs'
import { scalePcs } from './theory'

describe('detectKey', () => {
  it('finds C major from a C major tune', () => {
    expect(detectKey(parseMelody('C4/1 E4/1 G4/1 E4/1 F4/1 D4/1 B3/1 C4/2'))).toEqual({ tonic: 0, mode: 'major' })
  })

  it('finds A minor from a harmonic-minor tune', () => {
    expect(detectKey(parseMelody('A3/1 C4/1 E4/1 D4/1 C4/1 B3/1 G#3/1 A3/2'))).toEqual({ tonic: 9, mode: 'minor' })
  })

  it('finds G major when the tune uses F sharp', () => {
    expect(detectKey(parseMelody('G4/1 B4/1 D5/1 F#4/1 A4/1 C5/.5 B4/.5 G4/2'))).toEqual({ tonic: 7, mode: 'major' })
  })

  it('agrees with the built-in songs (a relative major/minor counts: same notes)', () => {
    for (const s of BUILT_IN_SONGS) {
      expect(scalePcs(detectKey(s.melody, s.chords)).sort(), s.title).toEqual(scalePcs(s.key).sort())
    }
  })
})
