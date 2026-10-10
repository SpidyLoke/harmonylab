// Editing helpers for single-line parts.

import type { Note } from './types'

/** Removes overlaps (keeps one note at a time) and sorts by time. */
export function tidy(notes: Note[]): Note[] {
  const sorted = [...notes].filter((n) => n.dur > 0.01).sort((a, b) => a.start - b.start)
  const out: Note[] = []
  for (const n of sorted) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.start - n.start) < 1e-6) {
      out[out.length - 1] = n // same slot: newest wins
      continue
    }
    if (prev && prev.start + prev.dur > n.start) prev.dur = n.start - prev.start
    out.push({ ...n })
  }
  return out
}
