import { describe, expect, it } from 'vitest'
import { splitDuration, toBars } from '../../music/staff'
import { tidy } from '../../music/edit'

describe('staff helpers', () => {
  it('splits lengths into notatable values', () => {
    expect(splitDuration(1)).toEqual([['q', false]])
    expect(splitDuration(1.5)).toEqual([['q', true]])
    expect(splitDuration(2.5)).toEqual([['h', false], ['8', false]])
    expect(splitDuration(4)).toEqual([['w', false]])
  })

  it('fills bars with rests and splits notes across barlines', () => {
    const bars = toBars([{ start: 1, dur: 4, midi: 61 }], 4, 2)
    expect(bars[0].map((e) => [e.key, e.dur, e.dot])).toEqual([[null, 'q', false], ['c#/4', 'h', true]])
    expect(bars[1].map((e) => [e.key, e.dur, e.dot])).toEqual([['c#/4', 'q', false], [null, 'h', true]])
  })
})

describe('piano roll tidy', () => {
  it('sorts, trims overlaps and replaces same-slot notes', () => {
    expect(
      tidy([
        { start: 2, dur: 1, midi: 64 },
        { start: 0, dur: 3, midi: 60 },
        { start: 2, dur: 1, midi: 65 },
      ]),
    ).toEqual([
      { start: 0, dur: 2, midi: 60 },
      { start: 2, dur: 1, midi: 65 },
    ])
  })
})
