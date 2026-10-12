// Song library, song editor (key, tempo, chords, parts, piano roll, backing
// track) and song practice (loops, slowdown, volumes, guide fading).

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db, type GuideStage, type SongRow } from '../../db/schema'
import { addAttempt } from '../../db/repo'
import { availableParts, PART_LABELS, type PartKind } from '../../music/harmony/generator'
import { inferChords } from '../../music/chordInfer'
import { rankKeys } from '../../music/keyDetect'
import { endOf, parseChordChart } from '../../music/notation'
import { keyName } from '../../music/theory'
import type { Key, Note } from '../../music/types'
import { PieceRunner, type RunOptions } from '../../audio/runner'
import { getAudioContext } from '../../audio/context'
import { addBuiltInToLibrary, analyseBacking, loadBackingBuffer, regenerateParts, saveSong, songLength, songPiece, storeBackingFile } from '../../songs/library'
import { SINGALONG_SONGS } from '../../music/songs'
import { alignLyrics } from '../../music/lyrics'
import { TOLERANCE_CENTS, tierForLevel } from '../../scoring/pitchState'
import type { TakeResult } from '../../scoring/score'
import { rangeOf, useProfile } from '../../state/profile'
import { currentLevel } from '../../db/repo'
import { Button } from '../components/Button'
import { MicGate } from '../components/MicGate'
import { PianoRoll } from '../components/PianoRoll'
import { ResultCard } from '../components/ResultCard'
import { TakeView } from '../components/TakeView'

export function SongsScreen() {
  const songs = useLiveQuery(() => db.songs.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const navigate = useNavigate()
  const singAlong = async (id: string) => {
    const songId = await addBuiltInToLibrary(id)
    navigate(`/songs/${songId}/practice`)
  }
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold">Songs</h1>
        <Link to="/songs/new" className="inline-flex min-h-12 items-center rounded-2xl bg-spot px-5 font-semibold text-stage">
          + Add a song
        </Link>
      </div>

      <section className="mt-5" aria-labelledby="singalong-heading">
        <h2 id="singalong-heading" className="text-lg font-semibold">
          Sing along
        </h2>
        <p className="text-sm text-muted">
          Songs everyone knows, with the words on screen. Sing the tune, then try a harmony. Rounds let you sing the
          second voice.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SINGALONG_SONGS.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => void singAlong(s.id)}
                className="flex h-full min-h-20 w-full items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left hover:border-spot/60"
                data-testid={`singalong-${s.id}`}
              >
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-spot/15 text-xl text-spot">
                  {s.roundOffset ? '⟲' : '♪'}
                </span>
                <span className="flex-1">
                  <b className="block">{s.title}</b>
                  <span className="block text-sm text-muted">{s.vibe}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="text-lg font-semibold">
          Your library
        </h2>
        <p className="text-sm text-muted">
          Your own songs: sing a tune in, or bring a hit with a MIDI file and the song's audio. They stay on this
          device.
        </p>
        {songs.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-line p-8 text-center text-muted">
            Nothing here yet. Tap <b>Add a song</b>, or sing along to one above.
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {songs.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
                <Link to={`/songs/${s.id}`} className="min-w-0 flex-1">
                  <b className="block truncate">{s.title}</b>
                  <span className="block text-sm text-muted">
                    {keyName(s.key)} · {s.bpm} bpm · {Math.round(songLength(s) / s.beatsPerBar)} bars
                    {s.lyricsText ? ' · words' : ''}
                    {s.backing ? ' · audio' : ''}
                  </span>
                </Link>
                <Link to={`/songs/${s.id}/practice`} className="inline-flex min-h-12 items-center rounded-2xl border border-line bg-surface-2 px-4 font-semibold">
                  Practise
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function useSong(): [SongRow | undefined | null, (s: SongRow) => void] {
  const { id } = useParams()
  const song = useLiveQuery(async () => (await db.songs.get(Number(id))) ?? null, [id])
  // Local edits show immediately; the database catches up after a short pause.
  const [draft, setDraft] = useState<SongRow | null>(null)
  const timer = useRef<number | null>(null)
  const update = (s: SongRow) => {
    setDraft(s)
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void saveSong(s), 400)
  }
  if (song === undefined) return [undefined, update]
  if (song === null) return [null, update]
  return [draft && draft.id === song.id ? draft : song, update]
}

export function SongEditScreen() {
  const [song, update] = useSong()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<'melody' | PartKind>('melody')
  const [chartText, setChartText] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const preview = useRef<PieceRunner | null>(null)
  useEffect(() => () => preview.current?.stop(), [])

  if (song === undefined) return <p className="p-6 text-muted">Loading…</p>
  if (song === null) return <p className="p-6">Song not found.</p>

  const length = songLength(song)
  const keys = rankKeys(song.melody, song.chords).slice(0, 3)
  const chart = chartText ?? chordsToChart(song)

  const setMelody = (melody: Note[]) => {
    const next = { ...song, melody }
    update({ ...next, parts: regenerateParts(next) })
  }
  const setPart = (kind: PartKind, notes: Note[]) =>
    update({ ...song, parts: { ...song.parts, [kind]: notes }, editedParts: [...new Set([...song.editedParts, kind])] })
  const setKey = (key: Key) => {
    const next = { ...song, key }
    update({ ...next, parts: regenerateParts(next) })
  }
  const applyChart = (text: string) => {
    setChartText(text)
    try {
      const chords = text.trim() ? parseChordChart(text, song.beatsPerBar) : []
      const next = { ...song, chords }
      update({ ...next, parts: regenerateParts(next) })
    } catch {
      /* keep typing */
    }
  }
  const guessChords = () => {
    const chords = inferChords(song.melody, song.key, song.beatsPerBar, length)
    const next = { ...song, chords }
    setChartText(null)
    update({ ...next, parts: regenerateParts(next) })
  }

  const play = async () => {
    preview.current?.stop()
    const part = editing === 'melody' ? song.selectedPart : editing
    const piece = songPiece(song, part, null)
    const buffer = song.backing ? await loadBackingBuffer(song.backing.fileId) : null
    const r = new PieceRunner({
      piece,
      stage: 0,
      countInBeats: 0,
      backing: buffer && song.backing ? { buffer, offsetSec: song.backing.offsetSec, volume: 0.8 } : null,
      onEnd: () => setPlayhead(null),
    })
    preview.current = r
    await r.start()
    const tick = () => {
      if (r.isStopped) return setPlayhead(null)
      setPlayhead(Math.max(0, (getAudioContext().currentTime - r.startSec) / r.spb))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const editingNotes = editing === 'melody' ? song.melody : song.parts[editing] ?? []
  const parts = availableParts(song.chords.length > 0, !!song.roundOffset)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Link to="/songs" className="mt-3 inline-block text-sm text-muted hover:text-ink">
        ← Songs
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          value={song.title}
          onChange={(e) => update({ ...song, title: e.target.value })}
          className="min-h-12 w-0 min-w-0 flex-1 rounded-2xl border border-transparent bg-transparent px-2 text-2xl font-bold hover:border-line focus:border-line"
          aria-label="Song title"
        />
        <Button variant="primary" onClick={() => navigate(`/songs/${song.id}/practice`)}>
          Practise
        </Button>
      </div>

      <section className="mt-4 grid gap-4 rounded-3xl border border-line bg-surface p-5 md:grid-cols-3">
        <label className="block text-sm">
          <span className="text-muted">Key (best guesses first)</span>
          <select
            className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-3"
            value={`${song.key.tonic}-${song.key.mode}`}
            onChange={(e) => {
              const [t, m] = e.target.value.split('-')
              setKey({ tonic: Number(t), mode: m as Key['mode'] })
            }}
          >
            {[...keys.map((k) => k.key), ...allKeys()]
              .filter((k, i, a) => a.findIndex((x) => x.tonic === k.tonic && x.mode === k.mode) === i)
              .map((k, i) => (
                <option key={`${k.tonic}-${k.mode}`} value={`${k.tonic}-${k.mode}`}>
                  {keyName(k)}
                  {i === 0 ? ' (suggested)' : ''}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Tempo: {song.bpm} bpm</span>
          <input type="range" min={40} max={200} value={song.bpm} onChange={(e) => update({ ...song, bpm: Number(e.target.value) })} className="mt-3 w-full accent-[var(--color-spot)]" />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Beats per bar</span>
          <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-3" value={song.beatsPerBar} onChange={(e) => update({ ...song, beatsPerBar: Number(e.target.value) })}>
            {[2, 3, 4, 6].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-3">
          <span className="text-muted">
            Chords, one bar each between bars ( | ). Two chords in a bar share it. Chords let HarmonyLab write a
            chord-aware part.
          </span>
          <div className="mt-1 flex gap-2">
            <input
              value={chart}
              onChange={(e) => applyChart(e.target.value)}
              placeholder="C | G | Am | F"
              className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-3 font-mono"
            />
            <Button onClick={guessChords}>Guess</Button>
          </div>
        </label>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-surface p-5">
        <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Editing</span>
          <select
            value={editing}
            onChange={(e) => setEditing(e.target.value as 'melody' | PartKind)}
            className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-3 text-base sm:flex-none"
            aria-label="Which part to edit"
          >
            <option value="melody">Melody</option>
            {parts.map((p) => (
              <option key={p} value={p}>
                Harmony: {PART_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button onClick={() => void (playhead === null ? play() : (preview.current?.stop(), setPlayhead(null)))}>{playhead === null ? '▶ Play' : '■ Stop'}</Button>
          {editing !== 'melody' && song.editedParts.includes(editing) && (
            <Button
              onClick={() => {
                const next = { ...song, editedParts: song.editedParts.filter((p) => p !== editing) }
                update({ ...next, parts: regenerateParts(next) })
              }}
            >
              Reset to generated
            </Button>
          )}
        </div>
        <PianoRoll
          label={editing === 'melody' ? 'Melody' : PART_LABELS[editing]}
          notes={editingNotes}
          ghost={editing === 'melody' ? [] : song.melody}
          onChange={(n) => (editing === 'melody' ? setMelody(n) : setPart(editing, n))}
          lengthBeats={Math.max(length, endOf(editingNotes))}
          beatsPerBar={song.beatsPerBar}
          playhead={playhead}
        />
      </section>

      <LyricsSection song={song} update={update} />

      <BackingSection song={song} update={update} />

      <div className="mt-6">
        <Button
          variant="ghost"
          onClick={async () => {
            if (!confirm(`Delete "${song.title}"? This can't be undone.`)) return
            await db.songs.delete(song.id!)
            navigate('/songs')
          }}
        >
          Delete song
        </Button>
      </div>
    </div>
  )
}

function allKeys(): Key[] {
  const out: Key[] = []
  for (let t = 0; t < 12; t++) out.push({ tonic: t, mode: 'major' }, { tonic: t, mode: 'minor' })
  return out
}

function chordsToChart(song: SongRow): string {
  const bars: string[][] = []
  for (const c of song.chords) {
    const bar = Math.floor(c.start / song.beatsPerBar + 1e-6)
    ;(bars[bar] ??= []).push(c.symbol)
  }
  return Array.from({ length: bars.length }, (_, i) => (bars[i] ?? ['C']).join(' ')).join(' | ')
}

function LyricsSection({ song, update }: { song: SongRow; update: (s: SongRow) => void }) {
  const text = song.lyricsText ?? ''
  const check = text.trim() ? alignLyrics(song.melody, text) : null
  return (
    <section className="mt-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-semibold">Words (optional)</h2>
      <p className="mt-1 text-sm text-muted">
        Paste the lyrics to see them while you sing. One line of the song per line here. Split words into
        syllables with a hyphen (<code>to-ge-ther</code>) so each note gets one; use <code>_</code> to hold a syllable
        over an extra note.
      </p>
      <textarea
        value={text}
        onChange={(e) => update({ ...song, lyricsText: e.target.value })}
        rows={5}
        placeholder={'Twin-kle twin-kle lit-tle star\nhow I won-der what you are'}
        className="mt-3 w-full rounded-2xl border border-line bg-surface-2 p-3 font-mono text-sm"
        aria-label="Lyrics"
      />
      {check && (
        <p className={`mt-2 text-sm ${check.unusedNotes || check.unusedTokens ? 'text-near' : 'text-good'}`} role="status">
          {check.unusedTokens
            ? `▲ ${check.unusedTokens} syllable${check.unusedTokens > 1 ? 's' : ''} more than the tune has notes. Join some with "_" or check the hyphens.`
            : check.unusedNotes
              ? `▲ ${check.unusedNotes} note${check.unusedNotes > 1 ? 's' : ''} at the end have no words yet.`
              : `✓ Every note has its syllable (${check.lines.length} lines).`}
        </p>
      )}
    </section>
  )
}

function BackingSection({ song, update }: { song: SongRow; update: (s: SongRow) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async (f: File) => {
    setBusy(true)
    setError(null)
    try {
      const fileId = await storeBackingFile(f)
      const buffer = await loadBackingBuffer(fileId)
      if (!buffer) throw new Error('decode')
      const info = analyseBacking(buffer, song.beatsPerBar)
      // Line beat 0 of the song up with the first downbeat; the tempo follows the track.
      update({
        ...song,
        bpm: Math.round(info.bpm),
        backing: { fileId, name: f.name, offsetSec: info.downbeatSec, bpmDetected: info.bpm, confidence: info.confidence },
      })
    } catch {
      setError("Couldn't read that audio file. Try an MP3, WAV or M4A.")
    }
    setBusy(false)
  }
  const nudge = (beats: number, ms = 0) => {
    if (!song.backing) return
    update({ ...song, backing: { ...song.backing, offsetSec: Math.max(0, song.backing.offsetSec + (beats * 60) / song.bpm + ms / 1000) } })
  }
  return (
    <section className="mt-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-semibold">Backing track (optional)</h2>
      <p className="mt-1 text-sm text-muted">
        Load the song's audio to sing over. HarmonyLab finds its tempo and beat and lines it up for you. It never
        tries to pull the melody out of the audio. With a backing track the song stays in its original key.
      </p>
      {song.backing ? (
        <div className="mt-3 space-y-3">
          <p>
            <b>{song.backing.name}</b> · {song.backing.bpmDetected?.toFixed(1)} bpm detected
            {song.backing.confidence !== null && song.backing.confidence < 0.3 && <span className="text-near"> · beat unclear, check the sync</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Sync off? Nudge:</span>
            <Button onClick={() => nudge(-song.beatsPerBar)}>− bar</Button>
            <Button onClick={() => nudge(-1)}>− beat</Button>
            <Button onClick={() => nudge(0, -20)}>−20 ms</Button>
            <Button onClick={() => nudge(0, 20)}>+20 ms</Button>
            <Button onClick={() => nudge(1)}>+ beat</Button>
            <Button onClick={() => nudge(song.beatsPerBar)}>+ bar</Button>
          </div>
          <Button variant="ghost" onClick={() => update({ ...song, backing: null })}>
            Remove backing track
          </Button>
        </div>
      ) : (
        <label className="mt-3 block text-sm">
          <input type="file" accept="audio/*" disabled={busy} onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} className="block w-full" />
        </label>
      )}
      {busy && <p className="mt-2 text-muted">Finding the beat…</p>}
      {error && (
        <p className="mt-2 text-near" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export function SongPracticeScreen() {
  const [song, update] = useSong()
  const profile = useProfile((s) => s.profile)
  const [stage, setStage] = useState<GuideStage>(0)
  const [result, setResult] = useState<TakeResult | null>(null)
  const [fromBar, setFromBar] = useState(1)
  const [toBar, setToBar] = useState<number | null>(null)
  const [level, setLevel] = useState(1)
  const [loadedBacking, setBacking] = useState<RunOptions['backing']>(null)
  useEffect(() => {
    void currentLevel().then(setLevel)
  }, [])
  useEffect(() => {
    if (!song?.backing) return
    void loadBackingBuffer(song.backing.fileId).then((b) => setBacking(b ? { buffer: b, offsetSec: song.backing!.offsetSec, volume: 0.8 } : null))
  }, [song?.backing])
  const backing = song?.backing ? loadedBacking : null
  const range = rangeOf(profile)
  const piece = useMemo(() => (song ? songPiece(song, song.selectedPart, range) : null), [song, range.low, range.high]) // eslint-disable-line react-hooks/exhaustive-deps

  if (song === undefined) return <p className="p-6 text-muted">Loading…</p>
  if (song === null || !piece) return <p className="p-6">Song not found.</p>
  const bars = Math.ceil(piece.lengthBeats / piece.beatsPerBar)
  const lastBar = toBar ?? bars
  const loop = { startBeat: (fromBar - 1) * piece.beatsPerBar, endBeat: lastBar * piece.beatsPerBar }
  const parts: PartKind[] = ['melody', ...availableParts(song.chords.length > 0, !!song.roundOffset)]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Link to={`/songs/${song.id}`} className="mt-3 inline-block text-sm text-muted hover:text-ink">
        ← Edit {song.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{song.title}</h1>
      <div className="my-4 grid gap-4 rounded-3xl border border-line bg-surface p-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Your part</span>
          <select
            value={song.selectedPart}
            onChange={(e) => update({ ...song, selectedPart: e.target.value as PartKind })}
            className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-3"
          >
            {parts.map((p) => (
              <option key={p} value={p}>
                {PART_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="text-muted">Loop bars</span>
          <div className="mt-1 flex items-center gap-2">
            <select value={fromBar} onChange={(e) => setFromBar(Number(e.target.value))} className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-3" aria-label="From bar">
              {Array.from({ length: bars }, (_, i) => (
                <option key={i} value={i + 1} disabled={i + 1 > lastBar}>
                  Bar {i + 1}
                </option>
              ))}
            </select>
            <span>to</span>
            <select value={lastBar} onChange={(e) => setToBar(Number(e.target.value))} className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-3" aria-label="To bar">
              {Array.from({ length: bars }, (_, i) => (
                <option key={i} value={i + 1} disabled={i + 1 < fromBar}>
                  Bar {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <MicGate>
        <TakeView
          key={`${song.selectedPart}-${fromBar}-${lastBar}`}
          piece={piece}
          toleranceCents={TOLERANCE_CENTS[tierForLevel(level)]}
          stage={stage}
          onStageChange={setStage}
          stageControl
          tempoControl
          autoFade
          loop={loop}
          backing={backing}
          onResult={(r, info) => {
            setResult(r)
            void addAttempt({
              kind: 'song',
              exerciseId: `song-${song.id}`,
              title: `${song.title} (${PART_LABELS[song.selectedPart]})`,
              score: r.percentInTune,
              avgCents: r.averageCentsOff,
              seconds: info.seconds,
              stage: info.stage,
            })
          }}
        />
        {result && <ResultCard result={result} heading="Last pass" />}
      </MicGate>
    </div>
  )
}
