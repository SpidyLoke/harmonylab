// Live-mic "try it" box inside each level's explainer: a drone (optional)
// and a target at the level's interval, with the lane and a readout.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { playNote, startDrone, stopDrone } from '../../audio/instruments'
import { useProfile, rangeOf } from '../../state/profile'
import type { TryIt as TryItConfig } from '../../curriculum/levels'
import { midiToDisplayName } from '../../music/notes'
import { Button } from './Button'
import { LiveReadout } from './LiveReadout'
import { PitchLane, type LaneTarget } from './PitchLane'

export function TryIt({ config, toleranceCents }: { config: TryItConfig; toleranceCents: number }) {
  const profile = useProfile((s) => s.profile)
  const { low, high } = rangeOf(profile)
  // Your note sits in the middle of your range; the drone sits at the interval from it.
  const target = Math.round((low + high) / 2)
  const drone = config.interval === null ? null : target - config.interval
  const [droneOn, setDroneOn] = useState(false)

  useEffect(() => {
    if (droneOn && drone !== null) startDrone(drone)
    else stopDrone()
  }, [droneOn, drone])
  useEffect(() => () => stopDrone(), [])

  const targets = useMemo<LaneTarget[]>(() => {
    const t: LaneTarget[] = [{ start: -Infinity, end: Infinity, midi: target, kind: 'harmony' }]
    if (drone !== null) t.push({ start: -Infinity, end: Infinity, midi: drone, kind: 'melody' })
    return t
  }, [target, drone])
  const getTargets = useCallback(() => targets, [targets])

  return (
    <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Try it">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Try it now</h3>
        <span className="text-sm text-muted">{config.hint}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <PitchLane getTargets={getTargets} toleranceCents={toleranceCents} className="block h-56 w-full touch-none" />
      </div>
      <LiveReadout targetMidi={target} toleranceCents={toleranceCents} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={() => playNote(target)}>
          Hear {midiToDisplayName(target)}
        </Button>
        {drone !== null && (
          <Button onClick={() => setDroneOn((v) => !v)} aria-pressed={droneOn}>
            {droneOn ? 'Drone off' : `Drone on (${midiToDisplayName(drone)})`}
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Range used: {midiToDisplayName(low)} to {midiToDisplayName(high)}.</p>
    </section>
  )
}
