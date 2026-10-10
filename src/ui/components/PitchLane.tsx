// The hero of every practice screen. Time runs right to left: the voice line
// is drawn up to the "now" line, upcoming target notes scroll in from the
// right. Drawn on a canvas straight from the engine's buffer every display
// frame, outside React, so nothing waits on a re-render.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { pitchEngine } from '../../audio/pitchEngine'
import { centsOff, isNatural, midiToDisplayName } from '../../music/notes'
import { classify, type PitchState } from '../../scoring/pitchState'
import { laneStats } from './laneStats'

export interface LaneTarget {
  /** Audio-clock seconds. Use -Infinity / Infinity for open-ended notes. */
  start: number
  end: number
  midi: number
  /** harmony: the singer's part. melody: other parts (faint). cue: a reference note to listen to. */
  kind: 'harmony' | 'melody' | 'cue'
}

interface Props {
  /** Called every frame; return the targets to draw. */
  getTargets: () => LaneTarget[]
  toleranceCents: number
  pastSeconds?: number
  /** Measured latency: the voice line is drawn this much earlier so it lines up with the bars. */
  voiceDelaySec?: number
  className?: string
}

const COLOURS = {
  background: '#111119',
  grid: '#ffffff10',
  gridNatural: '#ffffff1c',
  label: '#9a9ab2',
  now: '#ffffff40',
  spot: '#f5c451',
  spotFill: '#f5c45130',
  melody: '#8b93ff',
  melodyFill: '#8b93ff1f',
  neutral: '#ececf3',
  inTune: '#4ade9a',
  slightlyOff: '#f5b84a',
  off: '#f2557a',
}

const STYLE: Record<PitchState | 'none', { colour: string; width: number; dash: number[] }> = {
  inTune: { colour: COLOURS.inTune, width: 5, dash: [] },
  slightlyOff: { colour: COLOURS.slightlyOff, width: 3.5, dash: [] },
  off: { colour: COLOURS.off, width: 2.5, dash: [7, 6] },
  none: { colour: COLOURS.neutral, width: 3, dash: [] },
}

function activeHarmony(targets: LaneTarget[], t: number): LaneTarget | undefined {
  return targets.find((x) => x.kind === 'harmony' && x.start <= t && t < x.end)
}

export function PitchLane({ getTargets, toleranceCents, pastSeconds = 4, voiceDelaySec = 0, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ getTargets, toleranceCents, pastSeconds, voiceDelaySec })
  useLayoutEffect(() => {
    propsRef.current = { getTargets, toleranceCents, pastSeconds, voiceDelaySec }
  })

  useEffect(() => {
    const canvas = canvasRef.current!
    // Plain 2D context. The low-latency (desynchronized) mode left the canvas
    // blank on Chrome for Windows, and only saved one frame where it worked.
    const g = canvas.getContext('2d', { alpha: false })!
    let raf = 0
    let lastFrame = 0
    let span = 12
    let centre = 60
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      laneStats.resizes++
      laneStats.dpr = dpr
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      if (lastFrame) pitchEngine.noteDrawInterval(ts - lastFrame)
      lastFrame = ts
      try {
        // Belt and braces: if layout changed without a resize event (or the
        // first measurement came back empty), fix the backing size now.
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        const rect = canvas.getBoundingClientRect()
        if (
          Math.abs(rect.width - width) > 0.5 ||
          Math.abs(rect.height - height) > 0.5 ||
          canvas.width !== Math.max(1, Math.round(rect.width * dpr))
        ) {
          resize()
        }
        laneStats.cssWidth = width
        laneStats.cssHeight = height
        laneStats.pixelWidth = canvas.width
        laneStats.pixelHeight = canvas.height
        if (!Number.isFinite(centre)) centre = 60
        if (!Number.isFinite(span)) span = 12
        drawFrame()
        laneStats.framesDrawn++
      } catch (err) {
        laneStats.lastError = String((err as Error)?.stack ?? err).slice(0, 300)
      }
    }

    const drawFrame = () => {
      const { getTargets, toleranceCents, pastSeconds, voiceDelaySec } = propsRef.current
      const targets = getTargets()
      const now = pitchEngine.displayNow() - voiceDelaySec
      const nowX = Math.round(width * (width < 500 ? 0.78 : 0.72))
      const pps = nowX / pastSeconds
      const xOf = (t: number) => nowX + (t - now) * pps
      const since = now - pastSeconds - 0.2

      // Vertical framing: centre on the current target, widen to keep the voice in view.
      const focus = activeHarmony(targets, now) ?? targets.find((x) => x.kind === 'harmony')
      const centreTarget = focus?.midi ?? pitchEngine.latest?.midi ?? centre
      centre += (centreTarget - centre) * 0.12
      let maxDev = 0
      pitchEngine.forEachSince(since + voiceDelaySec, (_t, m) => {
        if (m === m) maxDev = Math.max(maxDev, Math.abs(m - centre))
      })
      // Keep every part on screen too: the drone or melody can sit a fifth or more away.
      const viewEnd = now + (width - nowX) / pps
      for (const t of targets) {
        if (t.end >= since && t.start <= viewEnd) maxDev = Math.max(maxDev, Math.abs(t.midi - centre))
      }
      const spanTarget = Math.min(30, Math.max(11, maxDev * 2 + 3))
      span += (spanTarget - span) * 0.08
      const semitonePx = height / span
      const yOf = (m: number) => height / 2 - (m - centre) * semitonePx

      g.fillStyle = COLOURS.background
      g.fillRect(0, 0, width, height)

      // Semitone grid with note names on natural notes.
      g.font = '11px ui-sans-serif, system-ui, sans-serif'
      g.textBaseline = 'middle'
      const lo = Math.floor(centre - span / 2) - 1
      const hi = Math.ceil(centre + span / 2) + 1
      for (let m = lo; m <= hi; m++) {
        const y = Math.round(yOf(m)) + 0.5
        const natural = isNatural(m)
        g.strokeStyle = natural ? COLOURS.gridNatural : COLOURS.grid
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(width, y)
        g.stroke()
        if (natural && semitonePx > 9) {
          g.fillStyle = COLOURS.label
          g.fillText(midiToDisplayName(m), 6, y)
        }
      }

      // Target bars. Band height = the in-tune tolerance.
      const bandPx = Math.max(6, (toleranceCents / 100) * semitonePx * 2)
      for (const target of targets) {
        const x0 = Math.max(0, xOf(target.start))
        const x1 = Math.min(width, xOf(target.end))
        if (x1 <= x0) continue
        const y = yOf(target.midi)
        const harmony = target.kind !== 'melody'
        const cue = target.kind === 'cue'
        g.fillStyle = harmony ? COLOURS.spotFill : COLOURS.melodyFill
        g.globalAlpha = cue ? 0.5 : 1
        roundRect(g, x0, y - bandPx / 2, x1 - x0, bandPx, Math.min(6, bandPx / 2))
        g.fill()
        g.strokeStyle = harmony ? COLOURS.spot : COLOURS.melody
        g.globalAlpha = harmony && !cue ? 0.9 : 0.55
        g.lineWidth = harmony ? 2 : 1.5
        g.setLineDash(harmony && !cue ? [] : [4, 4])
        g.beginPath()
        g.moveTo(x0, y)
        g.lineTo(x1, y)
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
        g.fillStyle = harmony ? COLOURS.spot : COLOURS.melody
        g.font = harmony && !cue ? '600 13px ui-sans-serif, system-ui, sans-serif' : '12px ui-sans-serif, system-ui, sans-serif'
        const label = `${midiToDisplayName(target.midi)}  ${cue ? 'listen' : harmony ? 'you' : 'melody'}`
        // Current and upcoming bars are labelled just past the now line;
        // finished bars at their start, only if the label fits.
        const textW = g.measureText(label).width
        const lx = x1 > nowX ? Math.min(Math.max(x0 + 8, nowX + 14), width - textW - 8) : x0 + 8
        if (lx + textW <= x1) g.fillText(label, lx, y - bandPx / 2 - 9)
      }

      // Now line.
      g.strokeStyle = COLOURS.now
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(nowX + 0.5, 0)
      g.lineTo(nowX + 0.5, height)
      g.stroke()

      // Voice line. Broken across silence and big jumps; styled by state so
      // it reads without colour: thick solid, medium solid, thin dashed.
      let prevT = NaN
      let prevM = NaN
      let pathState: PitchState | 'none' | null = null
      const flush = () => {
        if (pathState) g.stroke()
        pathState = null
      }
      const stateAt = (t: number, m: number): PitchState | 'none' => {
        const target = activeHarmony(targets, t)
        return target ? classify(centsOff(m, target.midi), toleranceCents).state : 'none'
      }
      g.lineCap = 'round'
      g.lineJoin = 'round'
      pitchEngine.forEachSince(since + voiceDelaySec, (rawT, m) => {
        const t = rawT - voiceDelaySec
        const voiced = m === m
        if (voiced && prevM === prevM && t - prevT < 0.05 && Math.abs(m - prevM) < 1.5) {
          const s = stateAt(t, m)
          if (s !== pathState) {
            flush()
            const st = STYLE[s]
            g.strokeStyle = st.colour
            g.lineWidth = st.width
            g.setLineDash(st.dash)
            g.beginPath()
            g.moveTo(xOf(prevT), yOf(prevM))
            pathState = s
          }
          g.lineTo(xOf(t), yOf(m))
        } else {
          flush()
        }
        prevT = t
        prevM = voiced ? m : NaN
      })
      flush()
      g.setLineDash([])

      // Head marker at the newest reading: tick when in tune, a triangle
      // pointing the way to move otherwise (filled = close, outline = off).
      const latest = pitchEngine.latest
      if (latest && latest.midi !== null && now - (latest.t - voiceDelaySec) < 0.15) {
        const lt = latest.t - voiceDelaySec
        const x = xOf(lt)
        const y = yOf(latest.midi)
        const target = activeHarmony(targets, lt)
        const c = target ? classify(centsOff(latest.midi, target.midi), toleranceCents) : null
        drawHead(g, x, y, c?.state ?? 'none', c?.direction ?? null)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Pitch lane: your voice drawn as a line against the target note"
    />
  )
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function drawHead(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PitchState | 'none',
  direction: 'sharp' | 'flat' | null,
) {
  const colour = STYLE[state].colour
  g.lineWidth = 2.5
  if (state === 'inTune' || state === 'none') {
    g.fillStyle = colour
    g.beginPath()
    g.arc(x, y, 9, 0, Math.PI * 2)
    g.fill()
    if (state === 'inTune') {
      g.strokeStyle = '#0a0a10'
      g.beginPath()
      g.moveTo(x - 4, y)
      g.lineTo(x - 1, y + 3.5)
      g.lineTo(x + 4.5, y - 3.5)
      g.stroke()
    }
    return
  }
  // Sharp (too high) points down, flat (too low) points up: the way to move.
  const dir = direction === 'sharp' ? 1 : -1
  g.beginPath()
  g.moveTo(x, y + 10 * dir)
  g.lineTo(x - 9, y - 7 * dir)
  g.lineTo(x + 9, y - 7 * dir)
  g.closePath()
  if (state === 'slightlyOff') {
    g.fillStyle = colour
    g.fill()
  } else {
    g.fillStyle = '#0a0a10'
    g.fill()
    g.strokeStyle = colour
    g.stroke()
  }
}
