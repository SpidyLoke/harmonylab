// First-run setup: mic, headphones, range, latency, placement.
// Each step can also be re-run on its own from Settings (?step=range etc.).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { clapLatencyTest, captureStableNote, headphoneCheck, tapLatencyTest } from '../../audio/checks'
import { pitchEngine } from '../../audio/pitchEngine'
import { midiToDisplayName } from '../../music/notes'
import { fitPieceToRange } from '../../music/transpose'
import { PLACEMENT_TASKS, placementLevel } from '../../curriculum/placement'
import { addAttempt, unlockLevelsUpTo } from '../../db/repo'
import { rangeOf, useProfile } from '../../state/profile'
import { TOLERANCE_CENTS } from '../../scoring/pitchState'
import type { TakeResult } from '../../scoring/score'
import { useEngineState } from '../../state/engine'
import { Button } from '../components/Button'
import { MicGate } from '../components/MicGate'
import { ResultCard } from '../components/ResultCard'
import { TakeView } from '../components/TakeView'
import { useLive } from '../components/useLive'

const STEPS = ['mic', 'headphones', 'range', 'latency', 'placement', 'done'] as const
type Step = (typeof STEPS)[number]
const TITLES: Record<Step, string> = {
  mic: 'Microphone',
  headphones: 'Headphones',
  range: 'Your range',
  latency: 'Timing',
  placement: 'Placement',
  done: 'Ready',
}

export function SetupScreen() {
  const [params] = useSearchParams()
  const only = params.get('step') as Step | null
  const [step, setStep] = useState<Step>(only ?? 'mic')
  const navigate = useNavigate()
  const { status } = useEngineState()

  const next = () => {
    if (only) return navigate('/settings')
    const i = STEPS.indexOf(step)
    setStep(STEPS[Math.min(STEPS.length - 1, i + 1)])
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      {!only && (
        <ol className="mt-2 flex flex-wrap gap-2 text-xs" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={s === step ? 'step' : undefined}
              className={`rounded-full px-3 py-1.5 ${s === step ? 'bg-spot text-stage font-semibold' : i < STEPS.indexOf(step) ? 'bg-surface-2 text-ink' : 'bg-surface text-muted'}`}
            >
              {i + 1}. {TITLES[s]}
            </li>
          ))}
        </ol>
      )}
      <h1 className="mt-5 text-2xl font-bold">{TITLES[step]}</h1>

      {step === 'mic' && (
        <>
          <p className="mt-2 text-muted">
            HarmonyLab needs to hear you to show your pitch. Five quick steps, about four minutes, and the app is set
            up for your voice.
          </p>
          <MicGate>
            <div className="mt-6 rounded-3xl border border-line bg-surface p-5">
              <p>
                <span className="text-good">✓</span> Microphone on. Sing anything and watch it register:
              </p>
              <MicMeter />
              <Button variant="primary" className="mt-4" onClick={next}>
                Next: headphones
              </Button>
            </div>
          </MicGate>
        </>
      )}
      {step !== 'mic' && status !== 'running' && step !== 'done' && <MicGate>{null}</MicGate>}
      {step === 'headphones' && status === 'running' && <HeadphoneStep onDone={next} />}
      {step === 'range' && status === 'running' && <RangeStep onDone={next} />}
      {step === 'latency' && status === 'running' && <LatencyStep onDone={next} />}
      {step === 'placement' && status === 'running' && <PlacementStep onDone={next} />}
      {step === 'done' && <DoneStep />}
    </div>
  )
}

function MicMeter() {
  const v = useLive(() => {
    const f = pitchEngine.latest
    return { db: f?.db ?? -100, note: f?.midi ?? null }
  }, 15)
  const pct = Math.max(0, Math.min(100, ((v.db + 70) / 60) * 100))
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label="Mic level" aria-valuenow={Math.round(pct)}>
        <div className="h-full bg-spot transition-[width] duration-75" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right font-semibold tabular-nums">{v.note !== null ? midiToDisplayName(v.note) : '…'}</span>
    </div>
  )
}

function HeadphoneStep({ onDone }: { onDone: () => void }) {
  const update = useProfile((s) => s.update)
  const [state, setState] = useState<'ready' | 'running' | 'ok' | 'bleed'>('ready')
  const run = async () => {
    setState('running')
    const r = await headphoneCheck()
    setState(r.bleed ? 'bleed' : 'ok')
    await update({ headphones: r.bleed ? 'bleed' : 'ok' })
  }
  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted">
        Headphones are needed so the guide notes go into your ears, not back into the mic. Otherwise the app hears
        the guide and thinks it is you. Wired headphones work best: Bluetooth can drop to phone-call sound quality
        while the mic is on.
      </p>
      <div className="rounded-3xl border border-line bg-surface p-5">
        {state === 'ready' && (
          <>
            <p>Put your headphones on. Stay quiet while three short notes play.</p>
            <Button variant="primary" className="mt-4" onClick={() => void run()}>
              Run the check
            </Button>
          </>
        )}
        {state === 'running' && <p className="text-lg">Listening… stay quiet.</p>}
        {state === 'ok' && (
          <>
            <p className="text-lg text-good">✓ All clear. The mic can't hear the guide.</p>
            <Button variant="primary" className="mt-4" onClick={onDone}>
              Next: your range
            </Button>
          </>
        )}
        {state === 'bleed' && (
          <>
            <p className="text-lg text-near" role="alert">
              ▲ The mic heard the guide notes.
            </p>
            <p className="mt-2 text-muted">
              Plug in headphones, or turn the volume down, then check again. If you carry on as you are, your scores
              may count the guide as your voice.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void run()}>
                Check again
              </Button>
              <Button onClick={onDone}>Carry on anyway</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RangeStep({ onDone }: { onDone: () => void }) {
  const update = useProfile((s) => s.update)
  const [phase, setPhase] = useState<'low' | 'high' | 'check'>('low')
  const [low, setLow] = useState<number | null>(null)
  const [high, setHigh] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [live, setLive] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const capture = async () => {
    setMessage(null)
    setListening(true)
    abort.current = new AbortController()
    const m = await captureStableNote(
      (p) => {
        setProgress(p.progress)
        setLive(p.midi)
      },
      { holdSec: 1.2, timeoutSec: 10, signal: abort.current.signal },
    )
    setListening(false)
    setProgress(0)
    if (m === null) {
      setMessage("Didn't catch a steady note. Hold one note on \"ah\" for a second or two.")
      return
    }
    const note = Math.round(m)
    if (phase === 'low') {
      setLow(note)
      setPhase('high')
    } else {
      if (low !== null && note - low < 7) {
        setMessage(
          `That's only ${note - low} semitones above your low note. Go higher: a comfortable top note, not a strain.`,
        )
        return
      }
      setHigh(note)
      setPhase('check')
    }
  }

  const save = async () => {
    await update({ rangeLow: low, rangeHigh: high })
    onDone()
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted">
        Every exercise is moved up or down to sit in your range, the notes you can sing comfortably. Sing on an
        open "ah" and hold the note steady until the bar fills.
      </p>
      <div className="rounded-3xl border border-line bg-surface p-5">
        {phase !== 'check' ? (
          <>
            <p className="text-lg">
              {phase === 'low'
                ? 'Slide down to your lowest comfortable note, then hold it.'
                : 'Now slide up to your highest comfortable note (no straining), and hold it.'}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-label="Hold progress">
                <div className="h-full bg-spot" style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="w-16 text-right text-2xl font-bold tabular-nums">{live !== null && listening ? midiToDisplayName(live) : '…'}</span>
            </div>
            {message && (
              <p className="mt-3 text-near" role="alert">
                {message}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void capture()} disabled={listening}>
                {listening ? 'Listening…' : phase === 'low' ? 'Record low note' : 'Record high note'}
              </Button>
              {low !== null && <span className="self-center text-sm text-muted">Low: {midiToDisplayName(low)}</span>}
            </div>
          </>
        ) : (
          <>
            <p className="text-lg">
              Your range: <b className="text-spot">{midiToDisplayName(low!)}</b> to <b className="text-spot">{midiToDisplayName(high!)}</b> ({high! - low!} semitones).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void save()}>
                Save and continue
              </Button>
              <Button
                onClick={() => {
                  setLow(null)
                  setHigh(null)
                  setPhase('low')
                }}
              >
                Redo
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LatencyStep({ onDone }: { onDone: () => void }) {
  const update = useProfile((s) => s.update)
  const [state, setState] = useState<'ready' | 'clapping' | 'tapping' | 'failed' | 'done'>('ready')
  const [result, setResult] = useState<number | null>(null)
  const tapRef = useRef<(() => void) | null>(null)

  const clap = async () => {
    setState('clapping')
    const r = await clapLatencyTest()
    if (!r) return setState('failed')
    setResult(r.latencyMs)
    await update({ latencyMs: r.latencyMs, latencyMethod: 'clap' })
    setState('done')
  }
  const tap = async () => {
    setState('tapping')
    const t = tapLatencyTest()
    tapRef.current = t.tap
    const r = await t.result
    tapRef.current = null
    if (!r) return setState('failed')
    setResult(r.latencyMs)
    await update({ latencyMs: r.latencyMs, latencyMethod: 'tap' })
    setState('done')
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted">
        There is a small delay between a sound playing and your voice reaching the app. Measuring it once means
        your scores line up with the beat instead of marking you late.
      </p>
      <div className="rounded-3xl border border-line bg-surface p-5">
        {state === 'ready' && (
          <>
            <p>With headphones on, you'll hear four count-in clicks, then eight more. Clap on each of the eight, near the mic.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void clap()}>
                Start clap test
              </Button>
              <Button onClick={() => void tap()}>Tap the screen instead</Button>
            </div>
          </>
        )}
        {state === 'clapping' && <p className="text-lg">Clap on the clicks after the count-in…</p>}
        {state === 'tapping' && (
          <button
            className="flex h-48 w-full items-center justify-center rounded-3xl bg-spot text-2xl font-bold text-stage active:brightness-90"
            onPointerDown={() => tapRef.current?.()}
          >
            Tap here on each click
          </button>
        )}
        {state === 'failed' && (
          <>
            <p className="text-near" role="alert">
              ▲ Couldn't pick up enough claps or taps. Try again a little louder, or use the other method.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void clap()}>
                Clap test
              </Button>
              <Button onClick={() => void tap()}>Tap test</Button>
              <Button variant="ghost" onClick={onDone}>
                Skip for now
              </Button>
            </div>
          </>
        )}
        {state === 'done' && (
          <>
            <p className="text-lg text-good">✓ Delay measured: {result} ms. Scoring will allow for it.</p>
            <Button variant="primary" className="mt-4" onClick={onDone}>
              Next
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function PlacementStep({ onDone }: { onDone: () => void }) {
  const profile = useProfile((s) => s.profile)
  const update = useProfile((s) => s.update)
  const { low, high } = rangeOf(profile)
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [last, setLast] = useState<TakeResult | null>(null)
  const [started, setStarted] = useState(false)
  const task = PLACEMENT_TASKS[index]
  const piece = useMemo(() => (task ? fitPieceToRange(task.build(), low, high).piece : null), [task, low, high])
  const finished = scores.length === PLACEMENT_TASKS.length || (scores.length > 0 && scores[scores.length - 1] < 70)

  const finish = async (all: number[]) => {
    const level = placementLevel(all)
    await unlockLevelsUpTo(level)
    await update({ placementLevel: level })
  }

  if (finished) {
    const level = placementLevel(scores)
    return (
      <div className="mt-3 rounded-3xl border border-line bg-surface p-5">
        <p className="text-lg">
          You start at <b className="text-spot">level {level}</b>.
        </p>
        <p className="mt-2 text-muted">
          {level === 1
            ? 'Perfect place to begin: level 1 builds the foundation everything else stands on.'
            : `Levels 1 to ${level - 1} are unlocked too, if you want to warm up there.`}
        </p>
        <Button variant="primary" className="mt-4" onClick={onDone}>
          Finish setup
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted">
        Five short tasks, easiest first, to find your starting level. Stop whenever a task feels too hard: that is
        the point. Task {index + 1} of {PLACEMENT_TASKS.length}.
      </p>
      <div className="rounded-3xl border border-spot/40 bg-spot/10 p-4">
        <b>{task.title}.</b> {task.instruction}
      </div>
      {!started ? (
        <Button variant="primary" onClick={() => setStarted(true)}>
          I'm ready
        </Button>
      ) : (
        piece && (
          <TakeView
            key={task.id}
            piece={piece}
            toleranceCents={TOLERANCE_CENTS.beginner}
            stage={3}
            noDemo
            compact
            autoStart
            onResult={(r, info) => {
              setLast(r)
              void addAttempt({ kind: 'placement', exerciseId: task.id, title: task.title, score: r.percentInTune, avgCents: r.averageCentsOff, seconds: info.seconds })
              const all = [...scores, r.percentInTune]
              setScores(all)
              if (all.length === PLACEMENT_TASKS.length || r.percentInTune < 70) void finish(all)
              else setIndex(index + 1)
              setStarted(false)
            }}
          />
        )
      )}
      {last && !started && <ResultCard result={last} heading="Last task" />}
    </div>
  )
}

function DoneStep() {
  const update = useProfile((s) => s.update)
  const navigate = useNavigate()
  useEffect(() => {
    void update({ onboarded: true })
  }, [update])
  return (
    <div className="mt-3 rounded-3xl border border-line bg-surface p-5">
      <p className="text-lg">You're set up. Your range, timing and level are saved on this device.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigate('/learn')}>
          Go to my level
        </Button>
        <Button onClick={() => navigate('/')}>Today's session</Button>
      </div>
    </div>
  )
}
