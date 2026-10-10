// Builds "today's session": about ten minutes made of one warm-up, one
// curriculum drill, one ear drill and one song section, biased toward the
// singer's weak spots.

import { LEVELS, type Drill, type Level } from '../curriculum/levels'
import { matchNotes, droneHold } from '../curriculum/builders'
import { EAR_DRILLS, type EarDrill } from '../ear/drills'
import type { Attempt, DrillProgress, EarItemRow, SongRow } from '../db/schema'
import { BUILT_IN_SONGS } from '../music/songs'
import type { Piece } from '../music/types'

export type SessionStep =
  | { kind: 'warmup'; title: string; minutes: number; piece: Piece }
  | { kind: 'drill'; title: string; minutes: number; level: Level; drill: Drill; why: string }
  | { kind: 'ear'; title: string; minutes: number; drill: EarDrill; why: string }
  | { kind: 'song'; title: string; minutes: number; songId: number | null; builtInId: string | null; fromBar: number; toBar: number; why: string }

export interface SessionInput {
  level: number
  drills: DrillProgress[]
  earItems: EarItemRow[]
  songs: SongRow[]
  attempts: Attempt[]
  /** Injectable for tests. */
  rand?: () => number
}

export function buildSession(input: SessionInput): SessionStep[] {
  const rand = input.rand ?? Math.random
  const steps: SessionStep[] = []

  // 1. Warm-up: easy pitch matching and a steady hold. Two minutes.
  const warm = matchNotes([60, 62, 64, 65, 67], 1, 2, 96)
  const hold = droneHold(60, 0, 1, 6, 72)
  const shift = warm.lengthBeats
  steps.push({
    kind: 'warmup',
    title: 'Warm-up: slide into five notes, then hold',
    minutes: 2,
    piece: {
      ...warm,
      lengthBeats: warm.lengthBeats + hold.lengthBeats,
      melody: hold.melody.map((n) => ({ ...n, start: n.start + shift })),
      target: [...warm.target, ...hold.target.map((n) => ({ ...n, start: n.start + shift }))],
    },
  })

  // 2. Curriculum drill: the weakest unpassed drill at the current level.
  const level = LEVELS.find((l) => l.n === input.level) ?? LEVELS[0]
  const progressOf = (d: Drill) => input.drills.find((p) => p.drillId === d.id)
  const unpassed = level.drills.filter((d) => !progressOf(d)?.passed)
  const pool = unpassed.length ? unpassed : level.drills
  const drill = [...pool].sort((a, b) => (progressOf(a)?.best ?? -1) - (progressOf(b)?.best ?? -1))[0]
  steps.push({
    kind: 'drill',
    title: `Level ${level.n}: ${drill.title}`,
    minutes: 3,
    level,
    drill,
    why: progressOf(drill) ? `Your best here is ${Math.round(progressOf(drill)!.best)}%.` : 'Next up in your level.',
  })

  // 3. Ear drill: the one with the lowest accuracy, or an untried one.
  const earScore = (d: EarDrill) => {
    const items = input.earItems.filter((i) => i.drill === d.id)
    const seen = items.reduce((s, i) => s + i.seen, 0)
    return seen ? items.reduce((s, i) => s + i.correct, 0) / seen : 0.5 + rand() * 0.01
  }
  const relevant = EAR_DRILLS.filter((d) => input.level >= 3 || !d.sung || d.id === 'sing-lower')
  const ear = [...relevant].sort((a, b) => earScore(a) - earScore(b))[0]
  steps.push({
    kind: 'ear',
    title: `Ear: ${ear.title}`,
    minutes: 2,
    drill: ear,
    why: input.earItems.some((i) => i.drill === ear.id) ? 'Your weakest ear drill.' : "One you haven't tried yet.",
  })

  // 4. Song section: four bars of the song with the lowest recent score.
  const songScore = (id: number) => {
    const rows = input.attempts.filter((a) => a.exerciseId === `song-${id}`)
    return rows.length ? rows.slice(-3).reduce((s, a) => s + a.score, 0) / Math.min(3, rows.length) : 50
  }
  if (input.songs.length) {
    const song = [...input.songs].sort((a, b) => songScore(a.id!) - songScore(b.id!))[0]
    const bars = Math.max(1, Math.ceil(song.melody.reduce((m, n) => Math.max(m, n.start + n.dur), 0) / song.beatsPerBar))
    const from = 1 + Math.floor(rand() * Math.max(1, bars - 3))
    steps.push({
      kind: 'song',
      title: `Song: ${song.title}, bars ${from} to ${Math.min(bars, from + 3)}`,
      minutes: 3,
      songId: song.id!,
      builtInId: null,
      fromBar: from,
      toBar: Math.min(bars, from + 3),
      why: 'Your lowest-scoring song lately.',
    })
  } else {
    const s = BUILT_IN_SONGS[Math.floor(rand() * BUILT_IN_SONGS.length)]
    steps.push({ kind: 'song', title: `Song: ${s.title}, bars 1 to 4`, minutes: 3, songId: null, builtInId: s.id, fromBar: 1, toBar: 4, why: 'A built-in song to try.' })
  }
  return steps
}
