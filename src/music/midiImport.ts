// Reads a MIDI file, lists its tracks, suggests the melody track and turns it
// into notes in beats. Chords are guessed from the other tracks.

import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { inferChords } from './chordInfer'
import { detectKey } from './keyDetect'
import { lyricsFromMidiEvents } from './lyrics'
import type { ChordEvent, Key, Note } from './types'

export interface MidiTrackSummary {
  index: number
  name: string
  instrument: string
  noteCount: number
  lowest: number
  highest: number
  averagePitch: number
  /** Share of notes that start while another note in the track is still sounding. */
  polyphony: number
  isDrums: boolean
}

export interface MidiImport {
  bpm: number
  beatsPerBar: number
  tracks: MidiTrackSummary[]
  suggestedTrack: number
  /** Notes per track, in beats. */
  trackNotes: Note[][]
  ppq: number
  /** Lyric and text events from every track (karaoke files keep words here). */
  lyricEvents: { ticks: number; text: string }[]
}

/** Text and lyric events from all tracks, with absolute ticks. */
function readLyricEvents(data: ArrayBuffer): { ticks: number; text: string }[] {
  try {
    const parsed = parseMidi(new Uint8Array(data))
    const byTrack = parsed.tracks.map((track) => {
      let ticks = 0
      const out: { ticks: number; text: string; type: string }[] = []
      for (const e of track) {
        ticks += e.deltaTime
        if ((e.type === 'lyrics' || e.type === 'text') && 'text' in e) out.push({ ticks, text: e.text, type: e.type })
      }
      return out
    })
    // Prefer proper lyric events; otherwise the track with the most text events (karaoke style).
    const lyrics = byTrack.flat().filter((e) => e.type === 'lyrics')
    const pick = lyrics.length >= 4 ? lyrics : [...byTrack].sort((a, b) => b.length - a.length)[0] ?? []
    return pick.map(({ ticks, text }) => ({ ticks, text })).sort((a, b) => a.ticks - b.ticks)
  } catch {
    return []
  }
}

export function readMidi(data: ArrayBuffer): MidiImport {
  const midi = new Midi(data)
  const ppq = midi.header.ppq
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120)
  const beatsPerBar = midi.header.timeSignatures[0]?.timeSignature[0] ?? 4

  const trackNotes: Note[][] = midi.tracks.map((t) =>
    t.notes.map((n) => ({ start: n.ticks / ppq, dur: Math.max(0.0625, n.durationTicks / ppq), midi: n.midi })),
  )
  const tracks: MidiTrackSummary[] = midi.tracks.map((t, index) => {
    const notes = trackNotes[index]
    let overlapping = 0
    let lastEnd = -1
    for (const n of [...notes].sort((a, b) => a.start - b.start)) {
      if (n.start < lastEnd - 1e-6) overlapping++
      lastEnd = Math.max(lastEnd, n.start + n.dur)
    }
    const pitches = notes.map((n) => n.midi)
    return {
      index,
      name: t.name || `Track ${index + 1}`,
      instrument: t.instrument?.name ?? '',
      noteCount: notes.length,
      lowest: pitches.length ? Math.min(...pitches) : 0,
      highest: pitches.length ? Math.max(...pitches) : 0,
      averagePitch: pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0,
      polyphony: notes.length ? overlapping / notes.length : 0,
      isDrums: t.instrument?.percussion ?? t.channel === 9,
    }
  })
  return { bpm, beatsPerBar, tracks, suggestedTrack: suggestMelodyTrack(tracks), trackNotes, ppq, lyricEvents: readLyricEvents(data) }
}

/** Highest, mostly single-line, non-drum track with a fair number of notes. */
export function suggestMelodyTrack(tracks: MidiTrackSummary[]): number {
  const usable = tracks.filter((t) => !t.isDrums && t.noteCount >= 8)
  if (usable.length === 0) return tracks.find((t) => t.noteCount > 0)?.index ?? 0
  const score = (t: MidiTrackSummary) =>
    t.averagePitch - t.polyphony * 30 + (/(melody|vocal|voice|lead|sing)/i.test(t.name) ? 40 : 0)
  return [...usable].sort((a, b) => score(b) - score(a))[0].index
}

/** Keeps one note at a time: the highest at each start ("skyline"). */
export function toMonophonic(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi)
  const out: Note[] = []
  for (const n of sorted) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.start - n.start) < 1e-6) continue
    if (prev && prev.start + prev.dur > n.start) prev.dur = n.start - prev.start
    out.push({ ...n })
  }
  return out.filter((n) => n.dur > 0)
}

export interface ImportedSong {
  melody: Note[]
  chords: ChordEvent[]
  key: Key
  bpm: number
  beatsPerBar: number
  /** Beat in the MIDI file where the song (bar of the first melody note) starts. */
  firstBeat: number
  /** Words, if the file carried them (karaoke files). */
  lyricsText: string | null
}

/** Builds a song from the chosen melody track; chords come from everything else. */
export function songFromMidi(imp: MidiImport, melodyTrack: number): ImportedSong {
  const raw = toMonophonic(imp.trackNotes[melodyTrack] ?? [])
  // Start the song at the bar containing the first melody note.
  const firstBar = raw.length ? Math.floor(raw[0].start / imp.beatsPerBar) * imp.beatsPerBar : 0
  const melody = raw.map((n) => ({ ...n, start: n.start - firstBar }))
  const accompaniment = imp.trackNotes
    .filter((_, i) => i !== melodyTrack && !imp.tracks[i].isDrums)
    .flat()
    .map((n) => ({ ...n, start: n.start - firstBar }))
    .filter((n) => n.start >= 0)
  const length = melody.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
  const key = detectKey([...melody, ...accompaniment])
  const source = accompaniment.length >= 8 ? accompaniment : melody
  const chords = inferChords(source, key, imp.beatsPerBar, Math.ceil(length / imp.beatsPerBar) * imp.beatsPerBar)
  const lyricsText = lyricsFromMidiEvents(imp.lyricEvents, imp.ppq, melody, firstBar)
  return { melody, chords, key, bpm: imp.bpm, beatsPerBar: imp.beatsPerBar, firstBeat: firstBar, lyricsText }
}

/** Every note start in the file (all tracks, drums included), in seconds at the file's tempo. */
export function midiOnsetsSec(imp: MidiImport): number[] {
  const spb = 60 / imp.bpm
  return [...new Set(imp.trackNotes.flat().map((n) => Math.round(n.start * 1000) / 1000))].sort((a, b) => a - b).map((b) => b * spb)
}
