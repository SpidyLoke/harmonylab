// Shared music data shapes. Times are in beats unless a name says otherwise.

export interface Note {
  /** Start, in beats from the start of the piece. */
  start: number
  /** Length in beats. */
  dur: number
  /** MIDI note number (60 = middle C). */
  midi: number
}

export type Mode = 'major' | 'minor'

export interface Key {
  /** Pitch class of the home note, 0 = C. */
  tonic: number
  mode: Mode
}

export interface ChordEvent {
  start: number
  dur: number
  /** Chord symbol as typed, e.g. "Am", "F#m7", "G7". */
  symbol: string
}

/**
 * Everything a practice take needs: what plays, what the singer sings, and
 * how it is timed. Built by the curriculum, the song editor and the ear drills.
 */
export interface Piece {
  bpm: number
  beatsPerBar: number
  lengthBeats: number
  /** The tune. Played at the melody volume and drawn as the faint lane. */
  melody: Note[]
  /** The singer's part. The guide voice plays it (fading by stage) and it is scored. */
  target: Note[]
  /** Other parts that play but are not scored, e.g. the low voice in three-part harmony. */
  others?: Note[][]
  /** Reference notes played at full volume before a target, never scored. */
  cues?: Note[]
  /** Chord pad underneath, if any. */
  chords?: ChordEvent[]
}
