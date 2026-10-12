// Personal song library: create, regenerate parts, backing tracks, and
// turning a saved song into a playable Piece.

import { getAudioContext } from '../audio/context'
import { detectBeats, type BeatInfo } from '../music/beatDetect'
import { availableParts, generatePart, type PartKind } from '../music/harmony/generator'
import { detectKey } from '../music/keyDetect'
import { endOf } from '../music/notation'
import { builtInSong } from '../music/songs'
import { alignLyrics } from '../music/lyrics'
import { fitPieceToRange } from '../music/transpose'
import type { ChordEvent, Key, Note, Piece } from '../music/types'
import { db, type SongRow } from '../db/schema'

export interface SongDraft {
  title: string
  bpm: number
  beatsPerBar: number
  melody: Note[]
  chords?: ChordEvent[]
  key?: Key
  source: SongRow['source']
  backing?: SongRow['backing']
  lyricsText?: string
  roundOffset?: number
  builtinId?: string
  selectedPart?: PartKind
}

/** Fills in key and parts, then saves. Returns the new id. */
export async function createSong(d: SongDraft): Promise<number> {
  const chords = d.chords ?? []
  const key = d.key ?? detectKey(d.melody, chords)
  const row: SongRow = {
    title: d.title,
    bpm: d.bpm,
    beatsPerBar: d.beatsPerBar,
    key,
    melody: d.melody,
    chords,
    parts: {},
    editedParts: [],
    selectedPart: d.selectedPart ?? 'thirdAbove',
    backing: d.backing ?? null,
    lyricsText: d.lyricsText,
    roundOffset: d.roundOffset,
    builtinId: d.builtinId,
    source: d.source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  row.parts = regenerateParts(row)
  return (await db.songs.add(row)) as number
}

/** Generates every part that makes sense, keeping any the singer hand-edited. */
export function regenerateParts(
  song: Pick<SongRow, 'melody' | 'chords' | 'key' | 'beatsPerBar' | 'parts' | 'editedParts' | 'roundOffset'>,
): SongRow['parts'] {
  const opts = harmonyOptions(song)
  const out: SongRow['parts'] = {}
  for (const kind of availableParts(song.chords.length > 0, !!song.roundOffset)) {
    out[kind] = song.editedParts.includes(kind) && song.parts[kind] ? song.parts[kind] : generatePart(kind, song.melody, opts)
  }
  return out
}

export async function saveSong(song: SongRow): Promise<void> {
  await db.songs.put({ ...song, updatedAt: Date.now() })
}

function harmonyOptions(song: Pick<SongRow, 'key' | 'beatsPerBar' | 'chords' | 'roundOffset'>) {
  return {
    key: song.key,
    beatsPerBar: song.beatsPerBar,
    chords: song.chords.length ? song.chords : undefined,
    roundOffset: song.roundOffset,
  }
}

/** Adds a built-in song (or finds the copy already in the library). */
export async function addBuiltInToLibrary(id: string): Promise<number> {
  const existing = await db.songs.filter((r) => r.builtinId === id).first()
  if (existing?.id !== undefined) return existing.id
  const s = builtInSong(id)!
  return createSong({
    title: s.title,
    bpm: s.bpm,
    beatsPerBar: s.beatsPerBar,
    melody: s.melody,
    chords: s.chords,
    key: s.key,
    source: 'builtin',
    builtinId: s.id,
    lyricsText: s.lyrics,
    roundOffset: s.roundOffset,
    selectedPart: s.kind === 'singalong' ? (s.roundOffset ? 'round' : 'melody') : 'thirdAbove',
  })
}

export function songLength(song: Pick<SongRow, 'melody' | 'beatsPerBar'>): number {
  return Math.max(song.beatsPerBar, Math.ceil(endOf(song.melody) / song.beatsPerBar) * song.beatsPerBar)
}

/**
 * The practice piece for a part. Without a backing track the song moves to
 * suit the singer's range; with one it stays in the record's key.
 */
export function songPiece(song: SongRow, part: PartKind, range: { low: number; high: number } | null): Piece {
  const opts = harmonyOptions(song)
  const target = song.parts[part] ?? generatePart(part, song.melody, opts)
  const offset = part === 'round' ? (song.roundOffset ?? 0) : 0
  const lyrics = song.lyricsText ? alignLyrics(song.melody, song.lyricsText).lines : undefined
  const piece: Piece = {
    bpm: song.bpm,
    beatsPerBar: song.beatsPerBar,
    lengthBeats: Math.ceil((songLength(song) + offset) / song.beatsPerBar) * song.beatsPerBar,
    // Singing the tune itself: the guide plays it, so no separate melody lane.
    melody: part === 'melody' ? [] : song.melody,
    target,
    chords: song.backing ? undefined : song.chords.length ? song.chords : undefined,
    // Words follow the singer's own part (a round's second voice comes in later).
    lyrics: lyrics?.map((l) => ({
      start: l.start + offset,
      end: l.end + offset,
      syllables: l.syllables.map((x) => ({ ...x, start: x.start + offset, end: x.end + offset })),
    })),
  }
  if (!range || song.backing) return piece
  return fitPieceToRange(piece, range.low, range.high).piece
}

// ---------- Backing tracks ----------

const bufferCache = new Map<number, AudioBuffer>()

export async function storeBackingFile(file: File): Promise<number> {
  return (await db.backing.add({ name: file.name, type: file.type, blob: file })) as number
}

export async function loadBackingBuffer(fileId: number): Promise<AudioBuffer | null> {
  if (bufferCache.has(fileId)) return bufferCache.get(fileId)!
  const row = await db.backing.get(fileId)
  if (!row) return null
  const data = await row.blob.arrayBuffer()
  const buffer = await getAudioContext().decodeAudioData(data)
  bufferCache.set(fileId, buffer)
  return buffer
}

export function mixdown(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / buffer.numberOfChannels
  }
  return out
}

/** Tempo and beat grid of a backing track. Only the beat is analysed, never the melody. */
export function analyseBacking(buffer: AudioBuffer, beatsPerBar: number): BeatInfo {
  // Two minutes is plenty to find the beat and keeps this quick on phones.
  const mono = mixdown(buffer)
  const limit = Math.min(mono.length, buffer.sampleRate * 120)
  return detectBeats(mono.subarray(0, limit), buffer.sampleRate, beatsPerBar)
}
