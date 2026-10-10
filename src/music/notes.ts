// Pitch maths. "midi" here means a MIDI note number, possibly fractional:
// 60 = middle C (C4), 69 = A4 = 440 Hz, 1.0 = one semitone, 0.01 = one cent.

export const A4_HZ = 440
export const A4_MIDI = 69

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function hzToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ)
}

export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** Signed distance in cents from `targetMidi` to `midi`. Positive = sharp (too high). */
export function centsOff(midi: number, targetMidi: number): number {
  return (midi - targetMidi) * 100
}

/** Pitch class 0..11 (C = 0). */
export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

export function octaveOf(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1
}

/** "A3", "C#4". Rounds to the nearest note. */
export function midiToName(midi: number): string {
  return `${SHARP_NAMES[pitchClass(midi)]}${octaveOf(midi)}`
}

/** Display form with a real sharp sign: "C♯4". */
export function midiToDisplayName(midi: number): string {
  return midiToName(midi).replace('#', '♯')
}

/** Parses "A3", "C#4", "Db2", "c♯4". Returns null if it cannot. */
export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(name.trim())
  if (!m) return null
  const base = SHARP_NAMES.indexOf(m[1].toUpperCase() as (typeof SHARP_NAMES)[number])
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + base + acc
}

export function isNatural(midi: number): boolean {
  return !SHARP_NAMES[pitchClass(midi)].includes('#')
}
