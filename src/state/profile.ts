// The singer's profile (range, latency, level) as a React store.

import { create } from 'zustand'
import { DEFAULT_PROFILE, getProfile, updateProfile } from '../db/repo'
import type { Profile } from '../db/schema'

interface ProfileStore {
  profile: Profile
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Profile>) => Promise<void>
}

export const useProfile = create<ProfileStore>((set) => ({
  profile: DEFAULT_PROFILE,
  loaded: false,
  load: async () => set({ profile: await getProfile(), loaded: true }),
  update: async (patch) => set({ profile: await updateProfile(patch) }),
}))

/** Range to fit exercises into. Falls back to a middle range before the range test. */
export function rangeOf(p: Profile): { low: number; high: number } {
  if (p.rangeLow !== null && p.rangeHigh !== null) {
    // Keep a semitone of comfort margin at each end when there is room.
    const margin = p.rangeHigh - p.rangeLow >= 12 ? 1 : 0
    return { low: p.rangeLow + margin, high: p.rangeHigh - margin }
  }
  return { low: 53, high: 69 } // F3..A4: a middle range most voices can reach
}

export const latencySecOf = (p: Profile) => p.latencyMs / 1000
