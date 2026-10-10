// How close is the singer to the target, in the three states the UI shows.

export type ToleranceTier = 'beginner' | 'intermediate' | 'advanced'

export const TOLERANCE_CENTS: Record<ToleranceTier, number> = {
  beginner: 50,
  intermediate: 30,
  advanced: 15,
}

/** Levels 1 to 4 beginner, 5 to 7 intermediate, 8 to 10 advanced. */
export function tierForLevel(level: number): ToleranceTier {
  if (level <= 4) return 'beginner'
  if (level <= 7) return 'intermediate'
  return 'advanced'
}

export type PitchState = 'inTune' | 'slightlyOff' | 'off'
export type Direction = 'sharp' | 'flat' | null

/**
 * Upper edge of the "slightly off" band. Twice the tolerance, but never
 * narrower than 50 cents (a quarter tone) nor wider than 100 (a semitone),
 * so advanced singers still get a usable "nearly" zone and beginners a full
 * semitone before they are called off.
 */
export function slightlyOffLimit(toleranceCents: number): number {
  return Math.min(100, Math.max(50, toleranceCents * 2))
}

export interface Classification {
  state: PitchState
  direction: Direction
}

export function classify(cents: number, toleranceCents: number): Classification {
  const abs = Math.abs(cents)
  if (abs <= toleranceCents) return { state: 'inTune', direction: null }
  const direction: Direction = cents > 0 ? 'sharp' : 'flat'
  if (abs <= slightlyOffLimit(toleranceCents)) return { state: 'slightlyOff', direction }
  return { state: 'off', direction }
}
