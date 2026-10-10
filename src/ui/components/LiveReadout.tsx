// Big, plain-language readout under the lane. Every state carries a word and
// a symbol as well as a colour.

import { pitchEngine } from '../../audio/pitchEngine'
import { centsOff, midiToDisplayName } from '../../music/notes'
import { classify } from '../../scoring/pitchState'
import { useLive } from './useLive'

export function LiveReadout({ targetMidi, toleranceCents }: { targetMidi: number; toleranceCents: number }) {
  const frame = useLive(() => {
    const f = pitchEngine.latest
    const fresh = f && pitchEngine.displayNow() - f.t < 0.25
    return fresh && f.midi !== null ? f.midi : null
  })

  if (frame === null) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-3 text-muted" aria-live="polite">
        <span aria-hidden className="text-2xl">♪</span>
        <span className="text-lg" data-testid="readout-state">
          Listening. Sing an open "ah".
        </span>
      </div>
    )
  }

  const cents = centsOff(frame, targetMidi)
  const { state, direction } = classify(cents, toleranceCents)
  const nearestOff = Math.round(cents)
  const label =
    state === 'inTune'
      ? { icon: '✓', text: 'In tune', cls: 'text-good' }
      : state === 'slightlyOff'
        ? direction === 'sharp'
          ? { icon: '▼', text: 'A little high: ease down', cls: 'text-near' }
          : { icon: '▲', text: 'A little low: lift up', cls: 'text-near' }
        : direction === 'sharp'
          ? { icon: '▼▼', text: 'Too high: come down', cls: 'text-bad' }
          : { icon: '▲▲', text: 'Too low: go up', cls: 'text-bad' }

  return (
    <div className="flex min-h-24 flex-wrap items-center justify-center gap-x-8 gap-y-2">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted">You're singing</div>
        <div className="text-4xl font-bold tabular-nums" data-testid="readout-note">
          {midiToDisplayName(frame)}
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted">Off the target by</div>
        <div className="text-4xl font-bold tabular-nums" data-testid="readout-cents">
          {nearestOff > 0 ? '+' : ''}
          {nearestOff}
          <span className="ml-1 text-lg font-medium text-muted">cents</span>
        </div>
      </div>
      <div className={`flex items-center gap-2 text-xl font-semibold ${label.cls}`} data-testid="readout-state" aria-live="polite">
        <span aria-hidden>{label.icon}</span>
        {label.text}
      </div>
    </div>
  )
}
