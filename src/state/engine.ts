// React hook over the pitch engine's low-rate status (running, paused, error).

import { useSyncExternalStore } from 'react'
import { pitchEngine, type EngineState } from '../audio/pitchEngine'

export function useEngineState(): EngineState {
  return useSyncExternalStore(
    (cb) => pitchEngine.subscribe(cb),
    () => pitchEngine.getState(),
  )
}
