// Live "you slid to the melody" detection: over the last quarter second,
// is the singer sitting on the melody note instead of their own?

import { centsOff } from '../music/notes'

export function slidToMelody(
  recent: (number | null)[],
  targetMidi: number,
  melodyMidi: number | null,
  toleranceCents: number,
): boolean {
  if (melodyMidi === null || Math.abs(melodyMidi - targetMidi) < 0.5) return false
  const voiced = recent.filter((m): m is number => m !== null)
  if (voiced.length < recent.length * 0.6 || voiced.length < 5) return false
  const near = Math.max(toleranceCents, 35)
  const onMelody = voiced.filter((m) => Math.abs(centsOff(m, melodyMidi)) <= near).length
  return onMelody / voiced.length >= 0.7
}
