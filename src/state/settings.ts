// User settings, persisted to the local database.

import { create } from 'zustand'
import { getSetting, putSetting } from '../db/schema'
import { DEFAULT_GATE, pitchEngine, type GateSettings } from '../audio/pitchEngine'
import type { ToleranceTier } from '../scoring/pitchState'

export interface Settings {
  tier: ToleranceTier
  gate: GateSettings
  showDebug: boolean
  /** Has the user seen the "what is a cent" explainer. */
  seenCents: boolean
  sandboxTarget: number
}

const DEFAULTS: Settings = {
  tier: 'beginner',
  gate: DEFAULT_GATE,
  showDebug: false,
  seenCents: false,
  sandboxTarget: 57, // A3: comfortable for most voices, men an octave up from their low range
}

interface SettingsStore extends Settings {
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const saved = await getSetting<Partial<Settings>>('settings', {})
    const merged = { ...DEFAULTS, ...saved, gate: { ...DEFAULTS.gate, ...saved.gate } }
    pitchEngine.gate = merged.gate
    set({ ...merged, loaded: true })
  },
  update: (patch) => {
    set(patch)
    const { tier, gate, showDebug, seenCents, sandboxTarget } = { ...get(), ...patch }
    if (patch.gate) pitchEngine.gate = patch.gate
    void putSetting('settings', { tier, gate, showDebug, seenCents, sandboxTarget })
  },
}))
