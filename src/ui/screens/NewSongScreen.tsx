// Three ways to get a melody in: sing it, import a MIDI file, or type it in.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import * as Tone from 'tone'
import { FrameRecorder } from '../../audio/checks'
import { getAudioContext, unlockAudio } from '../../audio/context'
import { makeClickSynth, sliderToDb } from '../../audio/instruments'
import { estimateTempo, framesToNotes, quantize } from '../../music/transcribe'
import { midiOnsetsSec, readMidi, songFromMidi, type MidiImport } from '../../music/midiImport'
import { candidateStretches, syncMidiToAudio } from '../../music/syncMidi'
import { alignLyrics } from '../../music/lyrics'
import { inferChords } from '../../music/chordInfer'
import { detectKey } from '../../music/keyDetect'
import { endOf } from '../../music/notation'
import { midiToDisplayName } from '../../music/notes'
import type { Note } from '../../music/types'
import { addBuiltInToLibrary, analyseBacking, createSong, loadBackingBuffer, mixdown, storeBackingFile } from '../../songs/library'
import { ALL_BUILT_IN_SONGS } from '../../music/songs'
import { Button, Segmented } from '../components/Button'
import { MicGate } from '../components/MicGate'
import { PitchLane } from '../components/PitchLane'

type Way = 'record' | 'hit' | 'manual' | 'builtin'

export function NewSongScreen() {
  const [way, setWay] = useState<Way>('record')
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Add a song</h1>
      <p className="mt-1 text-muted">Get the melody in, and HarmonyLab writes the harmony parts for you.</p>
      <div className="mt-4">
        <Segmented<Way>
          label="How to add the melody"
          value={way}
          onChange={setWay}
          options={[
            { value: 'record', label: 'Sing it' },
            { value: 'hit', label: 'Bring a hit' },
            { value: 'manual', label: 'Type it in' },
            { value: 'builtin', label: 'Built-in' },
          ]}
        />
      </div>
      <div className="mt-5">
        {way === 'record' && (
          <MicGate>
            <RecordMelody />
          </MicGate>
        )}
        {way === 'hit' && <HitPanel />}
        {way === 'manual' && <ManualStart />}
        {way === 'builtin' && <BuiltInPicker />}
      </div>
    </div>
  )
}

function TitleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">Song title</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-base"
        placeholder="My song"
      />
    </label>
  )
}

type RecordMode = 'click' | 'free' | 'backing'

function RecordMelody() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<RecordMode>('click')
  const [bpm, setBpm] = useState(90)
  const [state, setState] = useState<'ready' | 'countin' | 'recording' | 'analysing' | 'review'>('ready')
  const [notes, setNotes] = useState<Note[]>([])
  const [found, setFound] = useState<{ bpm: number; backing?: { fileId: number; name: string; offsetSec: number; bpmDetected: number; confidence: number } } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<FrameRecorder | null>(null)
  const clock = useRef<{ beat0: number; spb: number; stop: () => void } | null>(null)
  useEffect(() => () => clock.current?.stop(), [])

  const start = async () => {
    setError(null)
    await unlockAudio()
    const ctx = getAudioContext()
    if (mode === 'backing') {
      if (!file) return setError('Choose a backing track first.')
      setState('analysing')
      const fileId = await storeBackingFile(file)
      const buffer = await loadBackingBuffer(fileId)
      if (!buffer) return setError("Couldn't read that audio file.")
      const info = analyseBacking(buffer, 4)
      const player = new Tone.Player(buffer).toDestination()
      player.volume.value = sliderToDb(0.8)
      const t0 = ctx.currentTime + 0.3
      player.start(t0)
      const spb = 60 / info.bpm
      clock.current = {
        beat0: t0 + info.downbeatSec,
        spb,
        stop: () => {
          player.stop()
          setTimeout(() => player.dispose(), 300)
        },
      }
      setFound({ bpm: info.bpm, backing: { fileId, name: file.name, offsetSec: info.downbeatSec, bpmDetected: info.bpm, confidence: info.confidence } })
      rec.current = new FrameRecorder()
      setState('recording')
      return
    }
    if (mode === 'click') {
      const click = makeClickSynth()
      const spb = 60 / bpm
      const t0 = ctx.currentTime + 0.3
      // Count-in, then a click on every beat while singing (headphones keep it out of the mic).
      for (let i = 0; i < 4 + 400; i++) click.triggerAttackRelease(i % 4 === 0 ? 1760 : 1320, 0.04, t0 + i * spb, i < 4 ? 1 : 0.5)
      clock.current = {
        beat0: t0 + 4 * spb,
        spb,
        stop: () => {
          click.volume.value = -Infinity
          setTimeout(() => click.dispose(), 300)
        },
      }
      setFound({ bpm })
      setState('countin')
      setTimeout(() => setState('recording'), 4 * spb * 1000 + 300)
    } else {
      clock.current = { beat0: 0, spb: 0, stop: () => undefined }
      setFound(null)
      setState('recording')
    }
    rec.current = new FrameRecorder()
  }

  const stop = () => {
    const frames = rec.current?.stop() ?? []
    rec.current = null
    clock.current?.stop()
    const timed = framesToNotes(frames.map((f) => ({ t: f.t, midi: f.midi })))
    if (timed.length === 0) {
      setState('ready')
      return setError("Didn't hear any notes. Sing or hum a little louder, on \"doo\" or \"la\".")
    }
    let tempo = found?.bpm ?? bpm
    let origin = clock.current?.beat0 ?? 0
    if (mode === 'free') {
      const est = estimateTempo(timed.map((n) => n.startSec))
      tempo = est.bpm
      origin = est.originSec
      setFound({ bpm: Math.round(tempo) })
    }
    let q = quantize(timed, tempo, origin, 0.25)
    // Start the song at the bar where singing begins.
    const firstBar = q.length ? Math.floor(q[0].start / 4) * 4 : 0
    q = q.map((n) => ({ ...n, start: n.start - firstBar }))
    if (found?.backing) {
      setFound({ ...found, backing: { ...found.backing, offsetSec: found.backing.offsetSec + (firstBar * 60) / tempo } })
    }
    setNotes(q)
    setState('review')
  }

  const save = async () => {
    const id = await createSong({
      title: title.trim() || 'My song',
      bpm: Math.round(found?.bpm ?? bpm),
      beatsPerBar: 4,
      melody: notes,
      chords: inferChords(notes, detectKey(notes), 4, Math.ceil(endOf(notes) / 4) * 4),
      source: 'record',
      backing: found?.backing ?? null,
    })
    navigate(`/songs/${id}`)
  }

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-surface p-5">
      <TitleInput value={title} onChange={setTitle} />
      {state === 'ready' && (
        <>
          <Segmented<RecordMode>
            label="Timing"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'click', label: 'With a click' },
              { value: 'free', label: 'Freely' },
              { value: 'backing', label: 'Over a track' },
            ]}
          />
          {mode === 'click' && (
            <label className="block text-sm">
              Tempo: {bpm} beats per minute
              <input type="range" min={60} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-spot)]" />
            </label>
          )}
          {mode === 'free' && <p className="text-sm text-muted">Sing at your own pace. The tempo is worked out from your notes.</p>}
          {mode === 'backing' && (
            <label className="block text-sm">
              Backing track (MP3, WAV, M4A). It plays while you sing, and its beat sets the tempo.
              <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
            </label>
          )}
          <p className="text-sm text-muted">Sing or hum the tune on "doo" or "la". Headphones on, so the click or track stays out of the mic.</p>
          <Button variant="primary" onClick={() => void start()}>
            ● Record
          </Button>
        </>
      )}
      {state === 'analysing' && <p>Finding the beat in your track…</p>}
      {(state === 'countin' || state === 'recording') && (
        <>
          <div className="overflow-hidden rounded-2xl border border-line">
            <PitchLane getTargets={() => []} toleranceCents={50} className="block h-56 w-full" />
          </div>
          <p className="text-lg font-semibold">{state === 'countin' ? 'Count-in…' : '● Recording. Sing the melody.'}</p>
          {state === 'recording' && (
            <Button variant="primary" onClick={stop}>
              ■ Stop
            </Button>
          )}
        </>
      )}
      {state === 'review' && (
        <>
          <p>
            Heard <b>{notes.length} notes</b> at <b>{Math.round(found?.bpm ?? bpm)} bpm</b>
            {found?.backing && ' in time with your track'}. You can fix any note in the editor next.
          </p>
          <p className="text-sm text-muted">{notes.slice(0, 16).map((n) => midiToDisplayName(n.midi)).join(' · ')}{notes.length > 16 ? ' …' : ''}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void save()}>
              Save and edit
            </Button>
            <Button onClick={() => setState('ready')}>Record again</Button>
          </div>
        </>
      )}
      {error && (
        <p className="text-near" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function HitPanel() {
  const navigate = useNavigate()
  const [imp, setImp] = useState<MidiImport | null>(null)
  const [name, setName] = useState('')
  const [track, setTrack] = useState(0)
  const [audio, setAudio] = useState<{ file: File; fileId: number; buffer: AudioBuffer } | null>(null)
  const [sync, setSync] = useState<{ offsetSec: number; bpm: number; confidence: number } | null>(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsFromFile, setLyricsFromFile] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const song = imp ? songFromMidi(imp, track) : null

  const loadMidi = async (f: File) => {
    setError(null)
    try {
      const r = readMidi(await f.arrayBuffer())
      setImp(r)
      setTrack(r.suggestedTrack)
      setName((n) => n || f.name.replace(/\.(midi?|kar)$/i, ''))
      const s = songFromMidi(r, r.suggestedTrack)
      if (s.lyricsText) {
        setLyrics(s.lyricsText)
        setLyricsFromFile(true)
      }
    } catch {
      setError("Couldn't read that file. Is it a .mid or .kar file?")
    }
  }

  const loadAudio = async (f: File) => {
    setError(null)
    setBusy('Reading the audio…')
    try {
      const fileId = await storeBackingFile(f)
      const buffer = await loadBackingBuffer(fileId)
      if (!buffer) throw new Error('decode')
      setAudio({ file: f, fileId, buffer })
      setName((n) => n || f.name.replace(/\.[a-z0-9]+$/i, ''))
    } catch {
      setError("Couldn't read that audio file. Try an MP3, WAV or M4A.")
    }
    setBusy(null)
  }

  // Line the MIDI up with the audio whenever both are in.
  useEffect(() => {
    if (!imp || !audio || !song) return
    let cancelled = false
    setBusy('Lining the MIDI up with the audio…')
    // Let the message paint before the number crunching.
    setTimeout(() => {
      if (cancelled) return
      const beat = analyseBacking(audio.buffer, imp.beatsPerBar)
      const mono = mixdown(audio.buffer)
      const r = syncMidiToAudio(midiOnsetsSec(imp), mono, audio.buffer.sampleRate, { stretches: candidateStretches(imp.bpm, beat.bpm) })
      const bpm = imp.bpm / r.stretch
      setSync({ offsetSec: r.offsetSec + (song.firstBeat * 60) / bpm, bpm, confidence: r.confidence })
      setBusy(null)
    }, 50)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imp, audio, track])

  const check = song && lyrics.trim() ? alignLyrics(song.melody, lyrics) : null

  const save = async () => {
    if (!song || !song.melody.length) return setError('That track has no notes.')
    const id = await createSong({
      title: name.trim() || 'My song',
      bpm: Math.round(sync?.bpm ?? song.bpm),
      beatsPerBar: song.beatsPerBar,
      melody: song.melody,
      chords: song.chords,
      key: song.key,
      source: 'midi',
      lyricsText: lyrics.trim() || undefined,
      selectedPart: 'melody',
      backing: audio && sync ? { fileId: audio.fileId, name: audio.file.name, offsetSec: sync.offsetSec, bpmDetected: sync.bpm, confidence: sync.confidence } : null,
    })
    navigate(`/songs/${id}/practice`)
  }

  return (
    <section className="space-y-5 rounded-3xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        For songs you love that can't ship in the app. Bring the files yourself; they stay on this device.
      </p>
      <TitleInput value={name} onChange={setName} />

      <div>
        <h3 className="font-semibold">1. The tune: a MIDI or karaoke file</h3>
        <p className="text-sm text-muted">Karaoke files (.kar) are best: they carry the words too. The melody track is picked for you.</p>
        <input type="file" accept=".mid,.midi,.kar,audio/midi" onChange={(e) => e.target.files?.[0] && void loadMidi(e.target.files[0])} className="mt-2 block w-full text-sm" aria-label="MIDI or karaoke file" />
        {imp && song && (
          <div className="mt-2 text-sm">
            <span className="text-good">✓</span> {song.melody.length} melody notes, {imp.bpm} bpm, chords guessed.
            <details className="mt-1">
              <summary className="cursor-pointer text-muted">Wrong tune? Pick another track</summary>
              <div className="mt-2 space-y-2">
                {imp.tracks
                  .filter((t) => t.noteCount > 0 && !t.isDrums)
                  .map((t) => (
                    <label key={t.index} className={`flex min-h-11 items-center gap-3 rounded-2xl border p-2 ${track === t.index ? 'border-spot bg-spot/10' : 'border-line'}`}>
                      <input type="radio" name="track" checked={track === t.index} onChange={() => setTrack(t.index)} className="h-5 w-5 accent-[var(--color-spot)]" />
                      <span>
                        <b>{t.name}</b> <span className="text-muted">· {t.noteCount} notes · {midiToDisplayName(t.lowest)} to {midiToDisplayName(t.highest)}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </details>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold">2. The song's audio (optional)</h3>
        <p className="text-sm text-muted">Sing over the real track. HarmonyLab lines it up with the MIDI by itself.</p>
        <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && void loadAudio(e.target.files[0])} className="mt-2 block w-full text-sm" aria-label="Song audio" />
        {sync && (
          <p className={`mt-2 text-sm ${sync.confidence < 0.25 ? 'text-near' : ''}`}>
            {sync.confidence < 0.25 ? '▲ Synced, but not sure: check it in practice and nudge it in the editor if needed. ' : '✓ Synced. '}
            The song starts {sync.offsetSec.toFixed(1)} s into the track.
          </p>
        )}
      </div>

      <div>
        <h3 className="font-semibold">3. The words (optional)</h3>
        <p className="text-sm text-muted">
          {lyricsFromFile ? '✓ Words found in the file. Fix anything below.' : 'Paste the lyrics, one line per line. Hyphens split syllables (to-ge-ther).'}
        </p>
        <textarea
          value={lyrics}
          onChange={(e) => {
            setLyrics(e.target.value)
            setLyricsFromFile(false)
          }}
          rows={5}
          className="mt-2 w-full rounded-2xl border border-line bg-surface-2 p-3 font-mono text-sm"
          aria-label="Lyrics"
        />
        {check && (
          <p className={`mt-1 text-sm ${check.unusedNotes || check.unusedTokens ? 'text-near' : 'text-good'}`}>
            {check.unusedTokens
              ? `▲ ${check.unusedTokens} more syllables than notes.`
              : check.unusedNotes
                ? `▲ ${check.unusedNotes} notes without words.`
                : '✓ Every note has a syllable.'}
          </p>
        )}
      </div>

      {busy && <p className="text-muted">{busy}</p>}
      {error && (
        <p className="text-near" role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" disabled={!song || !!busy} onClick={() => void save()}>
        Save and sing
      </Button>
    </section>
  )
}

function ManualStart() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [bpm, setBpm] = useState(90)
  const start = async () => {
    const id = await createSong({ title: title.trim() || 'My song', bpm, beatsPerBar: 4, melody: [{ start: 0, dur: 1, midi: 60 }], source: 'manual' })
    navigate(`/songs/${id}`)
  }
  return (
    <section className="space-y-4 rounded-3xl border border-line bg-surface p-5">
      <TitleInput value={title} onChange={setTitle} />
      <label className="block text-sm">
        Tempo: {bpm} bpm
        <input type="range" min={50} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-spot)]" />
      </label>
      <p className="text-sm text-muted">You'll get an empty piano roll: tap to place notes, drag to move them.</p>
      <Button variant="primary" onClick={() => void start()}>
        Open the editor
      </Button>
    </section>
  )
}

function BuiltInPicker() {
  const navigate = useNavigate()
  return (
    <ul className="space-y-3">
      {ALL_BUILT_IN_SONGS.map((s) => (
        <li key={s.id} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
          <span className="flex-1">
            <b>{s.title}</b>
            <span className="block text-sm text-muted">
              {s.vibe} · {s.bpm} bpm
            </span>
          </span>
          <Button
            onClick={async () => {
              const id = await addBuiltInToLibrary(s.id)
              navigate(`/songs/${id}`)
            }}
          >
            Add
          </Button>
        </li>
      ))}
    </ul>
  )
}
