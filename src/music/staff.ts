// Splits notes into bars and notatable lengths for the staff view.

import type { Note } from './types'

const DURATIONS: [number, string, boolean][] = [
  [4, 'w', false],
  [3, 'h', true],
  [2, 'h', false],
  [1.5, 'q', true],
  [1, 'q', false],
  [0.75, '8', true],
  [0.5, '8', false],
  [0.25, '16', false],
]

/** Splits a length in beats into notatable pieces, largest first. */
export function splitDuration(beats: number): [string, boolean][] {
  const out: [string, boolean][] = []
  let left = Math.round(beats * 4) / 4
  while (left >= 0.25 - 1e-9) {
    const d = DURATIONS.find(([len]) => len <= left + 1e-9)!
    out.push([d[1], d[2]])
    left -= d[0]
  }
  return out
}

const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']
const vfKey = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}/${Math.floor(midi / 12) - 1}`

interface BarEvent {
  key: string | null // null = rest
  dur: string
  dot: boolean
  acc: string | null
}

/** Cuts notes into bars, filling gaps with rests. */
export function toBars(notes: Note[], beatsPerBar: number, bars: number): BarEvent[][] {
  const out: BarEvent[][] = []
  const sorted = [...notes].sort((a, b) => a.start - b.start)
  for (let b = 0; b < bars; b++) {
    const from = b * beatsPerBar
    const to = from + beatsPerBar
    const events: BarEvent[] = []
    let t = from
    const push = (len: number, midi: number | null) => {
      for (const [dur, dot] of splitDuration(len)) {
        const name = midi === null ? null : NAMES[((midi % 12) + 12) % 12]
        events.push({ key: midi === null ? null : vfKey(midi), dur, dot, acc: name && name.length > 1 ? name[1] : null })
      }
    }
    for (const n of sorted) {
      const s = Math.max(n.start, from)
      const e = Math.min(n.start + n.dur, to)
      if (e <= s + 1e-9) continue
      if (s > t + 1e-9) push(s - t, null)
      push(e - s, n.midi)
      t = e
    }
    if (to > t + 1e-9) push(to - t, null)
    out.push(events)
  }
  return out
}
