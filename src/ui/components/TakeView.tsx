// The shared practice surface: pitch lane, live readout, transport and guide
// controls. Used by curriculum drills, placement, songs and daily sessions.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PieceRunner, STAGE_LABELS, type RunOptions } from '../../audio/runner'
import { FrameRecorder } from '../../audio/checks'
import { pitchEngine } from '../../audio/pitchEngine'
import { scoreTake, type TakeResult } from '../../scoring/score'
import { slidToMelody } from '../../scoring/drift'
import { centsOff, midiToDisplayName } from '../../music/notes'
import { classify } from '../../scoring/pitchState'
import type { Piece } from '../../music/types'
import type { GuideStage } from '../../db/schema'
import { useProfile, latencySecOf } from '../../state/profile'
import { useSettings } from '../../state/settings'
import { Button, Segmented } from './Button'
import { PitchLane, type LaneTarget } from './PitchLane'
import { useLive } from './useLive'
import { StaffView } from './StaffView'

export interface TakeViewProps {
  piece: Piece
  toleranceCents: number
  stage: GuideStage
  onStageChange?: (s: GuideStage) => void
  /** Show the Full/Half/Quiet/Off selector. */
  stageControl?: boolean
  /** Song practice extras. */
  tempoControl?: boolean
  loop?: { startBeat: number; endBeat: number } | null
  /** Loop passes fade the guide automatically when a pass scores well. */
  autoFade?: boolean
  backing?: RunOptions['backing']
  /** Called once per finished take (or per loop pass). */
  onResult?: (result: TakeResult, info: { stage: GuideStage; seconds: number; pass: number }) => void
  /** Extra controls under the transport. */
  children?: ReactNode
  /** Start automatically once mounted (used by placement). */
  autoStart?: boolean
  /** Hide the demo button. */
  noDemo?: boolean
  compact?: boolean
}

type RunState = 'idle' | 'demo' | 'take'

export function TakeView(props: TakeViewProps) {
  const { piece, toleranceCents, stage } = props
  const profile = useProfile((s) => s.profile)
  const showStaff = useSettings((s) => s.showStaff)
  const updateSettings = useSettings((s) => s.update)
  const latency = latencySecOf(profile)
  const [run, setRun] = useState<RunState>('idle')
  const [melodyVol, setMelodyVol] = useState(0.8)
  const [guideVol, setGuideVol] = useState(0.9)
  const [tempo, setTempo] = useState(1)
  const [click, setClick] = useState(false)
  const [passScore, setPassScore] = useState<number | null>(null)
  const runner = useRef<PieceRunner | null>(null)
  const recorder = useRef<FrameRecorder | null>(null)
  const stageRef = useRef(stage)
  useEffect(() => {
    stageRef.current = stage
  }, [stage])
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })

  const stop = useCallback(() => {
    runner.current?.stop()
    runner.current = null
    recorder.current?.stop()
    recorder.current = null
    setRun('idle')
  }, [])
  useEffect(() => stop, [stop])

  const scorePass = useCallback(
    (frames: { t: number; midi: number | null }[], targets: { startSec: number; endSec: number; midi: number }[], melody: { startSec: number; endSec: number; midi: number }[]) =>
      scoreTake({ frames, targets, melody, toleranceCents, latencySec: latency }),
    [toleranceCents, latency],
  )

  const start = useCallback(
    async (mode: 'demo' | 'take') => {
      stop()
      setPassScore(null)
      const p = propsRef.current
      const r = new PieceRunner({
        piece: p.piece,
        stage: mode === 'demo' ? 0 : p.stage,
        stageForPass: mode === 'take' && p.loop ? () => stageRef.current : undefined,
        melodyVolume: melodyVol,
        guideVolume: guideVol,
        tempo,
        click,
        loop: mode === 'take' ? p.loop : null,
        backing: p.backing,
        onPassEnd: (pass) => {
          if (mode !== 'take' || !recorder.current || !runner.current) return
          const ps = runner.current.passes[pass]
          const frames = recorder.current.frames.filter((f) => f.t >= ps.startSec - 0.2 && f.t <= ps.endSec + 0.6)
          const result = scorePass(frames, ps.targets, ps.melody)
          setPassScore(result.percentInTune)
          propsRef.current.onResult?.(result, { stage: ps.stage, seconds: ps.endSec - ps.startSec, pass })
          // Auto-fade: a good pass moves the guide down a stage for the next one.
          if (propsRef.current.autoFade && result.percentInTune >= 70 && stageRef.current < 3) {
            const next = (stageRef.current + 1) as GuideStage
            stageRef.current = next
            propsRef.current.onStageChange?.(next)
          }
        },
        onEnd: () => {
          runner.current = null
          recorder.current?.stop()
          recorder.current = null
          setRun('idle')
        },
      })
      runner.current = r
      if (mode === 'take') recorder.current = new FrameRecorder()
      setRun(mode)
      await r.start()
    },
    [stop, melodyVol, guideVol, tempo, click, scorePass],
  )

  // Placement: start on mount.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (props.autoStart && !autoStarted.current && pitchEngine.isRunning()) {
      autoStarted.current = true
      void start('take')
    }
  }, [props.autoStart, start])

  // Before starting, preview the opening bars just past the now line.
  const preview = useRef<LaneTarget[]>([])
  const getTargets = useCallback((): LaneTarget[] => {
    if (runner.current) return runner.current.laneTargets
    const now = pitchEngine.displayNow() - latency + 1.2
    const spb = 60 / piece.bpm
    preview.current = [
      ...piece.melody.map((n) => ({ start: now + n.start * spb, end: now + (n.start + n.dur) * spb, midi: n.midi, kind: 'melody' as const })),
      ...(piece.others ?? []).flat().map((n) => ({ start: now + n.start * spb, end: now + (n.start + n.dur) * spb, midi: n.midi, kind: 'melody' as const })),
      ...(piece.cues ?? []).map((n) => ({ start: now + n.start * spb, end: now + (n.start + n.dur) * spb, midi: n.midi, kind: 'cue' as const })),
      ...piece.target.map((n) => ({ start: now + n.start * spb, end: now + (n.start + n.dur) * spb, midi: n.midi, kind: 'harmony' as const })),
    ]
    return preview.current
  }, [piece, latency])

  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface/70 shadow-2xl">
        <PitchLane
          getTargets={getTargets}
          toleranceCents={toleranceCents}
          voiceDelaySec={latency}
          className={`block w-full touch-none ${props.compact ? 'h-[38vh] min-h-56' : 'h-[46vh] min-h-64'}`}
        />
      </div>

      <TakeReadout runner={runner} toleranceCents={toleranceCents} latency={latency} running={run !== 'idle'} demo={run === 'demo'} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {run === 'idle' ? (
          <>
            <Button variant="primary" className="min-w-40" onClick={() => void start('take')} data-testid="start-take">
              {props.loop ? 'Start looping' : 'Start'}
            </Button>
            {!props.noDemo && <Button onClick={() => void start('demo')}>Hear a demo</Button>}
          </>
        ) : (
          <Button variant="primary" className="min-w-40" onClick={stop}>
            Stop
          </Button>
        )}
        {passScore !== null && run === 'take' && props.loop && (
          <span className="rounded-xl bg-surface-2 px-3 py-2 text-sm tabular-nums">Last pass: {Math.round(passScore)}%</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {props.stageControl && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-muted">Guide (your note played for you)</div>
            <Segmented<string>
              label="Guide volume stage"
              value={String(stage)}
              onChange={(v) => props.onStageChange?.(Number(v) as GuideStage)}
              options={([0, 1, 2, 3] as GuideStage[]).map((s) => ({ value: String(s), label: STAGE_LABELS[s] }))}
            />
            <p className="mt-2 text-xs text-muted">
              The guide fades as you improve. Passing needs 80% in tune with the guide off.
              {props.autoFade && ' When looping, a pass over 70% fades it one stage automatically.'}
            </p>
          </div>
        )}
        <div className="space-y-3">
          <Slider label="Melody volume" value={melodyVol} onChange={setMelodyVol} disabled={run !== 'idle'} />
          <Slider label="Guide volume" value={guideVol} onChange={setGuideVol} disabled={run !== 'idle'} />
          {props.tempoControl && (
            <Slider
              label={`Tempo ${Math.round(tempo * 100)}%`}
              value={tempo}
              min={0.5}
              max={1}
              step={0.05}
              onChange={setTempo}
              disabled={run !== 'idle'}
            />
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={click} onChange={(e) => setClick(e.target.checked)} disabled={run !== 'idle'} className="h-5 w-5 accent-[var(--color-spot)]" />
            Click track
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={showStaff} onChange={(e) => updateSettings({ showStaff: e.target.checked })} className="h-5 w-5 accent-[var(--color-spot)]" />
            Show staff notation
          </label>
        </div>
      </div>
      {showStaff && <StaffView piece={piece} />}
      {props.children}
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <label className="block text-sm">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-spot)] disabled:opacity-50"
      />
    </label>
  )
}

/** Live words under the lane during a take: your note, how close, and melody slides. */
function TakeReadout({
  runner,
  toleranceCents,
  latency,
  running,
  demo,
}: {
  runner: React.RefObject<PieceRunner | null>
  toleranceCents: number
  latency: number
  running: boolean
  demo: boolean
}) {
  const view = useLive(() => {
    const r = runner.current
    const now = pitchEngine.displayNow() - latency
    if (!r) return { kind: 'idle' as const }
    if (now < r.startSec) return { kind: 'countin' as const, beats: Math.ceil((r.startSec - now) / r.spb) }
    const pass = r.passes.find((p) => p.startSec <= now && now < p.endSec) ?? r.passes[r.passes.length - 1]
    const target = pass?.targets.find((t) => t.startSec <= now && now < t.endSec)
    const next = pass?.targets.find((t) => t.startSec > now)
    const mel = pass?.melody.find((t) => t.startSec <= now && now < t.endSec)
    const f = pitchEngine.latest
    const singing = f && f.midi !== null && pitchEngine.displayNow() - f.t < 0.2 ? f.midi : null
    if (!target) return { kind: 'gap' as const, next: next?.midi ?? null }
    const slid = slidToMelody(pitchEngine.recent(50), target.midi, mel?.midi ?? null, toleranceCents)
    return { kind: 'note' as const, target: target.midi, singing, slid }
  }, 12)

  if (!running) return <div className="min-h-20" />
  if (demo) return <Line text="Demo: listen to how it goes. Sing along if you like." />
  if (view.kind === 'countin') return <Line text={`Get ready… ${view.beats}`} big />
  if (view.kind === 'gap' || view.kind === 'idle') {
    return <Line text={view.kind === 'gap' && view.next !== null ? `Breathe. Next: ${midiToDisplayName(view.next)}` : 'Breathe.'} />
  }
  if (view.slid) {
    return (
      <div className="flex min-h-20 items-center justify-center gap-3 text-xl font-bold text-bad" role="status" data-testid="slid">
        <span aria-hidden>⇄</span> You slid to the melody. Find {midiToDisplayName(view.target)} again.
      </div>
    )
  }
  if (view.singing === null) return <Line text={`Your note: ${midiToDisplayName(view.target)}`} />
  const c = classify(centsOff(view.singing, view.target), toleranceCents)
  const label =
    c.state === 'inTune'
      ? { icon: '✓', text: 'In tune', cls: 'text-good' }
      : c.direction === 'sharp'
        ? { icon: c.state === 'off' ? '▼▼' : '▼', text: c.state === 'off' ? 'Too high' : 'A little high', cls: c.state === 'off' ? 'text-bad' : 'text-near' }
        : { icon: c.state === 'off' ? '▲▲' : '▲', text: c.state === 'off' ? 'Too low' : 'A little low', cls: c.state === 'off' ? 'text-bad' : 'text-near' }
  return (
    <div className="flex min-h-20 items-center justify-center gap-6">
      <span className="text-muted">
        Your note <b className="text-2xl text-spot">{midiToDisplayName(view.target)}</b>
      </span>
      <span className={`flex items-center gap-2 text-xl font-semibold ${label.cls}`} data-testid="take-state">
        <span aria-hidden>{label.icon}</span>
        {label.text}
      </span>
    </div>
  )
}

function Line({ text, big }: { text: string; big?: boolean }) {
  return <div className={`flex min-h-20 items-center justify-center text-muted ${big ? 'text-2xl font-semibold text-ink' : 'text-lg'}`}>{text}</div>
}
