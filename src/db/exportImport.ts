// Export and import all data as one JSON file, so nothing is lost when
// switching devices. Backing-track audio is included as base64 when asked.

import { db, TABLES, type BackingFile, type HarmonyDb } from './schema'

export const EXPORT_FORMAT = 'harmonylab-backup'
export const EXPORT_VERSION = 1

interface ExportedBacking extends Omit<BackingFile, 'blob'> {
  base64: string | null
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportAll(includeAudio: boolean, database: HarmonyDb = db): Promise<ExportFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    if (name === 'backing') {
      const rows = await database.backing.toArray()
      tables.backing = await Promise.all(
        rows.map(async (r): Promise<ExportedBacking> => ({
          id: r.id,
          name: r.name,
          type: r.type,
          base64: includeAudio ? await blobToBase64(r.blob) : null,
        })),
      )
    } else {
      tables[name] = await database.table(name).toArray()
    }
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), tables }
}

export class ImportError extends Error {}

export function validate(data: unknown): ExportFile {
  const d = data as Partial<ExportFile>
  if (!d || d.format !== EXPORT_FORMAT) throw new ImportError("This isn't a HarmonyLab backup file.")
  if (typeof d.version !== 'number' || d.version > EXPORT_VERSION) {
    throw new ImportError('This backup was made by a newer version of HarmonyLab. Update the app and try again.')
  }
  if (!d.tables || typeof d.tables !== 'object') throw new ImportError('The backup file is damaged.')
  return d as ExportFile
}

/** Replaces everything on this device with the backup. */
export async function importAll(data: unknown, database: HarmonyDb = db): Promise<{ songs: number; attempts: number }> {
  const file = validate(data)
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const name of TABLES) {
      const table = database.table(name)
      await table.clear()
      const rows = file.tables[name] ?? []
      if (name === 'backing') {
        const restored = (rows as ExportedBacking[])
          .filter((r) => r.base64)
          .map((r) => ({ id: r.id, name: r.name, type: r.type, blob: base64ToBlob(r.base64!, r.type) }))
        await table.bulkPut(restored)
      } else {
        await table.bulkPut(rows)
      }
    }
    // Songs whose audio was not exported lose their backing link.
    const kept = new Set(((file.tables.backing ?? []) as ExportedBacking[]).filter((r) => r.base64).map((r) => r.id))
    await database.songs.toCollection().modify((s) => {
      if (s.backing && !kept.has(s.backing.fileId)) s.backing = null
    })
  })
  return { songs: (file.tables.songs ?? []).length, attempts: (file.tables.attempts ?? []).length }
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
