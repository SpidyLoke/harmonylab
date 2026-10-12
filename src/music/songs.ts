// Built-in songs, transposed to fit the singer at play time.
// - Originals: pop-style melodies written for HarmonyLab (used by the curriculum).
// - Singalongs: well-known public-domain and traditional songs, with lyrics.
// No copyrighted melodies or lyrics are shipped.

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
  kind: 'original' | 'singalong'
  /** Lyrics in the lyrics text format (see lyrics.ts). */
  lyrics?: string
  /** For rounds: beats before the second voice comes in. */
  roundOffset?: number
  /** Where the song comes from, shown in the library. */
  origin?: string
}

function song(
  id: string,
  title: string,
  vibe: string,
  bpm: number,
  key: Key,
  bars: string[],
  chart: string,
  extra: Partial<BuiltInSong> & { beatsPerBar?: number } = {},
): BuiltInSong {
  const bpb = extra.beatsPerBar ?? 4
  const melody: Note[] = []
  bars.forEach((bar, i) => melody.push(...parseMelody(bar, i * bpb)))
  return { id, title, vibe, bpm, beatsPerBar: bpb, key, melody, chords: parseChordChart(chart, bpb), kind: 'original', ...extra }
}

const C_MAJOR: Key = { tonic: 0, mode: 'major' }
const A_MINOR: Key = { tonic: 9, mode: 'minor' }
const F_MAJOR: Key = { tonic: 5, mode: 'major' }

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

/** Public-domain and traditional singalongs. Melodies and words are out of copyright. */
export const SINGALONG_SONGS: BuiltInSong[] = [
  song(
    'twinkle',
    'Twinkle, Twinkle, Little Star',
    'The first tune everyone knows',
    100,
    C_MAJOR,
    [
      'C4/1 C4/1 G4/1 G4/1',
      'A4/1 A4/1 G4/2',
      'F4/1 F4/1 E4/1 E4/1',
      'D4/1 D4/1 C4/2',
      'G4/1 G4/1 F4/1 F4/1',
      'E4/1 E4/1 D4/2',
      'G4/1 G4/1 F4/1 F4/1',
      'E4/1 E4/1 D4/2',
      'C4/1 C4/1 G4/1 G4/1',
      'A4/1 A4/1 G4/2',
      'F4/1 F4/1 E4/1 E4/1',
      'D4/1 D4/1 C4/2',
    ],
    'C | F C | F C | G C | C F | C G | C F | C G | C | F C | F C | G C',
    {
      kind: 'singalong',
      origin: 'Traditional melody, words by Jane Taylor (1806)',
      lyrics: `Twin-kle twin-kle lit-tle star / how I won-der what you are /
up a-bove the world so high / like a dia-mond in the sky /
twin-kle twin-kle lit-tle star / how I won-der what you are`,
    },
  ),
  song(
    'happy-birthday',
    'Happy Birthday',
    'For every party',
    100,
    C_MAJOR,
    [
      'r/2 G4/.75 G4/.25',
      'A4/1 G4/1 C5/1',
      'B4/2 G4/.75 G4/.25',
      'A4/1 G4/1 D5/1',
      'C5/2 G4/.75 G4/.25',
      'G5/1 E5/1 C5/1',
      'B4/1 A4/1 F5/.75 F5/.25',
      'E5/1 C5/1 D5/1',
      'C5/3',
    ],
    'C | C | G | G | C | C | F | C G | C',
    {
      kind: 'singalong',
      beatsPerBar: 3,
      origin: 'Mildred and Patty Hill (1893); public domain',
      lyrics: `Hap-py birth-day to you / hap-py birth-day to you /
hap-py birth-day dear friend _ / hap-py birth-day to you`,
    },
  ),
  song(
    'jingle-bells',
    'Jingle Bells (chorus)',
    'Bright and bouncy',
    120,
    C_MAJOR,
    [
      'E4/1 E4/1 E4/2',
      'E4/1 E4/1 E4/2',
      'E4/1 G4/1 C4/1.5 D4/.5',
      'E4/4',
      'F4/1 F4/1 F4/1.5 F4/.5',
      'F4/1 E4/1 E4/1 E4/.5 E4/.5',
      'E4/1 D4/1 D4/1 E4/1',
      'D4/2 G4/2',
      'E4/1 E4/1 E4/2',
      'E4/1 E4/1 E4/2',
      'E4/1 G4/1 C4/1.5 D4/.5',
      'E4/4',
      'F4/1 F4/1 F4/1.5 F4/.5',
      'F4/1 E4/1 E4/1 E4/.5 E4/.5',
      'G4/1 G4/1 F4/1 D4/1',
      'C4/4',
    ],
    'C | C | C | C | F | C | D7 | G | C | C | C | C | F | C | G | C',
    {
      kind: 'singalong',
      origin: 'James Lord Pierpont (1857)',
      lyrics: `Jin-gle bells jin-gle bells jin-gle all the way /
oh what fun it is to ride in a one horse o-pen sleigh hey /
jin-gle bells jin-gle bells jin-gle all the way /
oh what fun it is to ride in a one horse o-pen sleigh`,
    },
  ),
  song(
    'joyful-joyful',
    'Ode to Joy (Joyful, Joyful)',
    'Beethoven, singable',
    100,
    C_MAJOR,
    [
      'E4/1 E4/1 F4/1 G4/1',
      'G4/1 F4/1 E4/1 D4/1',
      'C4/1 C4/1 D4/1 E4/1',
      'E4/1.5 D4/.5 D4/2',
      'E4/1 E4/1 F4/1 G4/1',
      'G4/1 F4/1 E4/1 D4/1',
      'C4/1 C4/1 D4/1 E4/1',
      'D4/1.5 C4/.5 C4/2',
      'D4/1 D4/1 E4/1 C4/1',
      'D4/1 E4/.5 F4/.5 E4/1 C4/1',
      'D4/1 E4/.5 F4/.5 E4/1 D4/1',
      'C4/1 D4/1 G3/2',
      'E4/1 E4/1 F4/1 G4/1',
      'G4/1 F4/1 E4/1 D4/1',
      'C4/1 C4/1 D4/1 E4/1',
      'D4/1.5 C4/.5 C4/2',
    ],
    'C | G | C | G | C | G | C | G C | G C | G C | G | C G | C | G | C | G C',
    {
      kind: 'singalong',
      origin: 'Beethoven (1824), words by Henry van Dyke (1907)',
      lyrics: `Joy-ful joy-ful we a-dore thee / God of glo-ry Lord of love /
hearts un-fold like flowers be-fore thee / op-ning to the sun a-bove /
melt the clouds of sin and _ sad-ness / drive the _ dark of doubt a-way /
giv-er of im-mor-tal glad-ness / fill us with the light of day`,
    },
  ),
  song(
    'saints',
    'When the Saints Go Marching In',
    'Jazz-band classic',
    112,
    C_MAJOR,
    [
      'r/1 C4/1 E4/1 F4/1',
      'G4/4',
      'r/1 C4/1 E4/1 F4/1',
      'G4/4',
      'r/1 C4/1 E4/1 F4/1',
      'G4/2 E4/2',
      'C4/2 E4/2',
      'D4/4',
      'r/1 E4/1 E4/1 D4/1',
      'C4/3 C4/1',
      'E4/2 G4/1 G4/1',
      'G4/1 F4/3',
      'r/1 E4/1 F4/1 G4/1',
      'E4/2 C4/2',
      'D4/2 C4/2',
      'C4/4',
    ],
    'C | C | C | C | C | C | C | G | G | C | C | F | C | C | G | C',
    {
      kind: 'singalong',
      origin: 'Traditional spiritual',
      lyrics: `Oh when the saints / go march-ing in /
oh when the saints go march-ing in /
oh Lord I want to be in that num-ber /
when the saints go march-ing in _`,
    },
  ),
  song(
    'auld-lang-syne',
    'Auld Lang Syne',
    'New Year, arms linked',
    84,
    F_MAJOR,
    [
      'r/3 C4/1',
      'F4/1.5 F4/.5 F4/1 A4/1',
      'G4/1.5 F4/.5 G4/1 A4/1',
      'F4/1.5 F4/.5 A4/1 C5/1',
      'D5/3 D5/1',
      'C5/1.5 A4/.5 A4/1 F4/1',
      'G4/1.5 F4/.5 G4/1 A4/1',
      'F4/1.5 D4/.5 D4/1 C4/1',
      'F4/4',
    ],
    'C | F | C | F | Bb | F | C | Bb C | F',
    {
      kind: 'singalong',
      origin: 'Traditional melody, words by Robert Burns (1788)',
      lyrics: `Should auld ac-quaint-ance be for-got and nev-er brought to mind /
should auld ac-quaint-ance be for-got and days of auld lang syne`,
    },
  ),
  song(
    'silent-night',
    'Silent Night',
    'Gentle and slow',
    80,
    C_MAJOR,
    [
      'G4/1.5 A4/.5 G4/1',
      'E4/3',
      'G4/1.5 A4/.5 G4/1',
      'E4/3',
      'D5/2 D5/1',
      'B4/3',
      'C5/2 C5/1',
      'G4/3',
      'A4/2 A4/1',
      'C5/1.5 B4/.5 A4/1',
      'G4/1.5 A4/.5 G4/1',
      'E4/3',
      'A4/2 A4/1',
      'C5/1.5 B4/.5 A4/1',
      'G4/1.5 A4/.5 G4/1',
      'E4/3',
      'D5/2 D5/1',
      'F5/1.5 D5/.5 B4/1',
      'C5/3',
      'E5/3',
      'C5/1 G4/1 E4/1',
      'G4/1.5 F4/.5 D4/1',
      'C4/3',
    ],
    'C | C | C | C | G | G | C | C | F | F | C | C | F | F | C | C | G | G | C | C | C | G | C',
    {
      kind: 'singalong',
      beatsPerBar: 3,
      origin: 'Franz Gruber (1818), English words by John Freeman Young (1859)',
      lyrics: `Si-lent _ night / ho-ly _ night / all is calm / all is bright /
round yon vir-gin moth-er and _ child / ho-ly in-fant so ten-der and mild /
sleep in heav-en-ly peace / sleep in heav-en-ly _ _ peace`,
    },
  ),
  song(
    'frere-jacques',
    'Are You Sleeping (round)',
    'Sing it as a two-part round',
    100,
    C_MAJOR,
    [
      'C4/1 D4/1 E4/1 C4/1',
      'C4/1 D4/1 E4/1 C4/1',
      'E4/1 F4/1 G4/2',
      'E4/1 F4/1 G4/2',
      'G4/.5 A4/.5 G4/.5 F4/.5 E4/1 C4/1',
      'G4/.5 A4/.5 G4/.5 F4/.5 E4/1 C4/1',
      'C4/1 G3/1 C4/2',
      'C4/1 G3/1 C4/2',
    ],
    'C | C | C | C | C | C | C | C',
    {
      kind: 'singalong',
      roundOffset: 8,
      origin: 'Traditional French round',
      lyrics: `Are you sleep-ing / are you sleep-ing / broth-er John / broth-er John /
morn-ing bells are ring-ing / morn-ing bells are ring-ing / ding dang dong / ding dang dong`,
    },
  ),
  song(
    'row-your-boat',
    'Row, Row, Row Your Boat (round)',
    'The easiest round there is',
    100,
    C_MAJOR,
    [
      'C4/1.5 C4/1.5',
      'C4/1 D4/.5 E4/1.5',
      'E4/1 D4/.5 E4/1 F4/.5',
      'G4/3',
      'C5/.5 C5/.5 C5/.5 G4/.5 G4/.5 G4/.5',
      'E4/.5 E4/.5 E4/.5 C4/.5 C4/.5 C4/.5',
      'G4/1 F4/.5 E4/1 D4/.5',
      'C4/3',
    ],
    'C | C | C | C | C | C | G | C',
    {
      kind: 'singalong',
      beatsPerBar: 3,
      roundOffset: 6,
      origin: 'Traditional round (1852)',
      lyrics: `Row row row your boat / gent-ly down the stream /
mer-ri-ly mer-ri-ly mer-ri-ly mer-ri-ly / life is but a dream`,
    },
  ),
]

export const ALL_BUILT_IN_SONGS: BuiltInSong[] = [...BUILT_IN_SONGS, ...SINGALONG_SONGS]

export function builtInSong(id: string): BuiltInSong | undefined {
  return ALL_BUILT_IN_SONGS.find((s) => s.id === id)
}
