import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { readMidi, songFromMidi, toMonophonic } from './midiImport'

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
})
