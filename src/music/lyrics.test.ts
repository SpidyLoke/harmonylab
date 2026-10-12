import { describe, expect, it } from 'vitest'
import { alignLyrics, lineAt, lineText, lyricsFromMidiEvents, tokenise } from './lyrics'
import { parseMelody } from './notation'
import { ALL_BUILT_IN_SONGS, SINGALONG_SONGS } from './songs'

describe('lyrics text format', () => {
  it('splits words, syllables, holds and lines', () => {
    expect(tokenise('Twin-kle star / how _ I')).toEqual([
      { kind: 'syllable', text: 'Twin', joinNext: true },
      { kind: 'syllable', text: 'kle', joinNext: false },
      { kind: 'syllable', text: 'star', joinNext: false },
      { kind: 'break' },
      { kind: 'syllable', text: 'how', joinNext: false },
      { kind: 'hold' },
      { kind: 'syllable', text: 'I', joinNext: false },
    ])
  })

  it('times one syllable per note, holds extend the syllable, lines stay up through rests', () => {
    const melody = parseMelody('C4/1 D4/1 E4/2 r/2 F4/1 G4/1')
    const { lines, unusedNotes, unusedTokens } = alignLyrics(melody, 'Hel-lo _ / there you')
    expect(unusedNotes).toBe(0)
    expect(unusedTokens).toBe(0)
    expect(lines).toHaveLength(2)
    expect(lineText(lines[0])).toBe('Hello')
    expect(lines[0].syllables[1]).toMatchObject({ text: 'lo', start: 1, end: 4 })
    expect(lines[0].end).toBe(6) // until the next line starts
    expect(lineText(lines[1])).toBe('there you')
    expect(lineAt(lines, 5)).toBe(0)
    expect(lineAt(lines, 6.5)).toBe(1)
  })

  it('reports words that do not fit the tune', () => {
    const r = alignLyrics(parseMelody('C4/1 D4/1'), 'one two three')
    expect(r.unusedTokens).toBe(1)
    expect(alignLyrics(parseMelody('C4/1 D4/1 E4/1'), 'one').unusedNotes).toBe(2)
  })
})

describe('built-in songs with words', () => {
  for (const s of SINGALONG_SONGS) {
    it(`${s.title}: every note has exactly one syllable or hold`, () => {
      const r = alignLyrics(s.melody, s.lyrics!)
      expect(r.unusedTokens, 'extra words').toBe(0)
      expect(r.unusedNotes, 'notes without words').toBe(0)
    })
  }

  it('every built-in song fills whole bars with chords to the end', () => {
    for (const s of ALL_BUILT_IN_SONGS) {
      const end = s.melody.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
      const chordEnd = s.chords.reduce((m, c) => Math.max(m, c.start + c.dur), 0)
      expect(chordEnd % s.beatsPerBar, s.title).toBe(0)
      expect(chordEnd, s.title).toBeGreaterThanOrEqual(end)
      expect(chordEnd - end, s.title).toBeLessThan(s.beatsPerBar)
    }
  })
})

describe('karaoke MIDI words', () => {
  it('turns timed text events into the lyric format, with lines and word joins', () => {
    const melody = parseMelody('C4/1 D4/1 E4/1 F4/1 G4/2')
    const ppq = 480
    const events = [
      { ticks: 0, text: '@TTitle' },
      { ticks: 0, text: '/Twin' },
      { ticks: 480, text: 'kle ' },
      { ticks: 960, text: 'star ' },
      { ticks: 1440, text: '\\how ' },
      { ticks: 1920, text: 'I ' },
    ]
    const text = lyricsFromMidiEvents(events, ppq, melody)!
    expect(text).toBe('Twin-kle star / how I _'.replace(' _', ''))
    const r = alignLyrics(melody, text)
    expect(r.lines.map(lineText)).toEqual(['Twinkle star', 'how I'])
    expect(r.unusedNotes).toBe(0)
  })
})
