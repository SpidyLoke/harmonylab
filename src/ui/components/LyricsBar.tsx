// Karaoke-style words under the lane: the current line with the sung
// syllables lit, and the next line waiting underneath.

import type { RefObject } from 'react'
import { getAudioContext, audioContextIfCreated } from '../../audio/context'
import type { PieceRunner } from '../../audio/runner'
import { lineAt } from '../../music/lyrics'
import type { LyricLine } from '../../music/types'
import { useLive } from './useLive'

export function LyricsBar({ lines, runner }: { lines: LyricLine[]; runner: RefObject<PieceRunner | null> }) {
  const beat = useLive(() => {
    const r = runner.current
    if (!r || !audioContextIfCreated()) return null
    const ctx = getAudioContext()
    // What the singer hears now: the clock minus the output delay.
    const heard = ctx.currentTime - ((ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0)
    return r.beatAt(heard)
  }, 20)

  if (!lines.length) return null
  const idx = beat === null ? 0 : lineAt(lines, beat)
  const line = lines[idx]
  const next = lines[idx + 1]

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface/80 px-4 py-3 text-center" aria-label="Lyrics" data-testid="lyrics">
      <p className="text-2xl font-semibold leading-snug sm:text-3xl" aria-live="off">
        {line.syllables.map((s, i) => {
          const sung = beat !== null && beat >= s.end
          const now = beat !== null && beat >= s.start && beat < s.end
          return (
            <span key={i}>
              <span className={now ? 'text-spot underline decoration-2 underline-offset-8' : sung ? 'text-spot/80' : 'text-ink/60'}>{s.text}</span>
              {s.joinNext ? '' : ' '}
            </span>
          )
        })}
      </p>
      {next && (
        <p className="mt-1 text-base text-muted">
          {next.syllables.map((s) => s.text + (s.joinNext ? '' : ' ')).join('')}
        </p>
      )}
    </div>
  )
}
