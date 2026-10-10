// Phase 1 practice sandbox: pick a target note, sing, watch the lane.

import { useCallback, useEffect, useRef, useState } from 'react'
import { pitchEngine } from '../../audio/pitchEngine'
import { playNote, startDrone, stopDrone } from '../../audio/instruments'
import { midiToDisplayName } from '../../music/notes'
import { TOLERANCE_CENTS, type ToleranceTier } from '../../scoring/pitchState'
import { useSettings } from '../../state/settings'
import { useEngineState } from '../../state/engine'
import { Button, Segmented } from '../components/Button'
import { DebugPanel } from '../components/DebugPanel'
import { LiveReadout } from '../components/LiveReadout'
import { MicGate } from '../components/MicGate'
import { PitchLane, type LaneTarget } from '../components/PitchLane'

type Backing = 'none' | 'drone' | 'melody'
/** In the melody preview the melody sits a major third (4 semitones) below you. */
const MELODY_BELOW = 4
const LOWEST = 36 // C2
const HIGHEST = 84 // C6

export function PracticeScreen() {
  const { status } = useEngineState()
  const target = useSettings((s) => s.sandboxTarget)
  const tier = useSettings((s) => s.tier)
  const showDebug = useSettings((s) => s.showDebug)
  const seenCents = useSettings((s) => s.seenCents)
  const update = useSettings((s) => s.update)
  const [backing, setBacking] = useState<Backing>('none')
  const tolerance = TOLERANCE_CENTS[tier]

  // Target history, so the lane keeps showing the old bar behind the voice after a change.
  const timeline = useRef<LaneTarget[]>([{ start: -Infinity, end: Infinity, midi: target, kind: 'harmony' }])
  useEffect(() => {
    const now = pitchEngine.displayNow()
    const tl = timeline.current
    const last = tl[tl.length - 1]
    if (last.midi === target) return
    const kept = tl.filter((x) => x.kind === 'harmony').slice(-4)
    kept[kept.length - 1].end = now
    timeline.current = [...kept, { start: now, end: Infinity, midi: target, kind: 'harmony' }]
  }, [target])

  const getTargets = useCallback((): LaneTarget[] => {
    const tl = timeline.current
    if (backing !== 'melody') return tl
    return [...tl, { start: -Infinity, end: Infinity, midi: target - MELODY_BELOW, kind: 'melody' }]
  }, [backing, target])

  // Keep the backing sound in step with the target.
  useEffect(() => {
    if (status !== 'running' || backing === 'none') {
      stopDrone()
      return
    }
    startDrone(backing === 'drone' ? target : target - MELODY_BELOW)
  }, [backing, target, status])
  useEffect(() => () => stopDrone(), [])

  const setTarget = (m: number) => update({ sandboxTarget: Math.min(HIGHEST, Math.max(LOWEST, m)) })
  const matchMe = () => {
    const m = pitchEngine.latest?.midi
    if (m != null) setTarget(Math.round(m))
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="pt-4">
        <h1 className="text-2xl font-bold">Find the note</h1>
        <p className="mt-1 text-muted">
          Sing the gold note. Your voice draws the line. Hit "Hear it" first if you need the note.
        </p>
      </header>

      <MicGate>
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface/70 shadow-2xl">
          <PitchLane
            getTargets={getTargets}
            toleranceCents={tolerance}
            className="block h-[52vh] min-h-72 w-full touch-none"
          />
        </div>

        <LiveReadout targetMidi={target} toleranceCents={tolerance} />

        {!seenCents && (
          <aside className="mx-auto mb-4 max-w-2xl rounded-2xl border border-spot/40 bg-spot/10 p-4 text-sm">
            <b>What's a cent?</b> A cent is a tiny slice of pitch. 100 cents make one semitone, the step between
            two neighbouring piano keys. Within {tolerance} cents counts as in tune at your level.
            <button className="ml-2 font-semibold text-spot underline" onClick={() => update({ seenCents: true })}>
              Got it
            </button>
          </aside>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-line bg-surface p-5" aria-label="Target note">
            <div className="text-xs uppercase tracking-widest text-muted">Target</div>
            <div className="mt-2 flex items-center gap-3">
              <Button aria-label="Target down a semitone" onClick={() => setTarget(target - 1)} className="w-14 text-xl">
                −
              </Button>
              <div className="min-w-24 text-center text-4xl font-bold text-spot" data-testid="target-note">
                {midiToDisplayName(target)}
              </div>
              <Button aria-label="Target up a semitone" onClick={() => setTarget(target + 1)} className="w-14 text-xl">
                +
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => playNote(target)}>
                Hear it
              </Button>
              <Button onClick={matchMe}>Set to what I'm singing</Button>
              <Button onClick={() => setTarget(target - 12)} aria-label="Target down an octave">
                Octave −
              </Button>
              <Button onClick={() => setTarget(target + 12)} aria-label="Target up an octave">
                Octave +
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-line bg-surface p-5">
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted">Backing sound</div>
              <Segmented<Backing>
                label="Backing sound"
                value={backing}
                onChange={setBacking}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'drone', label: 'Drone' },
                  { value: 'melody', label: 'Melody below' },
                ]}
              />
              <p className="mt-2 text-xs text-muted">
                A <b>drone</b> is one note held underneath you. <b>Melody below</b> plays a note a third under yours
                and shows it as the faint purple lane: your first taste of singing a harmony. Wear headphones so the
                mic only hears you.
              </p>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted">How strict</div>
              <Segmented<ToleranceTier>
                label="How strict"
                value={tier}
                onChange={(v) => update({ tier: v })}
                options={[
                  { value: 'beginner', label: '±50' },
                  { value: 'intermediate', label: '±30' },
                  { value: 'advanced', label: '±15' },
                ]}
              />
            </div>
          </section>
        </div>

        <div className="mt-4">
          <Button variant="ghost" onClick={() => update({ showDebug: !showDebug })} aria-expanded={showDebug}>
            {showDebug ? 'Hide engine details' : 'Show engine details'}
          </Button>
          {showDebug && <DebugPanel />}
        </div>
      </MicGate>
    </div>
  )
}
