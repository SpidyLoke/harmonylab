// Lyrics: a simple text format timed to the melody, one syllable per note.
//
//   "Twin-kle twin-kle lit-tle star / how I won-der what you are"
//
// - Spaces separate words; a hyphen splits a word into syllables.
// - "/" or a new line starts a new lyric line.
// - "_" holds the previous syllable over the next note (a melisma).
// Each syllable takes the next melody note in time order.

import type { LyricLine, LyricSyllable, Note } from './types'

type Token = { kind: 'syllable'; text: string; joinNext: boolean } | { kind: 'hold' } | { kind: 'break' }

export function tokenise(text: string): Token[] {
  const out: Token[] = []
  for (const raw of text.replace(/\r/g, '').split(/(\n|\/)/)) {
    if (raw === '\n' || raw === '/') {
      if (out.length && out[out.length - 1].kind !== 'break') out.push({ kind: 'break' })
      continue
    }
    for (const word of raw.split(/\s+/).filter(Boolean)) {
      if (/^_+$/.test(word)) {
        for (let i = 0; i < word.length; i++) out.push({ kind: 'hold' })
        continue
      }
      const parts = word.split('-').filter((p) => p.length)
      parts.forEach((p, i) => out.push({ kind: 'syllable', text: p, joinNext: i < parts.length - 1 }))
    }
  }
  while (out.length && out[out.length - 1].kind === 'break') out.pop()
  return out
}

export interface AlignResult {
  lines: LyricLine[]
  /** Syllables and holds that found no note (the words are longer than the tune). */
  unusedTokens: number
  /** Notes left with no syllable at the end. */
  unusedNotes: number
}

export function alignLyrics(melody: Note[], text: string): AlignResult {
  const notes = [...melody].sort((a, b) => a.start - b.start)
  const tokens = tokenise(text)
  const lines: LyricLine[] = []
  let current: LyricSyllable[] = []
  let i = 0
  let unused = 0
  const close = () => {
    if (current.length) lines.push({ start: current[0].start, end: current[current.length - 1].end, syllables: current })
    current = []
  }
  for (const t of tokens) {
    if (t.kind === 'break') {
      close()
      continue
    }
    const n = notes[i]
    if (!n) {
      unused++
      continue
    }
    i++
    if (t.kind === 'hold') {
      const last = current[current.length - 1] ?? lines[lines.length - 1]?.syllables.at(-1)
      if (last) last.end = n.start + n.dur
      continue
    }
    current.push({ start: n.start, end: n.start + n.dur, text: t.text, joinNext: t.joinNext })
  }
  close()
  // A line lasts until the next one starts, so it stays on screen through rests.
  for (let k = 0; k < lines.length - 1; k++) lines[k].end = Math.max(lines[k].end, lines[k + 1].start)
  return { lines, unusedTokens: unused, unusedNotes: notes.length - i }
}

/** The line showing at `beat`: the current one, or the next if we're in a gap before it. */
export function lineAt(lines: LyricLine[], beat: number): number {
  for (let k = 0; k < lines.length; k++) if (beat < lines[k].end) return k
  return lines.length - 1
}

export function lineText(line: LyricLine): string {
  return line.syllables.map((s) => s.text + (s.joinNext ? '' : ' ')).join('').trim()
}

/**
 * Karaoke (.kar) and lyric-track MIDI files: text events timed in ticks.
 * Lines start with "/" or "\"; "@" events are file headers.
 * Turns them into the text format above, matched to the melody by time.
 */
export function lyricsFromMidiEvents(events: { ticks: number; text: string }[], ppq: number, melody: Note[], firstBeat = 0): string | null {
  const words = events
    .filter((e) => e.text && !e.text.startsWith('@'))
    .map((e) => ({ beat: e.ticks / ppq - firstBeat, text: e.text }))
    .filter((e) => e.beat > -0.01)
  if (words.length < 4) return null
  const notes = [...melody].sort((a, b) => a.start - b.start)
  const out: string[] = []
  let w = 0
  for (const n of notes) {
    // Lyric events at (or just before) this note's start belong to it.
    const here: string[] = []
    while (w < words.length && words[w].beat <= n.start + 0.12) here.push(words[w++].text)
    if (!here.length) {
      out.push('_')
      continue
    }
    let text = here.join('')
    if (/^[/\\]/.test(text) && out.length) out.push('/')
    text = text.replace(/[/\\]/g, '')
    // A syllable with no trailing space joins the next one into a word.
    const joins = !/\s$/.test(text) && w < words.length && !/^[\s/\\]/.test(words[w].text)
    const clean = text.trim().replace(/[-_/]/g, '')
    out.push(clean ? clean + (joins ? '-' : '') : '_')
  }
  // Rebuild "syl- la- ble" tokens into hyphenated words.
  return out.join(' ').replace(/- /g, '-')
}
