// The ten levels. Each has a short explainer (about a minute to read), a
// live try-it, a demo, then drills. Every drill runs with the guide fading:
// full, half, quiet, off. A drill is passed at 80% in tune with the guide off;
// a level is passed when all its drills are.

import { droneHold, holdAgainstMelody, matchNotes, parallelThirds, songPart } from './builders'
import { parseMelody } from '../music/notation'
import { BUILT_IN_SONGS } from '../music/songs'
import type { Piece } from '../music/types'

export interface Drill {
  id: string
  title: string
  description: string
  build: () => Piece
  /** Interval label for weakest-interval stats, when the drill is one interval. */
  interval?: string
}

export interface TryIt {
  /** Semitones of the target above (+) or below (-) the drone. Null: no drone. */
  interval: number | null
  hint: string
}

export interface Level {
  n: number
  title: string
  goal: string
  explainer: string[]
  tryIt: TryIt
  drills: Drill[]
}

const song = (id: string) => BUILT_IN_SONGS.find((s) => s.id === id)!

export const LEVELS: Level[] = [
  {
    n: 1,
    title: 'Match a single pitch',
    goal: 'Hear a note and sing it back, on the note.',
    explainer: [
      'Every harmony starts here: hearing a note and landing on it. Pitch is how high or low a sound is. Your job is to make your voice match the gold bar.',
      'The app plays a note first. That is the "listen" bar. Then the gold bar arrives and you sing the same note on an open "ah". Your voice draws a line: when it sits inside the bar, you are in tune.',
      'If the line is above the bar you are sharp (too high); below, you are flat (too low). Slide gently until the line settles in the bar. Small slides are fine. Nobody hits every note dead centre straight away.',
      'Tip: sing at a comfortable speaking volume. Louder is not more in tune.',
    ],
    tryIt: { interval: null, hint: 'Hit "Hear it", then sing the gold note.' },
    drills: [
      {
        id: 'l1-five-slow',
        title: 'Five notes, slow',
        description: 'Listen, then sing. Plenty of time on each note.',
        build: () => matchNotes([60, 62, 64, 60, 67], 2, 4),
      },
      {
        id: 'l1-five-jumps',
        title: 'Five notes, bigger jumps',
        description: 'Wider leaps between notes, a bit less time each.',
        build: () => matchNotes([60, 67, 62, 65, 59], 2, 3, 88),
      },
    ],
  },
  {
    n: 2,
    title: 'Hold a note steady against a drone',
    goal: 'Keep one note straight and steady while another sound plays.',
    explainer: [
      'A drone is one note held underneath you, like the hum of a bagpipe. It is the simplest thing to sing against, and it shows up every wobble.',
      'Here the drone and your note are the same. Sing into the drone until the two blend into one sound. When you are slightly off, you will hear a slow "wah-wah" beating. In tune, the beating stops.',
      'Steady matters as much as accurate. Breathe low, keep the air moving evenly, and aim for a straight tone, without vibrato for now.',
      'The purple lane is the drone. Your gold bar sits on top of it.',
    ],
    tryIt: { interval: 0, hint: 'Turn on the drone and sing the same note until it blends.' },
    drills: [
      {
        id: 'l2-unison',
        title: 'Blend with the drone',
        description: 'Three holds of 6 beats on the drone note.',
        build: () => droneHold(60, 0, 3, 6),
        interval: 'Unison',
      },
      {
        id: 'l2-long',
        title: 'Longer, steadier holds',
        description: 'Two holds of 10 beats. Keep the line flat.',
        build: () => droneHold(57, 0, 2, 10, 66),
        interval: 'Unison',
      },
    ],
  },
  {
    n: 3,
    title: 'Sing intervals above a drone',
    goal: 'Find the octave, fifth, third and sixth above a note.',
    explainer: [
      'An interval is the distance between two notes. Harmony is just singing a different note at a pleasing interval from someone else.',
      'The octave is the same note, higher: it sounds almost like one note. The fifth is strong and open, think of the first two notes of "Twinkle Twinkle". The third is sweet: it is the sound of most pop harmonies. The sixth is warm and wide, like the start of "My Bonnie lies over the ocean".',
      'The drone stays on its note in the purple lane. Your gold bar is above it. The guide plays your note at first, then fades away, so by the end you find it on your own.',
      'Listen for the moment the two notes lock and ring. That ring is how you know it is right.',
    ],
    tryIt: { interval: 7, hint: 'Drone on, then find the fifth above it.' },
    drills: [
      { id: 'l3-octave-up', title: 'Octave above', description: 'The same note, higher.', build: () => droneHold(48, 12, 3, 4), interval: 'Octave above' },
      { id: 'l3-fifth-up', title: 'Fifth above', description: 'Strong and open.', build: () => droneHold(53, 7, 3, 4), interval: 'Fifth above' },
      { id: 'l3-third-up', title: 'Major third above', description: 'Sweet and bright.', build: () => droneHold(56, 4, 3, 4), interval: 'Third above' },
      { id: 'l3-sixth-up', title: 'Major sixth above', description: 'Warm and wide.', build: () => droneHold(53, 9, 3, 4), interval: 'Sixth above' },
    ],
  },
  {
    n: 4,
    title: 'Sing intervals below a drone',
    goal: 'Find the same intervals underneath a note.',
    explainer: [
      'Now the drone is above you and you sing underneath. This is what harmony singers do most of the time, because the melody is usually the top line.',
      'Singing below is harder: the higher note grabs your ear and pulls you up towards it. Keep your note low and grounded, and do not chase the drone.',
      'A fifth below sounds like the end of a phrase landing home. A third below is the classic "backing vocal" sound. A sixth below feels wide and supportive.',
      'Same routine: the guide helps at first, then fades out.',
    ],
    tryIt: { interval: -4, hint: 'Drone on, then find the third below it.' },
    drills: [
      { id: 'l4-octave-down', title: 'Octave below', description: 'The same note, lower.', build: () => droneHold(72, -12, 3, 4), interval: 'Octave below' },
      { id: 'l4-fifth-down', title: 'Fifth below', description: 'Grounded and open.', build: () => droneHold(67, -7, 3, 4), interval: 'Fifth below' },
      { id: 'l4-third-down', title: 'Major third below', description: 'The backing-vocal sound.', build: () => droneHold(64, -4, 3, 4), interval: 'Third below' },
      { id: 'l4-sixth-down', title: 'Major sixth below', description: 'Wide and supportive.', build: () => droneHold(69, -9, 3, 4), interval: 'Sixth below' },
    ],
  },
  {
    n: 5,
    title: 'Parallel thirds over a moving scale',
    goal: 'Follow a moving melody a third above it.',
    explainer: [
      'So far the other note stood still. Now it moves: a scale walks up step by step, and you walk with it, a third above.',
      'Your thirds will not all be the same size. Some are a major third (four semitones), some a minor third (three). That is what keeps you in key, so trust the gold bars rather than copying the same jump each time.',
      'Feel it as a second tune that moves with the first, not as a series of separate notes.',
    ],
    tryIt: { interval: 4, hint: 'Warm up: a third above the drone.' },
    drills: [
      { id: 'l5-thirds-up', title: 'Thirds on a rising scale', description: 'Eight notes up, slowly.', build: () => parallelThirds(false), interval: 'Third above' },
      { id: 'l5-thirds-updown', title: 'Thirds up and down', description: 'All the way up and back down.', build: () => parallelThirds(true), interval: 'Third above' },
    ],
  },
  {
    n: 6,
    title: 'Hold one note while the melody moves',
    goal: 'Stay put while the tune moves around you.',
    explainer: [
      'A lot of harmony is just holding still. The melody moves; you sit on one note and let the chords change around you.',
      'The hard part is when the melody passes right through your note or close to it. Your ear wants to follow. That pull is the most common way harmony singers get lost, and the app will tell you when it happens: "you slid to the melody".',
      'Lock onto your note, breathe where the gaps are, and let the melody do the moving.',
    ],
    tryIt: { interval: 7, hint: 'Hold the fifth above the drone, then try nudging the drone.' },
    drills: [
      {
        id: 'l6-hold-fifth',
        title: 'Hold the fifth',
        description: 'The melody wanders below your note.',
        build: () => holdAgainstMelody(67, parseMelody('C4/1 D4/1 E4/2 F4/1 E4/1 D4/2 C4/1 E4/1 G4/2 E4/1 D4/1 C4/2')),
        interval: 'Hold',
      },
      {
        id: 'l6-hold-third',
        title: 'Hold the third',
        description: 'The melody crosses right through your note.',
        build: () => holdAgainstMelody(64, parseMelody('C4/1 E4/1 G4/2 F4/1 E4/1 D4/2 G4/1 F4/1 E4/2 D4/1 E4/1 C4/2')),
        interval: 'Hold',
      },
    ],
  },
  {
    n: 7,
    title: 'Harmony a third above, on songs',
    goal: 'Sing a full harmony line above a song melody.',
    explainer: [
      'Time for real songs. The melody plays in the purple lane, your harmony line is gold, a third above the tune most of the way.',
      'This is the classic pop backing-vocal part. On strong beats the line sometimes shifts to a different note to fit the chord underneath: follow the bars, they already account for that.',
      'Start with the guide at full and the melody loud. As you get it, the guide fades until you are singing your part against the melody alone.',
    ],
    tryIt: { interval: 4, hint: 'Warm up: a third above the drone.' },
    drills: [
      { id: 'l7-neon-above', title: song('neon-summer').title, description: 'Bright pop. Third above.', build: () => songPart(song('neon-summer'), 'thirdAbove'), interval: 'Third above' },
      { id: 'l7-gold-above', title: song('gold-hour').title, description: 'Anthemic. Third above.', build: () => songPart(song('gold-hour'), 'thirdAbove'), interval: 'Third above' },
    ],
  },
  {
    n: 8,
    title: 'Harmony below the melody',
    goal: 'Sing a full harmony line underneath a song melody.',
    explainer: [
      'Now you sit under the tune. Below is where most backing singers live, and it is harder, because the melody above keeps pulling your ear up.',
      'One drill uses a third below; the other a sixth below, which sounds fuller and further away. Same skill: find your line, hold your ground.',
      'If the app says you slid to the melody, turn the melody slider down a little for a few takes, then bring it back.',
    ],
    tryIt: { interval: -4, hint: 'Warm up: a third below the drone.' },
    drills: [
      { id: 'l8-midnight-below', title: song('midnight-text').title, description: 'Moody. Third below.', build: () => songPart(song('midnight-text'), 'thirdBelow'), interval: 'Third below' },
      { id: 'l8-slow-sixth', title: song('slow-dance').title, description: 'Ballad. Sixth below.', build: () => songPart(song('slow-dance'), 'sixthBelow'), interval: 'Sixth below' },
    ],
  },
  {
    n: 9,
    title: 'Chord-aware harmonies',
    goal: 'Follow the chords, not just the melody.',
    explainer: [
      'A chord is several notes sounding together, the backbone under the song. You can hear it as the soft pad in the background.',
      'A chord-aware harmony picks notes from the chord rather than always staying a fixed distance from the melody. The result moves less, sounds richer, and sometimes holds still while the melody moves: the skills from levels 6 to 8, combined.',
      'Listen to the pad as much as to the melody. Your note always belongs to the chord underneath it.',
    ],
    tryIt: { interval: -5, hint: 'Warm up: a fourth below the drone.' },
    drills: [
      { id: 'l9-neon-chord', title: song('neon-summer').title, description: 'Chord-aware part below.', build: () => songPart(song('neon-summer'), 'chordBelow'), interval: 'Chord-aware' },
      { id: 'l9-midnight-chord', title: song('midnight-text').title, description: 'Chord-aware part below.', build: () => songPart(song('midnight-text'), 'chordBelow'), interval: 'Chord-aware' },
    ],
  },
  {
    n: 10,
    title: 'Three-part harmony: hold the middle',
    goal: 'Hold the middle part with a voice above and below you.',
    explainer: [
      'Three-part harmony is the full sound of a vocal group. The middle part is the hardest seat: there is a voice above you and a voice below, both pulling at your ear.',
      'The melody plays on top, a low part sits underneath, and you take the middle line. Use everything: know your chord, hold your ground, and do not drift up or down to the nearest voice.',
      'Pass this and you can hold a part in a group.',
    ],
    tryIt: { interval: -3, hint: 'Warm up: a minor third below the drone.' },
    drills: [
      { id: 'l10-gold-middle', title: song('gold-hour').title, description: 'Middle of three parts.', build: () => songPart(song('gold-hour'), 'chordBelow', true), interval: 'Middle part' },
      { id: 'l10-slow-middle', title: song('slow-dance').title, description: 'Middle of three parts.', build: () => songPart(song('slow-dance'), 'chordBelow', true), interval: 'Middle part' },
    ],
  },
]

export function getLevel(n: number): Level | undefined {
  return LEVELS.find((l) => l.n === n)
}

export function findDrill(id: string): { level: Level; drill: Drill } | undefined {
  for (const level of LEVELS) {
    const drill = level.drills.find((d) => d.id === id)
    if (drill) return { level, drill }
  }
  return undefined
}
