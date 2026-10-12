import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { midiOnsetsSec, readMidi, songFromMidi, toMonophonic } from './midiImport'
import { writeMidi, type MidiData } from 'midi-file'

function buildMidi(): ArrayBuffer {
  const midi = new Midi()
  midi.header.setTempo(100)
  const ppq = midi.header.ppq
  const chords = midi.addTrack()
  chords.name = 'Piano'
  const prog = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
  prog.forEach((c, bar) => c.forEach((m) => chords.addNote({ midi: m, ticks: bar * 4 * ppq, durationTicks: 4 * ppq })))
  const lead = midi.addTrack()
  lead.name = 'Lead vocal'
  ;[76, 74, 72, 74, 76, 76, 76, 74, 74, 74, 76, 79, 79, 77, 76, 72].forEach((m, i) =>
    lead.addNote({ midi: m, ticks: i * ppq, durationTicks: ppq }),
  )
  const drums = midi.addTrack()
  drums.channel = 9
  for (let i = 0; i < 16; i++) drums.addNote({ midi: 36, ticks: i * ppq, durationTicks: ppq / 4 })
  const arr = midi.toArray()
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
}

describe('MIDI import', () => {
  it('reads tempo, tracks, and suggests the lead as melody', () => {
    const imp = readMidi(buildMidi())
    expect(imp.bpm).toBe(100)
    expect(imp.tracks.map((t) => t.name)).toEqual(['Piano', 'Lead vocal', 'Track 3'])
    expect(imp.tracks[2].isDrums).toBe(true)
    expect(imp.suggestedTrack).toBe(1)
    expect(imp.trackNotes[1][1]).toEqual({ start: 1, dur: 1, midi: 74 })
  })

  it('builds a song with chords guessed from the accompaniment', () => {
    const imp = readMidi(buildMidi())
    const song = songFromMidi(imp, 1)
    expect(song.melody).toHaveLength(16)
    expect(song.key).toEqual({ tonic: 0, mode: 'major' })
    expect(song.chords.map((c) => c.symbol)).toEqual(['C', 'G', 'Am', 'F'])
  })

  it('reduces chords in a melody track to the top line', () => {
    const mono = toMonophonic([
      { start: 0, dur: 2, midi: 60 },
      { start: 0, dur: 2, midi: 64 },
      { start: 1, dur: 1, midi: 67 },
    ])
    expect(mono).toEqual([
      { start: 0, dur: 1, midi: 64 },
      { start: 1, dur: 1, midi: 67 },
    ])
  })

  it('reads karaoke words from a separate lyrics track', () => {
    // Track 0: tempo; track 1: melody; track 2: karaoke words (like a .kar file).
    const ppq = 480
    const notes = [60, 62, 64, 65]
    const data: MidiData = {
      header: { format: 1, numTracks: 3, ticksPerBeat: ppq },
      tracks: [
        [
          { deltaTime: 0, meta: true, type: 'setTempo', microsecondsPerBeat: 500000 },
          { deltaTime: 0, meta: true, type: 'endOfTrack' },
        ],
        [
          { deltaTime: 0, meta: true, type: 'trackName', text: 'Melody' },
          ...notes.flatMap((m, i) => [
            { deltaTime: i === 0 ? 0 : 0, channel: 0, type: 'noteOn' as const, noteNumber: m, velocity: 90 },
            { deltaTime: ppq, channel: 0, type: 'noteOff' as const, noteNumber: m, velocity: 0 },
          ]),
          ...Array.from({ length: 6 }, (_, i) => [
            { deltaTime: 0, channel: 0, type: 'noteOn' as const, noteNumber: 67 + (i % 2), velocity: 90 },
            { deltaTime: ppq, channel: 0, type: 'noteOff' as const, noteNumber: 67 + (i % 2), velocity: 0 },
          ]).flat(),
          { deltaTime: 0, meta: true, type: 'endOfTrack' },
        ],
        [
          { deltaTime: 0, meta: true, type: 'text', text: '@KMIDI KARAOKE FILE' },
          { deltaTime: 0, meta: true, type: 'text', text: '/Hel' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'lo ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'my ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'friend ' },
          { deltaTime: ppq, meta: true, type: 'text', text: '\\sing ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'a ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'long ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'song ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'with ' },
          { deltaTime: ppq, meta: true, type: 'text', text: 'me ' },
          { deltaTime: 0, meta: true, type: 'endOfTrack' },
        ],
      ],
    }
    const bytes = new Uint8Array(writeMidi(data))
    const imp = readMidi(bytes.buffer)
    expect(imp.lyricEvents.length).toBeGreaterThanOrEqual(10)
    const song = songFromMidi(imp, imp.suggestedTrack)
    expect(song.melody).toHaveLength(10)
    expect(song.lyricsText).toBe('Hel-lo my friend / sing a long song with me')
    expect(midiOnsetsSec(imp).slice(0, 3)).toEqual([0, 0.5, 1])
  })
})
