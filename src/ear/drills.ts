// Ear-training drills. Each makes questions for an item (e.g. "M3"), pitched
// inside the singer's range. Sung answers are checked by the pitch engine.

import { playChord, playNote } from '../audio/instruments'
import { getAudioContext } from '../audio/context'
import { CHORD_INTERVALS, MAJOR_STEPS, intervalInfo, diatonicShift } from '../music/theory'
import { midiToDisplayName } from '../music/notes'

export type EarAnswer =
  | { type: 'choice'; options: { value: string; label: string }[]; correct: string }
  | { type: 'sing'; targetMidi: number; label: string }

export interface EarQuestion {
  prompt: string
  play: () => void
  answer: EarAnswer
  /** Shown after answering. */
  explain: string
}

export interface EarDrill {
  id: string
  title: string
  description: string
  sung: boolean
  items: (coreOnly: boolean) => string[]
  make: (item: string, low: number, high: number, coreOnly: boolean) => EarQuestion
  /** Label used in the weakest-interval stats. */
  statLabel: (item: string) => string
}

const CORE = ['m3', 'M3', 'P4', 'P5', 'M6', 'P8']
const ALL = ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']
const SEMIS: Record<string, number> = { m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12 }

const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
const now = () => getAudioContext().currentTime + 0.1

function intervalOptions(core: boolean) {
  return (core ? CORE : ALL).map((v) => ({ value: v, label: intervalInfo(SEMIS[v]).name }))
}

function intervalDrill(kind: 'up' | 'down' | 'together'): EarDrill {
  const titles = { up: 'Intervals going up', down: 'Intervals going down', together: 'Intervals played together' }
  return {
    id: `interval-${kind}`,
    title: titles[kind],
    description: {
      up: 'Two notes, low then high. Name the gap.',
      down: 'Two notes, high then low. Name the gap.',
      together: 'Two notes at once. Name the gap.',
    }[kind],
    sung: false,
    items: (core) => (core ? CORE : ALL),
    make: (item, low, high, coreOnly) => {
      const s = SEMIS[item]
      const base = rnd(low, Math.max(low, high - s))
      const [a, b] = kind === 'down' ? [base + s, base] : [base, base + s]
      return {
        prompt: 'Which interval is this?',
        play: () => {
          const t = now()
          if (kind === 'together') playChord([a, b], 1.6, t)
          else {
            playNote(a, 0.8, t)
            playNote(b, 0.8, t + 0.9)
          }
        },
        answer: { type: 'choice', options: intervalOptions(coreOnly), correct: item },
        explain: `${midiToDisplayName(Math.min(a, b))} to ${midiToDisplayName(Math.max(a, b))}: a ${intervalInfo(s).name}.`,
      }
    },
    statLabel: (item) => `${intervalInfo(SEMIS[item]).name} ${kind === 'down' ? 'down' : kind === 'up' ? 'up' : 'together'}`,
  }
}

function singFromDyad(which: 'lower' | 'upper'): EarDrill {
  const items = ['m3', 'M3', 'P4', 'P5', 'm6', 'M6']
  return {
    id: `sing-${which}`,
    title: `Sing the ${which} note`,
    description: `Two notes play together. Sing the ${which} one and hold it.`,
    sung: true,
    items: () => items,
    make: (item, low, high) => {
      const s = SEMIS[item]
      const base = rnd(low, Math.max(low, high - s))
      const target = which === 'lower' ? base : base + s
      return {
        prompt: `Sing the ${which} of the two notes, and hold it.`,
        play: () => playChord([base, base + s], 2, now()),
        answer: { type: 'sing', targetMidi: target, label: midiToDisplayName(target) },
        explain: `The notes were ${midiToDisplayName(base)} and ${midiToDisplayName(base + s)} (a ${intervalInfo(s).name}).`,
      }
    },
    statLabel: (item) => `${intervalInfo(SEMIS[item]).name} (${which} note)`,
  }
}

const QUALITY_NAMES: Record<string, string> = { maj: 'Major', min: 'Minor', dim: 'Diminished', '7': 'Dominant 7th' }

const chordQuality: EarDrill = {
  id: 'chord-quality',
  title: 'Chord quality',
  description: 'Major, minor, diminished or dominant 7th?',
  sung: false,
  items: () => ['maj', 'min', 'dim', '7'],
  make: (item, low, high) => {
    const ivs = CHORD_INTERVALS[item as 'maj']
    const root = rnd(low, Math.max(low, high - 10))
    return {
      prompt: 'What kind of chord is this?',
      play: () => {
        const t = now()
        // Spread first, then together: easier to hear the colour.
        ivs.forEach((iv, i) => playNote(root + iv, 0.5, t + i * 0.35))
        playChord(
          ivs.map((iv) => root + iv),
          1.6,
          t + ivs.length * 0.35 + 0.1,
        )
      },
      answer: { type: 'choice', options: Object.entries(QUALITY_NAMES).map(([value, label]) => ({ value, label })), correct: item },
      explain: {
        maj: 'Major sounds bright and settled.',
        min: 'Minor sounds darker, sadder.',
        dim: 'Diminished sounds tense and unstable.',
        '7': 'Dominant 7th sounds bluesy and wants to move on.',
      }[item]!,
    }
  },
  statLabel: (item) => `${QUALITY_NAMES[item]} chord`,
}

const missingThird: EarDrill = {
  id: 'missing-third',
  title: 'Sing the missing chord note',
  description: 'The bottom and top of a chord play. Sing the middle note to complete it.',
  sung: true,
  items: () => ['maj', 'min'],
  make: (item, low, high) => {
    const root = rnd(low, Math.max(low, high - 7))
    const third = root + (item === 'maj' ? 4 : 3)
    return {
      prompt: `Make it a ${item === 'maj' ? 'major (bright)' : 'minor (dark)'} chord: sing the missing middle note.`,
      play: () => playChord([root, root + 7], 2, now()),
      answer: { type: 'sing', targetMidi: third, label: midiToDisplayName(third) },
      explain: `${midiToDisplayName(root)} and ${midiToDisplayName(root + 7)} need ${midiToDisplayName(third)} for ${item === 'maj' ? 'major' : 'minor'}.`,
    }
  },
  statLabel: (item) => `Chord third (${item === 'maj' ? 'major' : 'minor'})`,
}

const findHarmony: EarDrill = {
  id: 'find-harmony',
  title: 'Find the harmony',
  description: 'A key is set, then a melody note plays. Sing a third above it, with no guide.',
  sung: true,
  items: () => ['1', '2', '3', '4', '5', '6'],
  make: (item, low, high) => {
    const degree = Number(item) - 1
    // Choose a key so the harmony note lands in range.
    const tonic = rnd(low - 4, Math.max(low - 4, high - 12))
    const key = { tonic: ((tonic % 12) + 12) % 12, mode: 'major' as const }
    const melody = tonic + MAJOR_STEPS[degree]
    const target = diatonicShift(melody, 2, key)
    return {
      prompt: 'Listen to the key, then the melody note. Sing a third above the melody note.',
      play: () => {
        const t = now()
        playChord([tonic, tonic + 4, tonic + 7], 1.0, t)
        playNote(melody, 1.6, t + 1.3)
      },
      answer: { type: 'sing', targetMidi: target, label: midiToDisplayName(target) },
      explain: `The melody note was ${midiToDisplayName(melody)}; a third above in this key is ${midiToDisplayName(target)}.`,
    }
  },
  statLabel: () => 'Third above (no guide)',
}

export const EAR_DRILLS: EarDrill[] = [
  intervalDrill('up'),
  intervalDrill('down'),
  intervalDrill('together'),
  singFromDyad('lower'),
  singFromDyad('upper'),
  chordQuality,
  missingThird,
  findHarmony,
]

export function getEarDrill(id: string): EarDrill | undefined {
  return EAR_DRILLS.find((d) => d.id === id)
}

/** A sung answer is right within 50 cents of the target, in any octave. */
export function sungCorrect(sungMidi: number, targetMidi: number): boolean {
  const d = (((sungMidi - targetMidi) % 12) + 12) % 12
  return Math.min(d, 12 - d) <= 0.5
}

