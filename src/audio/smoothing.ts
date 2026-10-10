// Cleans up the raw stream of readings before it is drawn or scored.
// A median of three removes single-frame octave jumps (the classic pitch
// detector glitch) for the cost of one hop (~5 ms) of delay.

export class MedianSmoother {
  private history: number[] = []
  private gap = 0
  /** Frames of silence allowed inside a note before the history is cleared. */
  private readonly maxGap: number

  constructor(maxGap = 3) {
    this.maxGap = maxGap
  }

  /** Feed a voiced pitch (midi) or null for silence. Returns the smoothed pitch or null. */
  push(midi: number | null): number | null {
    if (midi === null) {
      this.gap++
      if (this.gap > this.maxGap) this.history = []
      return null
    }
    this.gap = 0
    this.history.push(midi)
    if (this.history.length > 3) this.history.shift()
    if (this.history.length < 3) return midi
    const [a, b, c] = this.history
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))
  }

  reset(): void {
    this.history = []
    this.gap = 0
  }
}
