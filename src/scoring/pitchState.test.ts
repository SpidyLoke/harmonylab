import { describe, expect, it } from 'vitest'
import { classify, slightlyOffLimit, tierForLevel, TOLERANCE_CENTS } from './pitchState'

describe('tolerance tiers', () => {
  it('maps levels to tiers', () => {
    expect([1, 4].map(tierForLevel)).toEqual(['beginner', 'beginner'])
    expect([5, 7].map(tierForLevel)).toEqual(['intermediate', 'intermediate'])
    expect([8, 10].map(tierForLevel)).toEqual(['advanced', 'advanced'])
  })

  it('has the agreed cent values', () => {
    expect(TOLERANCE_CENTS).toEqual({ beginner: 50, intermediate: 30, advanced: 15 })
  })

  it('keeps the slightly-off band between a quarter tone and a semitone', () => {
    expect(slightlyOffLimit(50)).toBe(100)
    expect(slightlyOffLimit(30)).toBe(60)
    expect(slightlyOffLimit(15)).toBe(50)
  })
})

describe('classify', () => {
  it('is in tune inside the tolerance, inclusive', () => {
    expect(classify(0, 30)).toEqual({ state: 'inTune', direction: null })
    expect(classify(30, 30).state).toBe('inTune')
    expect(classify(-30, 30).state).toBe('inTune')
  })

  it('is slightly off just outside, with direction', () => {
    expect(classify(31, 30)).toEqual({ state: 'slightlyOff', direction: 'sharp' })
    expect(classify(-45, 30)).toEqual({ state: 'slightlyOff', direction: 'flat' })
  })

  it('is off beyond the band', () => {
    expect(classify(61, 30)).toEqual({ state: 'off', direction: 'sharp' })
    expect(classify(-120, 50)).toEqual({ state: 'off', direction: 'flat' })
  })

  it('is stricter at advanced', () => {
    expect(classify(20, 15).state).toBe('slightlyOff')
    expect(classify(20, 50).state).toBe('inTune')
  })
})
