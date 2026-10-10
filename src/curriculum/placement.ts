// Placement check: five short tasks, easiest first. Each passed in a row
// moves the starting level up one, to a maximum of level 5. Above that has
// to be earned.

import { droneHold, holdAgainstMelody, matchNotes } from './builders'
import { parseMelody } from '../music/notation'
import type { Piece } from '../music/types'

export interface PlacementTask {
  id: string
  title: string
  instruction: string
  build: () => Piece
}

/** Adds a listen-first cue of the target's first note, so tasks are fair with the guide off. */
function withCue(p: Piece): Piece {
  const first = p.target[0]
  const shift = 3
  const move = (n: { start: number; dur: number; midi: number }) => ({ ...n, start: n.start + shift })
  return {
    ...p,
    lengthBeats: p.lengthBeats + shift,
    cues: [{ start: 0, dur: 2, midi: first.midi }, ...(p.cues ?? []).map(move)],
    melody: p.melody.map(move),
    target: p.target.map(move),
    others: p.others?.map((o) => o.map(move)),
  }
}

export const PLACEMENT_TASKS: PlacementTask[] = [
  {
    id: 'place-match',
    title: 'Match two notes',
    instruction: 'Listen to each note, then sing it back on "ah".',
    build: () => matchNotes([60, 64], 2, 3),
  },
  {
    id: 'place-hold',
    title: 'Hold against a drone',
    instruction: 'Sing the same note as the drone and keep it steady.',
    build: () => droneHold(60, 0, 1, 6),
  },
  {
    id: 'place-fifth',
    title: 'Fifth above',
    instruction: 'You will hear your note once. Then hold it a fifth above the drone.',
    build: () => withCue(droneHold(55, 7, 2, 4)),
  },
  {
    id: 'place-third',
    title: 'Third above',
    instruction: 'You will hear your note once. Then hold it a third above the drone.',
    build: () => withCue(droneHold(57, 4, 2, 4)),
  },
  {
    id: 'place-hold-melody',
    title: 'Hold while the melody moves',
    instruction: 'You will hear your note once. Hold it while the melody moves underneath.',
    build: () => withCue(holdAgainstMelody(67, parseMelody('C4/1 E4/1 G4/1 E4/1 F4/1 D4/1 B3/1 D4/1'))),
  },
]

export const PLACEMENT_PASS = 70
export const PLACEMENT_MAX_LEVEL = 5

/** Starting level from task scores (in order). Stops counting at the first fail. */
export function placementLevel(scores: number[]): number {
  let passed = 0
  for (const s of scores) {
    if (s >= PLACEMENT_PASS) passed++
    else break
  }
  return Math.min(PLACEMENT_MAX_LEVEL, 1 + passed)
}
