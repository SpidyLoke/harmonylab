import { describe, expect, it } from 'vitest'
import { centsOff, hzToMidi, isNatural, midiToDisplayName, midiToHz, midiToName, nameToMidi } from './notes'

describe('notes', () => {
  it('maps A4 to 440 Hz and back', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6)
    expect(hzToMidi(440)).toBeCloseTo(69, 6)
  })

  it('maps middle C', () => {
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3)
    expect(midiToName(60)).toBe('C4')
  })

  it('names sharps and octaves', () => {
    expect(midiToName(61)).toBe('C#4')
    expect(midiToDisplayName(61)).toBe('C♯4')
    expect(midiToName(57)).toBe('A3')
    expect(midiToName(36)).toBe('C2')
    expect(midiToName(59.6)).toBe('C4')
  })

  it('parses names, including flats', () => {
    expect(nameToMidi('A4')).toBe(69)
    expect(nameToMidi('C#4')).toBe(61)
    expect(nameToMidi('Db4')).toBe(61)
    expect(nameToMidi('c♯4')).toBe(61)
    expect(nameToMidi('H2')).toBeNull()
  })

  it('measures cents, positive when sharp', () => {
    expect(centsOff(69.2, 69)).toBeCloseTo(20, 6)
    expect(centsOff(hzToMidi(430), 69)).toBeCloseTo(-39.85, 1)
  })

  it('knows naturals', () => {
    expect(isNatural(60)).toBe(true)
    expect(isNatural(61)).toBe(false)
  })
})
