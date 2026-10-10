// Reads and writes for progress, attempts and the profile.

import { db, type Attempt, type DrillProgress, type GuideStage, type Profile } from './schema'

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  onboarded: false,
  rangeLow: null,
  rangeHigh: null,
  latencyMs: 0,
  latencyMethod: 'none',
  headphones: 'unchecked',
  placementLevel: null,
  createdAt: 0,
}

export async function getProfile(): Promise<Profile> {
  try {
    return (await db.profile.get('me')) ?? { ...DEFAULT_PROFILE, createdAt: Date.now() }
  } catch {
    return { ...DEFAULT_PROFILE, createdAt: Date.now() }
  }
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const next = { ...(await getProfile()), ...patch, id: 'me' as const }
  await db.profile.put(next)
  return next
}

export function localDay(ms = Date.now()): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export async function addAttempt(a: Omit<Attempt, 'id' | 'day' | 'at'> & { at?: number }): Promise<void> {
  const at = a.at ?? Date.now()
  await db.attempts.add({ ...a, at, day: localDay(at) })
}

export const PASS_MARK = 80
/** Score needed at a guide stage before suggesting the next, quieter stage. */
export const STAGE_UP_MARK = 70

export async function getDrill(drillId: string): Promise<DrillProgress> {
  return (
    (await db.drills.get(drillId)) ?? { drillId, stage: 0, passed: false, best: 0, last: 0, count: 0, lastAt: 0 }
  )
}

export interface DrillUpdate {
  progress: DrillProgress
  /** Stage the user should try next. */
  nextStage: GuideStage
  justPassed: boolean
}

/** Records a curriculum take. Passing needs PASS_MARK with the guide off. */
export async function recordDrillTake(drillId: string, stage: GuideStage, score: number): Promise<DrillUpdate> {
  const prev = await getDrill(drillId)
  const justPassed = !prev.passed && stage === 3 && score >= PASS_MARK
  const nextStage: GuideStage =
    stage < 3 && score >= STAGE_UP_MARK ? ((stage + 1) as GuideStage) : stage
  const progress: DrillProgress = {
    drillId,
    stage: Math.max(prev.stage, nextStage) as GuideStage,
    passed: prev.passed || justPassed,
    best: Math.max(prev.best, score),
    last: score,
    count: prev.count + 1,
    lastAt: Date.now(),
  }
  await db.drills.put(progress)
  return { progress, nextStage, justPassed }
}

export async function unlockLevelsUpTo(level: number): Promise<void> {
  await db.transaction('rw', db.levels, async () => {
    for (let l = 1; l <= level; l++) {
      const row = await db.levels.get(l)
      await db.levels.put({ level: l, passed: row?.passed ?? false, unlocked: true, passedAt: row?.passedAt })
    }
  })
}

/** Marks a level passed when all its drills are passed, and unlocks the next. */
export async function checkLevelPassed(level: number, drillIds: string[]): Promise<boolean> {
  const rows = await db.drills.bulkGet(drillIds)
  if (!rows.every((r) => r?.passed)) return false
  const row = await db.levels.get(level)
  if (!row?.passed) {
    await db.levels.put({ level, unlocked: true, passed: true, passedAt: Date.now() })
    await unlockLevelsUpTo(level + 1)
  }
  return true
}

/** Highest unlocked level (1 if nothing yet). */
export async function currentLevel(): Promise<number> {
  const rows = await db.levels.toArray()
  const unlocked = rows.filter((r) => r.unlocked).map((r) => r.level)
  return unlocked.length ? Math.min(10, Math.max(...unlocked)) : 1
}
