# HarmonyLab

Learn to find and hold a harmony, with live pitch feedback. Runs entirely in the browser: no install, no login, and your voice never leaves your device.

Live: https://spidyloke.github.io/harmonylab/

## What's in it

- **First-run setup**: mic permission, headphone bleed check, vocal range test, clap (or tap) latency test, five-task placement check (starts you at level 1 to 5).
- **Live pitch lane**: target bar, your voice as a line, the melody as a faint lane; in tune / slightly off / off shown by colour, line style and an arrow marker. Detects "you slid to the melody".
- **Ten levels**: single pitch → steady hold → intervals above and below a drone → parallel thirds → holding against a moving melody → thirds above and below on songs → chord-aware harmony → the middle of three parts. Every drill fades the guide (full, half, quiet, off); passing needs 80% in tune with the guide off.
- **Ear training**: intervals (up, down, together), sing the lower/upper note, chord quality, sing the missing chord note, find the harmony. Missed items come back more often (Leitner boxes).
- **Your own songs**: sing it in (with a click, freely, or over a backing track), import MIDI (melody track suggested, chords guessed), or type it in on a piano roll. Key suggested, harmony parts generated (third above, third below, sixth below, chord-aware), every note editable. Practice with loops, 50 to 100% tempo, separate melody and guide volume, guide fading, and an optional backing track synced automatically by beat detection.
- **Progress**: level, streak, minutes, accuracy trend, weakest intervals, per-exercise history, a ten-minute "today's session" biased to weak spots, JSON export and import.
- Built-in songs are original melodies written for HarmonyLab.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (use the https Pages link for phones: the mic needs https)
```

## Check it

```bash
npm run lint
npm test           # unit tests: harmony generator, scoring, pitch detection, transcription, beat detection, storage…
npm run build
npm run test:e2e   # plays generated audio into Chromium as a fake mic and walks every section
```

To run the browser tests against a preinstalled Chromium, set `PW_CHROMIUM_PATH`.

## How the pitch engine works

1. The mic is opened with echo cancellation, noise suppression and auto gain switched off, because they bend pitch.
2. An AudioWorklet (the browser's real-time audio thread) keeps a rolling 24 ms window and runs the McLeod pitch method (`pitchy`) every 256 samples (~5 ms).
3. The main thread drops readings below the clarity and loudness thresholds (breaths, hiss), smooths with a median of three to remove octave glitches, and stores a short history.
4. The pitch lane draws that history on a canvas every display frame, outside React.

All sounds (Tone.js) share the same AudioContext as the mic, so the voice and the guide sit on one clock; scoring shifts the voice by the measured latency.

## Layout

```
src/audio        mic, audio context, worklet, engine, instruments, piece runner, setup checks
src/music        note maths, theory, notation, transposition, harmony generator, key/chord detection,
                 transcription, beat detection, MIDI import, built-in songs
src/scoring      in-tune states, take scoring, melody-slide detection
src/curriculum   the ten levels, drill builders, placement
src/ear          ear drills, spaced repetition
src/songs        song library and backing tracks
src/progress     stats and today's session
src/db           local database (Dexie / IndexedDB), progress, export/import
src/ui           pitch lane, take view, piano roll, staff view, screens
e2e              browser tests with fake-mic audio
```
