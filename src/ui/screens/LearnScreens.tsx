// Curriculum: level list, level page (explainer, try-it, demo, drills), drill.

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LEVELS, findDrill, getLevel, type Level } from '../../curriculum/levels'
import { db, type GuideStage } from '../../db/schema'
import { addAttempt, checkLevelPassed, PASS_MARK, recordDrillTake } from '../../db/repo'
import { fitPieceToRange } from '../../music/transpose'
import { TOLERANCE_CENTS, tierForLevel } from '../../scoring/pitchState'
import type { TakeResult } from '../../scoring/score'
import { rangeOf, useProfile } from '../../state/profile'
import { STAGE_LABELS } from '../../audio/runner'
import { Button } from '../components/Button'
import { MicGate } from '../components/MicGate'
import { ResultCard } from '../components/ResultCard'
import { TakeView } from '../components/TakeView'
import { TryIt } from '../components/TryIt'

export function LearnScreen() {
  const levels = useLiveQuery(() => db.levels.toArray(), []) ?? []
  const drills = useLiveQuery(() => db.drills.toArray(), []) ?? []
  const unlocked = (n: number) => n === 1 || levels.some((l) => l.level === n && l.unlocked)
  const passed = (n: number) => levels.some((l) => l.level === n && l.passed)
  const current = Math.max(1, ...levels.filter((l) => l.unlocked).map((l) => l.level))

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Learn</h1>
      <p className="mt-1 text-muted">Ten levels from one note to three-part harmony. Pass every drill with the guide off to unlock the next.</p>
      <ol className="mt-5 space-y-3">
        {LEVELS.map((l) => {
          const done = l.drills.filter((d) => drills.some((p) => p.drillId === d.id && p.passed)).length
          const open = unlocked(l.n)
          const isCurrent = l.n === current && !passed(l.n)
          return (
            <li key={l.n}>
              <Link
                to={open ? `/learn/${l.n}` : '#'}
                aria-disabled={!open}
                onClick={(e) => !open && e.preventDefault()}
                className={`flex min-h-16 items-center gap-4 rounded-3xl border p-4 transition ${
                  isCurrent ? 'border-spot bg-spot/10 shadow-[0_0_30px_-12px_var(--color-spot)]' : 'border-line bg-surface'
                } ${open ? 'hover:border-muted' : 'opacity-50'}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    passed(l.n) ? 'bg-good text-stage' : isCurrent ? 'bg-spot text-stage' : 'bg-surface-2'
                  }`}
                  aria-hidden
                >
                  {passed(l.n) ? '✓' : open ? l.n : '🔒︎'}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">
                    Level {l.n}: {l.title}
                  </span>
                  <span className="block text-sm text-muted">{l.goal}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {passed(l.n) ? 'Passed' : open ? `${done}/${l.drills.length}` : 'Locked'}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function LevelScreen() {
  const { level: levelParam } = useParams()
  const level = getLevel(Number(levelParam))
  const drills = useLiveQuery(() => db.drills.toArray(), []) ?? []
  if (!level) return <p className="p-6">That level doesn't exist.</p>
  const tol = TOLERANCE_CENTS[tierForLevel(level.n)]
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <Link to="/learn" className="mt-3 inline-block text-sm text-muted hover:text-ink">
        ← All levels
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        Level {level.n}: {level.title}
      </h1>
      <p className="mt-1 text-muted">
        In tune means within ±{tol} cents at this level. A cent is a hundredth of a semitone, the step between two
        neighbouring piano keys.
      </p>

      <section className="mt-5 space-y-3 rounded-3xl border border-line bg-surface p-5 leading-relaxed" aria-label="Explainer">
        <h2 className="text-xs uppercase tracking-widest text-muted">The idea (one minute)</h2>
        {level.explainer.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <div className="mt-4">
        <MicGate>
          <TryIt config={level.tryIt} toleranceCents={tol} />
        </MicGate>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Drills</h2>
      <p className="text-sm text-muted">Each drill has a demo. Start with the guide at full, then fade it out.</p>
      <ul className="mt-3 space-y-3">
        {level.drills.map((d) => {
          const p = drills.find((x) => x.drillId === d.id)
          return (
            <li key={d.id}>
              <Link
                to={`/learn/${level.n}/${d.id}`}
                className="flex min-h-16 items-center gap-4 rounded-3xl border border-line bg-surface p-4 hover:border-muted"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${p?.passed ? 'bg-good text-stage' : 'bg-surface-2'}`}
                  aria-hidden
                >
                  {p?.passed ? '✓' : '▶'}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{d.title}</span>
                  <span className="block text-sm text-muted">{d.description}</span>
                </span>
                <span className="text-right text-sm text-muted">
                  {p ? (
                    <>
                      Guide: {STAGE_LABELS[p.stage]}
                      <br />
                      Best {Math.round(p.best)}%
                    </>
                  ) : (
                    'New'
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function DrillScreen() {
  const { drill: drillId } = useParams()
  const found = drillId ? findDrill(drillId) : undefined
  if (!found) return <p className="p-6">That drill doesn't exist.</p>
  return <DrillRunner level={found.level} drillId={found.drill.id} />
}

function DrillRunner({ level, drillId }: { level: Level; drillId: string }) {
  const drill = level.drills.find((d) => d.id === drillId)!
  const profile = useProfile((s) => s.profile)
  const navigate = useNavigate()
  const progress = useLiveQuery(() => db.drills.get(drillId), [drillId])
  const [stage, setStage] = useState<GuideStage | null>(null)
  const [result, setResult] = useState<TakeResult | null>(null)
  const [verdict, setVerdict] = useState<{ text: string; good: boolean } | null>(null)
  const [levelPassed, setLevelPassed] = useState(false)
  const { low, high } = rangeOf(profile)
  const piece = useMemo(() => fitPieceToRange(drill.build(), low, high).piece, [drill, low, high])
  const tol = TOLERANCE_CENTS[tierForLevel(level.n)]
  const current: GuideStage = stage ?? progress?.stage ?? 0
  const idx = level.drills.findIndex((d) => d.id === drillId)
  const nextDrill = level.drills[idx + 1]

  const onResult = async (r: TakeResult, info: { stage: GuideStage; seconds: number }) => {
    setResult(r)
    const up = await recordDrillTake(drillId, info.stage, r.percentInTune)
    await addAttempt({
      kind: 'curriculum',
      exerciseId: drillId,
      title: `L${level.n} ${drill.title}`,
      score: r.percentInTune,
      avgCents: r.averageCentsOff,
      seconds: info.seconds,
      stage: info.stage,
      intervals: drill.interval ? { [drill.interval]: [Math.round(r.percentInTune), 100] } : undefined,
    })
    if (up.justPassed) {
      setVerdict({ text: `Drill passed: ${Math.round(r.percentInTune)}% with the guide off.`, good: true })
      const passedLevel = await checkLevelPassed(level.n, level.drills.map((d) => d.id))
      setLevelPassed(passedLevel)
    } else if (info.stage === 3) {
      setVerdict({
        text:
          r.percentInTune >= PASS_MARK
            ? 'Passed again. Nice consistency.'
            : `${PASS_MARK}% with the guide off passes this drill. You're at ${Math.round(r.percentInTune)}%.`,
        good: r.percentInTune >= PASS_MARK,
      })
    } else if (up.nextStage > info.stage) {
      setVerdict({ text: `Good: over 70%. Next take, the guide drops to "${STAGE_LABELS[up.nextStage]}".`, good: true })
      setStage(up.nextStage)
    } else {
      setVerdict({ text: 'Over 70% moves the guide down a stage. Go again.', good: false })
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Link to={`/learn/${level.n}`} className="mt-3 inline-block text-sm text-muted hover:text-ink">
        ← Level {level.n}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{drill.title}</h1>
      <p className="mb-4 text-muted">{drill.description}</p>
      <MicGate>
        <TakeView
          piece={piece}
          toleranceCents={tol}
          stage={current}
          onStageChange={(s) => setStage(s)}
          stageControl
          onResult={(r, info) => void onResult(r, info)}
        />
        {result && (
          <ResultCard
            result={result}
            verdict={
              verdict && (
                <p className={`rounded-2xl p-3 font-semibold ${verdict.good ? 'bg-good/15 text-good' : 'bg-surface-2'}`} data-testid="verdict">
                  {verdict.good ? '✓ ' : ''}
                  {verdict.text}
                </p>
              )
            }
            actions={
              <>
                {levelPassed && level.n < 10 && (
                  <Button variant="primary" onClick={() => navigate(`/learn/${level.n + 1}`)}>
                    Level {level.n} passed! On to level {level.n + 1}
                  </Button>
                )}
                {nextDrill && (
                  <Button onClick={() => navigate(`/learn/${level.n}/${nextDrill.id}`)}>Next drill: {nextDrill.title}</Button>
                )}
              </>
            }
          />
        )}
      </MicGate>
    </div>
  )
}
