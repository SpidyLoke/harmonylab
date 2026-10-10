import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { HarmonyDb } from './schema'
import { exportAll, importAll, ImportError, validate } from './exportImport'

describe('export and import', () => {
  it('round-trips every table, including backing audio', async () => {
    const src = new HarmonyDb('src-' + Math.random())
    await src.profile.put({ id: 'me', onboarded: true, rangeLow: 45, rangeHigh: 64, latencyMs: 120, latencyMethod: 'clap', headphones: 'ok', placementLevel: 3, createdAt: 1 })
    await src.attempts.add({ at: 5, day: '2026-10-10', kind: 'ear', exerciseId: 'interval-up', title: 'Intervals', score: 80, avgCents: 0, seconds: 30 })
    const fileId = (await src.backing.add({ name: 'track.mp3', type: 'audio/mpeg', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'audio/mpeg' }) })) as number
    await src.songs.add({
      title: 'Mine', bpm: 90, beatsPerBar: 4, key: { tonic: 0, mode: 'major' }, melody: [{ start: 0, dur: 1, midi: 60 }], chords: [], parts: {}, editedParts: [], selectedPart: 'thirdAbove',
      backing: { fileId, name: 'track.mp3', offsetSec: 0.5, bpmDetected: 90, confidence: 0.8 }, source: 'manual', createdAt: 1, updatedAt: 1,
    })
    const file = JSON.parse(JSON.stringify(await exportAll(true, src)))

    const dst = new HarmonyDb('dst-' + Math.random())
    await dst.attempts.add({ at: 1, day: '2026-01-01', kind: 'song', exerciseId: 'old', title: 'Old', score: 1, avgCents: 1, seconds: 1 })
    const r = await importAll(file, dst)
    expect(r).toEqual({ songs: 1, attempts: 1 })
    expect((await dst.profile.get('me'))?.latencyMs).toBe(120)
    expect(await dst.attempts.count()).toBe(1)
    const song = (await dst.songs.toArray())[0]
    expect(song.backing?.fileId).toBe(fileId)
    const back = await dst.backing.get(fileId)
    expect([...new Uint8Array(await back!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250])
  })

  it('drops backing links when audio was left out', async () => {
    const src = new HarmonyDb('src2-' + Math.random())
    const fileId = (await src.backing.add({ name: 't', type: 'audio/wav', blob: new Blob([new Uint8Array([9])]) })) as number
    await src.songs.add({
      title: 'S', bpm: 90, beatsPerBar: 4, key: { tonic: 0, mode: 'major' }, melody: [], chords: [], parts: {}, editedParts: [], selectedPart: 'thirdAbove',
      backing: { fileId, name: 't', offsetSec: 0, bpmDetected: null, confidence: null }, source: 'manual', createdAt: 1, updatedAt: 1,
    })
    const dst = new HarmonyDb('dst2-' + Math.random())
    await importAll(JSON.parse(JSON.stringify(await exportAll(false, src))), dst)
    expect((await dst.songs.toArray())[0].backing).toBeNull()
  })

  it('rejects files that are not backups', () => {
    expect(() => validate({ hello: 1 })).toThrow(ImportError)
    expect(() => validate({ format: 'harmonylab-backup', version: 99, tables: {} })).toThrow(/newer version/)
  })
})
