// Optional staff notation for a piece: the melody and your part on two staves.
// VexFlow loads only when this is switched on.

import { useEffect, useRef, useState } from 'react'
import type { Note, Piece } from '../../music/types'
import { toBars } from '../../music/staff'

export function StaffView({ piece }: { piece: Piece }) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const VF = await import('vexflow/bravura')
        await document.fonts?.load('30px Bravura').catch(() => undefined)
        if (cancelled || !host.current) return
        const el = host.current
        el.innerHTML = ''
        const width = el.clientWidth || 600
        const bars = Math.min(8, Math.ceil(piece.lengthBeats / piece.beatsPerBar))
        const barWidth = width < 500 ? 170 : 220
        const perLine = Math.max(1, Math.floor((width - 70) / barWidth))
        const lines = Math.ceil(bars / perLine)
        const parts: { notes: Note[]; label: string }[] = [
          { notes: piece.melody, label: 'Melody' },
          { notes: piece.target, label: 'You' },
        ].filter((p) => p.notes.length)
        const lineHeight = 95 * parts.length + 30
        const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG)
        renderer.resize(width, lines * lineHeight + 10)
        const ctx = renderer.getContext()
        ctx.setFillStyle('#ececf3')
        ctx.setStrokeStyle('#ececf3')
        parts.forEach((part, pi) => {
          const avg = part.notes.reduce((s, n) => s + n.midi, 0) / part.notes.length
          const clef = avg >= 57 ? 'treble' : 'bass'
          const barEvents = toBars(part.notes, piece.beatsPerBar, bars)
          barEvents.forEach((events, b) => {
            const line = Math.floor(b / perLine)
            const col = b % perLine
            const first = col === 0
            const x = 10 + (first ? 0 : 60 + col * barWidth)
            const y = line * lineHeight + pi * 95
            const stave = new VF.Stave(x, y, first ? barWidth + 60 : barWidth)
            if (first) stave.addClef(clef).addTimeSignature(`${piece.beatsPerBar}/4`)
            stave.setContext(ctx).draw()
            const notes = events.map((e) => {
              const n = new VF.StaveNote({
                keys: [e.key ?? (clef === 'treble' ? 'b/4' : 'd/3')],
                duration: e.dur + (e.key ? '' : 'r'),
                clef,
              })
              if (e.dot) VF.Dot.buildAndAttach([n], { all: true })
              if (e.acc) n.addModifier(new VF.Accidental(e.acc === '#' ? '#' : 'b'), 0)
              return n
            })
            const voice = new VF.Voice({ numBeats: piece.beatsPerBar, beatValue: 4 }).setMode(VF.Voice.Mode.SOFT)
            voice.addTickables(notes)
            new VF.Formatter().joinVoices([voice]).format([voice], barWidth - 30)
            voice.draw(ctx, stave)
          })
        })
      } catch (e) {
        if (!cancelled) setError(String((e as Error)?.message ?? e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [piece])

  return (
    <section className="mt-4 overflow-x-auto rounded-3xl border border-line bg-surface p-4" aria-label="Staff notation">
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span>Top staff: melody</span>
        <span>Bottom staff: your part</span>
      </div>
      {error ? <p className="text-sm text-bad">Couldn't draw the staff: {error}</p> : <div ref={host} className="staff-view w-full" />}
    </section>
  )
}
