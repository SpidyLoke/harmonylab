// Built-in songs. All original melodies written for HarmonyLab in a modern pop
// style, so they are free to ship. Written in C major / A minor; every song is
// transposed to fit the singer at play time.

import { parseChordChart, parseMelody } from './notation'
import type { ChordEvent, Key, Note } from './types'

export interface BuiltInSong {
  id: string
  title: string
  vibe: string
  bpm: number
  beatsPerBar: number
  key: Key
  melody: Note[]
  chords: ChordEvent[]
}

function song(
  id: string,
  title: string,
  vibe: string,
  bpm: number,
  key: Key,
  bars: string[],
  chart: string,
): BuiltInSong {
  const melody: Note[] = []
  bars.forEach((bar, i) => melody.push(...parseMelody(bar, i * 4)))
  return { id, title, vibe, bpm, beatsPerBar: 4, key, melody, chords: parseChordChart(chart, 4) }
}

const C_MAJOR: Key = { tonic: 0, mode: 'major' }
const A_MINOR: Key = { tonic: 9, mode: 'minor' }

export const BUILT_IN_SONGS: BuiltInSong[] = [
  song(
    'neon-summer',
    'Neon Summer',
    'Bright, bouncy, I–V–vi–IV',
    100,
    C_MAJOR,
    [
      'E4/.5 E4/.5 G4/.5 E4/.5 D4/1 C4/1',
      'D4/.5 D4/.5 E4/.5 D4/.5 B3/1 G3/1',
      'C4/.5 C4/.5 E4/.5 G4/.5 A4/1.5 G4/.5',
      'F4/1 E4/.5 D4/.5 C4/2',
      'E4/.5 E4/.5 G4/.5 C5/.5 B4/1 G4/1',
      'B4/.5 A4/.5 G4/.5 D4/.5 D4/1 r/1',
      'C4/.5 E4/.5 A4/1 G4/.5 E4/.5 D4/1',
      'E4/1 D4/1 C4/2',
    ],
    'C | G | Am | F | C | G | Am | C',
  ),
  song(
    'midnight-text',
    'Midnight Text',
    'Moody, late-night, vi–IV–I–V',
    92,
    A_MINOR,
    [
      'A4/.5 A4/.5 G4/.5 E4/1 r/.5 C4/.5 D4/.5',
      'E4/.5 F4/.5 E4/.5 C4/1.5 r/1',
      'G4/.5 G4/.5 E4/.5 G4/.5 C5/1 B4/.5 G4/.5',
      'A4/1 G4/.5 D4/.5 D4/2',
      'A4/.5 A4/.5 G4/.5 E4/1 r/.5 E4/.5 G4/.5',
      'A4/.5 C5/.5 A4/.5 F4/1.5 r/1',
      'G4/1 E4/.5 C4/.5 E4/1 G4/1',
      'D4/1 E4/.5 D4/.5 B3/2',
    ],
    'Am | F | C | G | Am | F | C | G',
  ),
  song(
    'gold-hour',
    'Gold Hour',
    'Warm, anthemic, I–vi–IV–V',
    96,
    C_MAJOR,
    [
      'G4/1 E4/.5 G4/.5 C5/1 G4/1',
      'A4/.5 G4/.5 E4/1 C4/1 E4/1',
      'F4/.5 F4/.5 A4/.5 F4/.5 E4/1 D4/1',
      'D4/.5 E4/.5 G4/1 G4/2',
      'G4/1 E4/.5 G4/.5 C5/1 D5/1',
      'C5/.5 B4/.5 A4/1 E4/1 C4/1',
      'F4/.5 A4/.5 C5/1 B4/.5 A4/.5 G4/1',
      'E4/1 D4/1 C4/2',
    ],
    'C | Am | F | G | C | Am | F | C',
  ),
  song(
    'slow-dance',
    'Slow Dance',
    'Ballad, I–iii–IV–V',
    76,
    C_MAJOR,
    [
      'E4/1.5 D4/.5 C4/1 E4/1',
      'G4/1.5 F4/.5 E4/1 B3/1',
      'A4/1.5 G4/.5 F4/1 A4/1',
      'G4/3 r/1',
      'E4/1.5 D4/.5 C4/1 E4/1',
      'G4/1.5 A4/.5 B4/1 G4/1',
      'C5/1 A4/1 G4/1 F4/1',
      'D4/2 C4/2',
    ],
    'C | Em | F | G | C | Em | F | G C',
  ),
]

export function builtInSong(id: string): BuiltInSong | undefined {
  return BUILT_IN_SONGS.find((s) => s.id === id)
}
