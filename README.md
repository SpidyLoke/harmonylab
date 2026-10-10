# HarmonyLab

Learn to find and hold a harmony, with live pitch feedback. Runs entirely in the browser: no install, no login, and your voice never leaves your device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (use the https Pages link for phones: the mic needs https)
```

## Check it

```bash
npm run lint
npm test           # unit tests: note maths, in-tune scoring, pitch detection on synthetic voices
npm run build
npm run test:e2e   # plays generated audio into Chromium as a fake mic
```

To run the browser tests against a preinstalled Chromium, set `PW_CHROMIUM_PATH`.

## How the pitch engine works

1. The mic is opened with echo cancellation, noise suppression and auto gain switched off, because they bend pitch.
2. An AudioWorklet (the browser's real-time audio thread) keeps a rolling 24 ms window and runs the McLeod pitch method (`pitchy`) every 256 samples (~5 ms).
3. The main thread drops readings below the clarity and loudness thresholds (breaths, hiss), smooths with a median of three to remove octave glitches, and stores a short history.
4. The pitch lane draws that history on a canvas every display frame, outside React.

All guide sounds (Tone.js) share the same AudioContext, so the voice and the guide sit on one clock.

## Layout

```
src/audio      mic, audio context, worklet, engine, guide instruments
src/music      note maths (later: scales, harmony generator, transcription, MIDI)
src/scoring    in-tune states and tolerances (later: take scoring, melody-drift detection)
src/state      settings and engine status
src/db         local database (Dexie / IndexedDB)
src/ui         pitch lane, mic permission flow, screens
e2e            browser tests with fake-mic audio
```
