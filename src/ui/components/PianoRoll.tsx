// A simple piano-roll editor. Tap empty space to add a note, drag a note to
// move it, drag its right edge to resize, double-tap (or Delete) to remove.
// Arrow keys nudge the selected note. One note at a time per part.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { isNatural, midiToDisplayName } from '../../music/notes'
import type { Note } from '../../music/types'
import { tidy } from '../../music/edit'

interface Props {
  notes: Note[]
  onChange: (notes: Note[]) => void
  /** Read-only notes drawn behind (e.g. the melody while editing a harmony part). */
  ghost?: Note[]
  lengthBeats: number
  beatsPerBar: number
  /** Current playback position in beats, if playing. */
  playhead?: number | null
  label?: string
}

const KEY_W = 44
const EDGE_PX = 10

export function PianoRoll({ notes, onChange, ghost = [], lengthBeats, beatsPerBar, playhead = null, label }: Props) {
  const [grid, setGrid] = useState(0.5)
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{
    mode: 'move' | 'resize' | 'create'
    index: number
    startBeat: number
    startMidi: number
    orig: Note
    moved: boolean
  } | null>(null)
  const lastTap = useRef<{ index: number; time: number } | null>(null)

  const all = [...notes, ...ghost]
  const lo = Math.min(48, ...all.map((n) => n.midi)) - 3
  const hi = Math.max(72, ...all.map((n) => n.midi)) + 3
  const rows = hi - lo + 1
  const rowH = 18
  const pxPerBeat = 44 * zoom
  const width = KEY_W + Math.max(lengthBeats, beatsPerBar * 4) * pxPerBeat + pxPerBeat * beatsPerBar
  const height = rows * rowH
  const totalBeats = (width - KEY_W) / pxPerBeat

  const toBeat = (x: number) => (x - KEY_W) / pxPerBeat
  const toMidi = (y: number) => hi - Math.floor(y / rowH)
  const snap = (b: number) => Math.max(0, Math.round(b / grid) * grid)

  const point = (e: RPointerEvent | PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const commit = (next: Note[], keepIndexOf?: Note) => {
    const t = tidy(next)
    onChange(t)
    if (keepIndexOf) setSelected(t.findIndex((n) => n.start === keepIndexOf.start && n.midi === keepIndexOf.midi))
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    const { x, y } = point(e)
    if (x < KEY_W) return
    const beat = toBeat(x)
    const midi = toMidi(y)
    const hit = notes.findIndex((n) => n.midi === midi && beat >= n.start && beat < n.start + n.dur)
    svgRef.current!.setPointerCapture(e.pointerId)
    if (hit >= 0) {
      const n = notes[hit]
      // Double-tap deletes.
      const now = performance.now()
      if (lastTap.current && lastTap.current.index === hit && now - lastTap.current.time < 350) {
        lastTap.current = null
        setSelected(null)
        commit(notes.filter((_, i) => i !== hit))
        drag.current = null
        return
      }
      lastTap.current = { index: hit, time: now }
      const nearEdge = KEY_W + (n.start + n.dur) * pxPerBeat - x < EDGE_PX
      setSelected(hit)
      drag.current = { mode: nearEdge ? 'resize' : 'move', index: hit, startBeat: beat, startMidi: midi, orig: n, moved: false }
    } else {
      const n: Note = { start: snap(beat - grid / 2), dur: Math.max(grid, 1), midi }
      const next = [...notes, n]
      onChange(next)
      setSelected(next.length - 1)
      drag.current = { mode: 'create', index: next.length - 1, startBeat: beat, startMidi: midi, orig: n, moved: false }
    }
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const { x, y } = point(e)
    const beat = toBeat(x)
    const midi = toMidi(y)
    const next = [...notes]
    if (d.mode === 'move') {
      const db = snap(d.orig.start + (beat - d.startBeat)) - d.orig.start
      next[d.index] = { ...d.orig, start: d.orig.start + db, midi: Math.max(24, Math.min(96, d.orig.midi + (midi - d.startMidi))) }
    } else {
      const end = Math.max(d.orig.start + grid, snap(beat))
      next[d.index] = { ...d.orig, dur: end - d.orig.start }
    }
    d.moved = true
    onChange(next)
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d) commit(notes, notes[d.index])
  }

  // Keyboard editing of the selected note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected === null || !notes[selected]) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const n = notes[selected]
      let m: Note | null = null
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelected(null)
        return commit(notes.filter((_, i) => i !== selected))
      }
      if (e.key === 'ArrowUp') m = { ...n, midi: n.midi + 1 }
      if (e.key === 'ArrowDown') m = { ...n, midi: n.midi - 1 }
      if (e.key === 'ArrowLeft') m = { ...n, start: Math.max(0, n.start - grid) }
      if (e.key === 'ArrowRight') m = { ...n, start: n.start + grid }
      if (m) {
        e.preventDefault()
        commit(
          notes.map((x, i) => (i === selected ? m! : x)),
          m,
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rowsEls = useMemo(() => {
    const els = []
    for (let i = 0; i < rows; i++) {
      const m = hi - i
      els.push(
        <g key={m}>
          <rect x={KEY_W} y={i * rowH} width={width - KEY_W} height={rowH} fill={isNatural(m) ? '#16161f' : '#111118'} />
          <rect x={0} y={i * rowH} width={KEY_W} height={rowH} fill={isNatural(m) ? '#d9d9e3' : '#2a2a3a'} stroke="#0a0a10" strokeWidth={0.5} />
          {m % 12 === 0 && (
            <text x={4} y={i * rowH + rowH - 5} fontSize={10} fill="#0a0a10" fontWeight={600}>
              {midiToDisplayName(m)}
            </text>
          )}
        </g>,
      )
    }
    return els
  }, [rows, hi, width])

  const beatLines = []
  for (let b = 0; b <= totalBeats; b += grid) {
    const isBar = Math.abs(b % beatsPerBar) < 1e-6
    const isBeat = Math.abs(b % 1) < 1e-6
    beatLines.push(
      <line
        key={b}
        x1={KEY_W + b * pxPerBeat}
        x2={KEY_W + b * pxPerBeat}
        y1={0}
        y2={height}
        stroke={isBar ? '#4a4a60' : isBeat ? '#2a2a3a' : '#1d1d28'}
        strokeWidth={isBar ? 1.5 : 1}
      />,
    )
    if (isBar)
      beatLines.push(
        <text key={`t${b}`} x={KEY_W + b * pxPerBeat + 3} y={11} fontSize={10} fill="#9a9ab2">
          {b / beatsPerBar + 1}
        </text>,
      )
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {label && <span className="mr-2 font-semibold">{label}</span>}
        <label className="flex items-center gap-2">
          Snap
          <select value={grid} onChange={(e) => setGrid(Number(e.target.value))} className="min-h-10 rounded-xl border border-line bg-surface-2 px-2">
            <option value={1}>1 beat</option>
            <option value={0.5}>½ beat</option>
            <option value={0.25}>¼ beat</option>
          </select>
        </label>
        <button className="min-h-10 min-w-10 rounded-xl border border-line bg-surface-2" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="Zoom out">
          −
        </button>
        <button className="min-h-10 min-w-10 rounded-xl border border-line bg-surface-2" onClick={() => setZoom((z) => Math.min(3, z * 1.25))} aria-label="Zoom in">
          +
        </button>
        <button
          className="min-h-10 rounded-xl border border-line bg-surface-2 px-3 disabled:opacity-40"
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return
            commit(notes.filter((_, i) => i !== selected))
            setSelected(null)
          }}
        >
          Delete note
        </button>
        <span className="text-xs text-muted">Tap to add · drag to move · drag the end to resize · double-tap to delete</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-2xl border border-line">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="block touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="application"
          aria-label="Piano roll editor"
        >
          {rowsEls}
          {beatLines}
          {ghost.map((n, i) => (
            <rect
              key={`g${i}`}
              x={KEY_W + n.start * pxPerBeat + 1}
              y={(hi - n.midi) * rowH + 3}
              width={Math.max(3, n.dur * pxPerBeat - 2)}
              height={rowH - 6}
              rx={4}
              fill="#8b93ff44"
              stroke="#8b93ff"
              strokeDasharray="3 3"
            />
          ))}
          {notes.map((n, i) => (
            <g key={i}>
              <rect
                x={KEY_W + n.start * pxPerBeat + 1}
                y={(hi - n.midi) * rowH + 1}
                width={Math.max(4, n.dur * pxPerBeat - 2)}
                height={rowH - 2}
                rx={4}
                fill={i === selected ? '#ffe08a' : '#f5c451'}
                stroke={i === selected ? '#ffffff' : '#0a0a10'}
                strokeWidth={i === selected ? 2 : 1}
              />
              <rect x={KEY_W + (n.start + n.dur) * pxPerBeat - 5} y={(hi - n.midi) * rowH + 4} width={3} height={rowH - 8} rx={1} fill="#0a0a1066" />
            </g>
          ))}
          {playhead !== null && (
            <line x1={KEY_W + playhead * pxPerBeat} x2={KEY_W + playhead * pxPerBeat} y1={0} y2={height} stroke="#ffffff" strokeWidth={2} />
          )}
        </svg>
      </div>
    </div>
  )
}
