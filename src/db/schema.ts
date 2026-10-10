// Local database. Everything the app saves lives here, on this device only.
// Later phases add tables (profile, attempts, songs, ear items) as new versions.

import Dexie, { type EntityTable } from 'dexie'

export interface SettingRow {
  key: string
  value: unknown
}

export class HarmonyDb extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>

  constructor() {
    super('harmonylab')
    this.version(1).stores({
      settings: 'key',
    })
  }
}

export const db = new HarmonyDb()

/** Reads a setting. Falls back quietly if storage is unavailable (some private modes). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.settings.get(key)
    return row === undefined ? fallback : (row.value as T)
  } catch {
    return fallback
  }
}

export async function putSetting(key: string, value: unknown): Promise<void> {
  try {
    await db.settings.put({ key, value })
  } catch {
    /* storage blocked: settings just will not persist this session */
  }
}
