import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { checkLevelPassed, currentLevel, recordDrillTake, unlockLevelsUpTo } from './repo'
import { db } from './schema'

describe('drill and level progress', () => {
  it('fades the guide after 70% and passes only at 80% with the guide off', async () => {
    await db.delete()
    await db.open()
    let r = await recordDrillTake('d1', 0, 75)
    expect(r.nextStage).toBe(1)
    expect(r.justPassed).toBe(false)
    r = await recordDrillTake('d1', 2, 60)
    expect(r.nextStage).toBe(2)
    r = await recordDrillTake('d1', 3, 79)
    expect(r.justPassed).toBe(false)
    r = await recordDrillTake('d1', 3, 85)
    expect(r.justPassed).toBe(true)
    expect(r.progress.best).toBe(85)
    expect(r.progress.count).toBe(4)
  })

  it('unlocks the next level when every drill passes', async () => {
    await db.delete()
    await db.open()
    await unlockLevelsUpTo(2)
    expect(await currentLevel()).toBe(2)
    await recordDrillTake('a', 3, 90)
    expect(await checkLevelPassed(2, ['a', 'b'])).toBe(false)
    await recordDrillTake('b', 3, 81)
    expect(await checkLevelPassed(2, ['a', 'b'])).toBe(true)
    expect(await currentLevel()).toBe(3)
  })
})
