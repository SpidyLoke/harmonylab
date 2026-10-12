// Local database. Everything the app saves lives here, on this device only.

import Dexie, { type EntityTable } from 'dexie'
import type { PartKind } from '../music/harmony/generator'
import type { ChordEvent, Key, Note } from '../music/types'
import type { RepItem } from '../ear/repetition'

export interface SettingRow {
  key: string
  value: unknown
}

export interface Profile {
  id: 'me'
  onboarded: boolean
  /** Comfortable range, MIDI numbers. */
  rangeLow: number | null
  rangeHigh: number | null
  /** Measured delay from a sound to the singer's response reaching the app. */
  latencyMs: number
  latencyMethod: 'clap' | 'tap' | 'none'
  headphones: 'ok' | 'bleed' | 'unchecked'
  placementLevel: number | null
  createdAt: number
}

export interface LevelProgress {
  level: number
  unlocked: boolean
  passed: boolean
  passedAt?: number
}

/** 0 full, 1 half, 2 quiet, 3 off. */
export type GuideStage = 0 | 1 | 2 | 3

export interface DrillProgress {
  drillId: string
  stage: GuideStage
  passed: boolean
  best: number
  last: number
  count: number
  lastAt: number
}

export type AttemptKind = 'curriculum' | 'ear' | 'song' | 'warmup' | 'placement'

export interface Attempt {
  id?: number
  at: number
  /** Local date, YYYY-MM-DD. */
  day: string
  kind: AttemptKind
  exerciseId: string
  title: string
  /** 0..100 */
  score: number
  avgCents: number
  seconds: number
  stage?: GuideStage
  /** Interval label (e.g. "M3 above") → [hits, total], for weakest-interval stats. */
  intervals?: Record<string, [number, number]>
}

export interface EarItemRow extends RepItem {
  drill: string
}

export interface BackingRef {
  fileId: number
  name: string
  /** Seconds into the audio file where beat 0 of the song falls. */
  offsetSec: number
  bpmDetected: number | null
  confidence: number | null
}

export interface SongRow {
  id?: number
  title: string
  bpm: number
  beatsPerBar: number
  key: Key
  melody: Note[]
  chords: ChordEvent[]
  /** Generated (and possibly hand-edited) parts. */
  parts: Partial<Record<PartKind, Note[]>>
  /** Parts the user has edited by hand; regenerating leaves these alone. */
  editedParts: PartKind[]
  selectedPart: PartKind
  backing: BackingRef | null
  /** Words in the lyrics text format (see music/lyrics.ts), timed to the melody. */
  lyricsText?: string
  /** For rounds: beats before the second voice comes in. */
  roundOffset?: number
  /** Set when the song came from the built-in library, so it isn't added twice. */
  builtinId?: string
  source: 'record' | 'midi' | 'manual' | 'builtin'
  createdAt: number
  updatedAt: number
}

export interface BackingFile {
  id?: number
  name: string
  type: string
  blob: Blob
}

export class HarmonyDb extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>
  profile!: EntityTable<Profile, 'id'>
  levels!: EntityTable<LevelProgress, 'level'>
  drills!: EntityTable<DrillProgress, 'drillId'>
  attempts!: EntityTable<Attempt, 'id'>
  earItems!: EntityTable<EarItemRow, 'id'>
  songs!: EntityTable<SongRow, 'id'>
  backing!: EntityTable<BackingFile, 'id'>

  constructor(name = 'harmonylab') {
    super(name)
    this.version(1).stores({ settings: 'key' })
    this.version(2).stores({
      settings: 'key',
      profile: 'id',
      levels: 'level',
      drills: 'drillId',
      attempts: '++id, day, kind, exerciseId, at',
      earItems: 'id, drill',
      songs: '++id, updatedAt',
      backing: '++id',
    })
  }
}

export const db = new HarmonyDb()

export const TABLES = ['settings', 'profile', 'levels', 'drills', 'attempts', 'earItems', 'songs', 'backing'] as const

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
