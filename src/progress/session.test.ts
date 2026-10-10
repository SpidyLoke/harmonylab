import { describe, expect, it } from 'vitest'
import { buildSession } from './session'
import type { SongRow } from '../db/schema'

describe("today's session", () => {
  it('has a warm-up, a drill, an ear drill and a song section, about ten minutes', () => {
    const s = buildSession({ level: 1, drills: [], earItems: [], songs: [], attempts: [], rand: () => 0.3 })
    expect(s.map((x) => x.kind)).toEqual(['warmup', 'drill', 'ear', 'song'])
    expect(s.reduce((m, x) => m + x.minutes, 0)).toBe(10)
  })

  it('picks the weakest unpassed drill at the current level', () => {
    const s = buildSession({
      level: 3,
      drills: [
        { drillId: 'l3-octave-up', stage: 3, passed: true, best: 90, last: 90, count: 3, lastAt: 1 },
        { drillId: 'l3-fifth-up', stage: 1, passed: false, best: 70, last: 60, count: 2, lastAt: 1 },
        { drillId: 'l3-third-up', stage: 1, passed: false, best: 40, last: 40, count: 2, lastAt: 1 },
        { drillId: 'l3-sixth-up', stage: 1, passed: false, best: 55, last: 40, count: 2, lastAt: 1 },
      ],
      earItems: [],
      songs: [],
      attempts: [],
    })
    const d = s[1]
    expect(d.kind === 'drill' && d.drill.id).toBe('l3-third-up')
  })

  it('picks the weakest ear drill and the lowest-scoring song', () => {
    const song = (id: number): SongRow => ({
      id, title: `S${id}`, bpm: 90, beatsPerBar: 4, key: { tonic: 0, mode: 'major' }, melody: [{ start: 0, dur: 32, midi: 60 }], chords: [], parts: {}, editedParts: [], selectedPart: 'thirdAbove', backing: null, source: 'manual', createdAt: 1, updatedAt: 1,
    })
    const s = buildSession({
      level: 5,
      drills: [],
      earItems: [
        { id: 'interval-up|M3', drill: 'interval-up', box: 1, seen: 10, correct: 2, lastSeen: 1 },
        ...['interval-down', 'interval-together', 'sing-lower', 'sing-upper', 'chord-quality', 'missing-third', 'find-harmony'].map((d) => ({ id: `${d}|x`, drill: d, box: 3, seen: 10, correct: 9, lastSeen: 1 })),
      ],
      songs: [song(1), song(2)],
      attempts: [
        { at: 1, day: 'd', kind: 'song', exerciseId: 'song-1', title: '', score: 90, avgCents: 0, seconds: 1 },
        { at: 1, day: 'd', kind: 'song', exerciseId: 'song-2', title: '', score: 30, avgCents: 0, seconds: 1 },
      ],
      rand: () => 0,
    })
    expect(s[2].kind === 'ear' && s[2].drill.id).toBe('interval-up')
    expect(s[3].kind === 'song' && s[3].songId).toBe(2)
  })
})
