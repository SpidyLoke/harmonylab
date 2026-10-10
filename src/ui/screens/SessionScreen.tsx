// Today's session: four steps, about ten minutes, biased to weak spots.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { db, type GuideStage } from '../../db/schema'
import { addAttempt, checkLevelPassed, currentLevel, getDrill, recordDrillTake } from '../../db/repo'
import { buildSession, type SessionStep } from '../../progress/session'
import { fitPieceToRange } from '../../music/transpose'
import { songPart } from '../../curriculum/builders'
import { builtInSong } from '../../music/songs'
import { songPiece } from '../../songs/library'
import { TOLERANCE_CENTS, tierForLevel } from '../../scoring/pitchState'
import type { TakeResult } from '../../scoring/score'
import type { Piece } from '../../music/types'
import { rangeOf, useProfile } from '../../state/profile'
import { Button } from '../components/Button'
import { MicGate } from '../components/MicGate'
import { ResultCard } from '../components/ResultCard'
import { TakeView } from '../components/TakeView'
import { EarRound } from './EarScreens'

export function SessionScreen() {
  const [steps, setSteps] = useState<SessionStep[] | null>(null)
  const [level, setLevel] = useState(1)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<boolean[]>([])

  useEffect(() => {
    void (async () => {
      const lv = await currentLevel()
      setLevel(lv)
      setSteps(
        buildSession({
          level: lv,
          drills: await db.drills.toArray(),
          earItems: await db.earItems.toArray(),
          songs: await db.songs.toArray(),
          attempts: await db.attempts.orderBy('at').reverse().limit(300).toArray(),
        }),
      )
    })()
  }, [])

  if (!steps) return <p className="p-6 text-muted">Building your session…</p>
  const finished = index >= steps.length
  const step = steps[index]
  const markDone = () => setDone((d) => Object.assign([...d], { [index]: true }))

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Today's session</h1>
      <ol className="mt-3 grid grid-cols-4 gap-2" aria-label="Session steps">
        {steps.map((s, i) => (
          <li
            key={i}
            aria-current={i === index ? 'step' : undefined}
            className={`rounded-2xl border p-2 text-xs ${i === index ? 'border-spot bg-spot/10' : 'border-line bg-surface'} ${done[i] ? 'text-good' : ''}`}
          >
            <span className="font-semibold">
              {done[i] ? '✓ ' : ''}
              {['Warm-up', 'Drill', 'Ear', 'Song'][i]}
            </span>
            <span className="block text-muted">{s.minutes} min</span>
          </li>
        ))}
      </ol>

      {finished ? (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
          <div className="text-5xl" aria-hidden>
            ★
          </div>
          <p className="mt-2 text-xl font-semibold">Session done. See you tomorrow.</p>
          <p className="mt-1 text-muted">{done.filter(Boolean).length} of 4 steps completed.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/progress" className="inline-flex min-h-12 items-center rounded-2xl bg-spot px-5 font-semibold text-stage">
              See progress
            </Link>
          </div>
        </section>
      ) : (
        <>
          <h2 className="mt-5 text-lg font-semibold">{step.title}</h2>
          {'why' in step && <p className="text-sm text-muted">{step.why}</p>}
          <div className="mt-3">
            <MicGate>
              <StepBody key={index} step={step} level={level} onDone={markDone} />
            </MicGate>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant={done[index] ? 'primary' : 'secondary'} onClick={() => setIndex(index + 1)} data-testid="session-next">
              {done[index] ? 'Next step' : 'Skip this step'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function StepBody({ step, level, onDone }: { step: SessionStep; level: number; onDone: () => void }) {
  const profile = useProfile((s) => s.profile)
  const range = rangeOf(profile)
  const [result, setResult] = useState<TakeResult | null>(null)
  const [stage, setStage] = useState<GuideStage>(0)
  const [songPieceState, setSongPiece] = useState<Piece | null>(null)
  const tol = TOLERANCE_CENTS[tierForLevel(step.kind === 'drill' ? step.level.n : level)]

  useEffect(() => {
    if (step.kind === 'drill') void getDrill(step.drill.id).then((p) => setStage(p.stage))
    if (step.kind === 'song') {
      void (async () => {
        if (step.songId !== null) {
          const s = await db.songs.get(step.songId)
          if (s) return setSongPiece(songPiece(s, s.selectedPart, range))
        }
        const b = builtInSong(step.builtInId ?? 'neon-summer')!
        setSongPiece(fitPieceToRange(songPart(b, 'thirdAbove'), range.low, range.high).piece)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const piece = useMemo(() => {
    if (step.kind === 'warmup') return fitPieceToRange(step.piece, range.low, range.high).piece
    if (step.kind === 'drill') return fitPieceToRange(step.drill.build(), range.low, range.high).piece
    return songPieceState
  }, [step, range.low, range.high, songPieceState])

  if (step.kind === 'ear') return <EarRound drill={step.drill} rounds={5} onFinish={onDone} />
  if (!piece) return <p className="text-muted">Loading…</p>

  const loop = step.kind === 'song' ? { startBeat: (step.fromBar - 1) * piece.beatsPerBar, endBeat: step.toBar * piece.beatsPerBar } : null

  return (
    <>
      <TakeView
        piece={piece}
        toleranceCents={tol}
        stage={stage}
        onStageChange={setStage}
        stageControl={step.kind !== 'warmup'}
        loop={loop}
        autoFade={step.kind === 'song'}
        compact
        onResult={(r, info) => {
          setResult(r)
          onDone()
          if (step.kind === 'drill') {
            void recordDrillTake(step.drill.id, info.stage, r.percentInTune).then((u) => {
              if (u.justPassed) void checkLevelPassed(step.level.n, step.level.drills.map((d) => d.id))
              if (u.nextStage > info.stage) setStage(u.nextStage)
            })
          }
          void addAttempt({
            kind: step.kind === 'warmup' ? 'warmup' : step.kind === 'drill' ? 'curriculum' : 'song',
            exerciseId: step.kind === 'drill' ? step.drill.id : step.kind === 'song' ? (step.songId !== null ? `song-${step.songId}` : `builtin-${step.builtInId}`) : 'warmup',
            title: step.title,
            score: r.percentInTune,
            avgCents: r.averageCentsOff,
            seconds: info.seconds,
            stage: info.stage,
            intervals: step.kind === 'drill' && step.drill.interval ? { [step.drill.interval]: [Math.round(r.percentInTune), 100] } : undefined,
          })
        }}
      />
      {result && <ResultCard result={result} />}
    </>
  )
}
