import { describe, expect, it } from 'vitest'
import { chordAt, clashesWithChord, clashesWithMelody, generatePart, isStrongBeat } from './generator'
import { inKey, mod12 } from '../theory'
import { BUILT_IN_SONGS } from '../songs'
import { parseChordChart, parseMelody } from '../notation'
import { nameToMidi as n } from '../notes'
import type { Key } from '../types'

const C: Key = { tonic: 0, mode: 'major' }

describe('strong beats', () => {
  it('are beats 1 and 3 in 4/4, beat 1 in 3/4', () => {
    expect([0, 1, 2, 3, 4, 6].map((b) => isStrongBeat(b, 4))).toEqual([true, false, true, false, true, true])
    expect(isStrongBeat(0.5, 4)).toBe(false)
    expect([0, 1, 2, 3].map((b) => isStrongBeat(b, 3))).toEqual([true, false, false, true])
  })
})

describe('parallel parts', () => {
  const scale = parseMelody('C4/1 D4/1 E4/1 F4/1 G4/1 A4/1 B4/1 C5/1')

  it('third above follows the scale a third up and stays in key', () => {
    const part = generatePart('thirdAbove', scale, { key: C, beatsPerBar: 4 })
    expect(part.map((x) => x.midi)).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'].map((s) => n(s)))
    part.forEach((x) => expect(inKey(x.midi, C)).toBe(true))
  })

  it('third below sits under the melody', () => {
    const part = generatePart('thirdBelow', scale, { key: C, beatsPerBar: 4 })
    expect(part[0].midi).toBe(n('A3'))
    part.forEach((x, i) => {
      const gap = scale[i].midi - x.midi
      expect(gap === 3 || gap === 4).toBe(true)
    })
  })

  it('sixth below is 8 or 9 semitones under the melody', () => {
    const part = generatePart('sixthBelow', scale, { key: C, beatsPerBar: 4 })
    part.forEach((x, i) => {
      const gap = scale[i].midi - x.midi
      expect(gap === 8 || gap === 9).toBe(true)
    })
  })

  it('keeps timing identical to the melody', () => {
    const part = generatePart('thirdAbove', scale, { key: C, beatsPerBar: 4 })
    expect(part.map((x) => [x.start, x.dur])).toEqual(scale.map((x) => [x.start, x.dur]))
  })

  it('fixes a strong-beat clash with the chord', () => {
    // Melody C over an F chord: a plain third above (E) rubs against F.
    const melody = parseMelody('C4/4')
    const chords = parseChordChart('F', 4)
    const part = generatePart('thirdAbove', melody, { key: C, beatsPerBar: 4, chords })
    expect(clashesWithChord(part[0].midi, chordAt(chords, 0))).toBe(false)
    expect(part[0].midi).toBeGreaterThan(melody[0].midi)
  })
})

describe('chord-aware parts', () => {
  it('uses chord notes, avoids the melody note, and stays below', () => {
    const melody = parseMelody('E4/2 G4/2 A4/2 F4/2')
    const chords = parseChordChart('C | Am F', 4)
    const part = generatePart('chordBelow', melody, { key: C, beatsPerBar: 4, chords })
    part.forEach((x, i) => {
      const chord = chordAt(chords, x.start)!
      const pcs = [0, 4, 7].map((iv) => mod12(chord.root + iv))
      const triad = chord.quality === 'min' ? [0, 3, 7].map((iv) => mod12(chord.root + iv)) : pcs
      expect(triad).toContain(mod12(x.midi))
      expect(mod12(x.midi)).not.toBe(mod12(melody[i].midi))
      expect(x.midi).toBeLessThan(melody[i].midi)
    })
  })

  it('moves smoothly: no leap bigger than a fifth between neighbours', () => {
    const s = BUILT_IN_SONGS[0]
    const part = generatePart('chordBelow', s.melody, { key: s.key, beatsPerBar: 4, chords: s.chords })
    for (let i = 1; i < part.length; i++) {
      const leap = Math.abs(part[i].midi - part[i - 1].midi)
      const melodyLeap = Math.abs(s.melody[i].midi - s.melody[i - 1].midi)
      expect(leap).toBeLessThanOrEqual(Math.max(7, melodyLeap))
    }
  })

  it('low part gives one chord root per chord, under the middle part', () => {
    const s = BUILT_IN_SONGS[2]
    const opts = { key: s.key, beatsPerBar: 4, chords: s.chords }
    const low = generatePart('low', s.melody, opts)
    const middle = generatePart('chordBelow', s.melody, opts)
    expect(low.length).toBe(s.chords.length)
    low.forEach((x) => {
      const chord = chordAt(s.chords, x.start)!
      expect(mod12(x.midi)).toBe(chord.root)
      const over = middle.filter((m) => m.start < x.start + x.dur && m.start + m.dur > x.start)
      over.forEach((m) => expect(x.midi).toBeLessThan(m.midi))
    })
  })
})

describe('every built-in song, every part', () => {
  for (const s of BUILT_IN_SONGS) {
    for (const kind of ['thirdAbove', 'thirdBelow', 'sixthBelow', 'chordBelow', 'chordAbove'] as const) {
      it(`${s.title}: ${kind} has no strong-beat clash with the melody`, () => {
        const part = generatePart(kind, s.melody, { key: s.key, beatsPerBar: 4, chords: s.chords })
        expect(part.length).toBe(s.melody.length)
        part.forEach((x, i) => {
          if (isStrongBeat(x.start, 4)) expect(clashesWithMelody(x.midi, s.melody[i].midi)).toBe(false)
        })
      })
    }
  }
})
