import { describe, expect, it } from 'vitest'
import { accuracy, newItem, pickNext, recordAnswer, weightOf } from './repetition'

describe('Leitner repetition', () => {
  it('moves up on a hit and back to box 1 on a miss', () => {
    let i = newItem('M3')
    i = recordAnswer(i, true)
    i = recordAnswer(i, true)
    expect(i.box).toBe(3)
    i = recordAnswer(i, false)
    expect(i.box).toBe(1)
    expect(accuracy(i)).toBeCloseTo(2 / 3)
  })

  it('makes missed items come back more often', () => {
    const missed = { ...newItem('m2'), box: 1 }
    const known = { ...newItem('P5'), box: 5 }
    expect(weightOf(missed)).toBe(16 * weightOf(known))
    let count = 0
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 2000; k++) if (pickNext([missed, known], null, rand).id === 'm2') count++
    expect(count / 2000).toBeGreaterThan(0.9)
  })

  it('never repeats the last item when there is a choice', () => {
    const a = newItem('a')
    const b = newItem('b')
    for (let k = 0; k < 50; k++) expect(pickNext([a, b], 'a').id).toBe('b')
    expect(pickNext([a], 'a').id).toBe('a')
  })
})
