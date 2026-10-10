// Ear training: drill list and a ten-question round with adaptive repetition.

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { EAR_DRILLS, getEarDrill, sungCorrect, type EarDrill, type EarQuestion } from '../../ear/drills'
import { newItem, pickNext, recordAnswer, type RepItem } from '../../ear/repetition'
import { captureStableNote } from '../../audio/checks'
import { db } from '../../db/schema'
import { addAttempt } from '../../db/repo'
import { midiToDisplayName } from '../../music/notes'
import { rangeOf, useProfile } from '../../state/profile'
import { Button } from '../components/Button'
import { MicGate } from '../components/MicGate'

const ROUND = 10

export function EarScreen() {
  const items = useLiveQuery(() => db.earItems.toArray(), []) ?? []
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Ear training</h1>
      <p className="mt-1 text-muted">
        Short rounds of ten. Anything you miss comes back more often until it sticks. An interval is the distance
        between two notes.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {EAR_DRILLS.map((d) => {
          const mine = items.filter((i) => i.drill === d.id)
          const seen = mine.reduce((s, i) => s + i.seen, 0)
          const correct = mine.reduce((s, i) => s + i.correct, 0)
          return (
            <li key={d.id}>
              <Link to={`/ear/${d.id}`} className="flex h-full min-h-24 flex-col rounded-3xl border border-line bg-surface p-4 hover:border-muted">
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="text-spot">
                    {d.sung ? '🎤︎' : '◉'}
                  </span>
                  {d.title}
                </span>
                <span className="mt-1 flex-1 text-sm text-muted">{d.description}</span>
                <span className="mt-2 text-xs text-muted tabular-nums">
                  {seen ? `${Math.round((100 * correct) / seen)}% right over ${seen} answers` : 'Not tried yet'} · {d.sung ? 'Sung' : 'Tap to answer'}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function EarDrillScreen() {
  const { drill: id } = useParams()
  const drill = id ? getEarDrill(id) : undefined
  if (!drill) return <p className="p-6">That drill doesn't exist.</p>
  const body = <EarRound drill={drill} />
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <Link to="/ear" className="mt-3 inline-block text-sm text-muted hover:text-ink">
        ← Ear training
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{drill.title}</h1>
      <p className="mb-4 text-muted">{drill.description}</p>
      {drill.sung ? <MicGate>{body}</MicGate> : body}
    </div>
  )
}

export function EarRound({ drill, onFinish, rounds = ROUND }: { drill: EarDrill; onFinish?: (score: number) => void; rounds?: number }) {
  const profile = useProfile((s) => s.profile)
  const { low, high } = rangeOf(profile)
  const [coreOnly, setCoreOnly] = useState(true)
  const [pool, setPool] = useState<RepItem[] | null>(null)
  const [q, setQ] = useState<{ item: string; question: EarQuestion } | null>(null)
  const [answered, setAnswered] = useState<{ correct: boolean; given: string } | null>(null)
  const [count, setCount] = useState(0)
  const [right, setRight] = useState(0)
  const [singing, setSinging] = useState<{ progress: number; midi: number | null } | null>(null)
  const stats = useRef<Record<string, [number, number]>>({})
  const lastId = useRef<string | null>(null)
  const started = useRef(Date.now())
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  // Load this drill's items, creating any that are new.
  useEffect(() => {
    void (async () => {
      const ids = drill.items(coreOnly)
      const rows = await db.earItems.where('drill').equals(drill.id).toArray()
      const byItem = new Map(rows.map((r) => [r.id.split('|')[1], r]))
      setPool(ids.map((i) => byItem.get(i) ?? { ...newItem(`${drill.id}|${i}`), drill: drill.id }))
    })()
  }, [drill, coreOnly])

  const ask = (items: RepItem[]) => {
    const it = pickNext(items, lastId.current)
    lastId.current = it.id
    const item = it.id.split('|')[1]
    const question = drill.make(item, low, high, coreOnly)
    setQ({ item, question })
    setAnswered(null)
    setTimeout(() => question.play(), 150)
  }

  const record = async (correct: boolean, given: string) => {
    if (!q || !pool) return
    setAnswered({ correct, given })
    setCount((c) => c + 1)
    if (correct) setRight((r) => r + 1)
    const label = drill.statLabel(q.item)
    const [h, t] = stats.current[label] ?? [0, 0]
    stats.current[label] = [h + (correct ? 1 : 0), t + 1]
    const id = `${drill.id}|${q.item}`
    const updated = recordAnswer(pool.find((p) => p.id === id) ?? newItem(id), correct)
    await db.earItems.put({ ...updated, drill: drill.id })
    setPool(pool.map((p) => (p.id === id ? updated : p)))
  }

  const sing = async () => {
    if (!q || q.question.answer.type !== 'sing') return
    abort.current = new AbortController()
    setSinging({ progress: 0, midi: null })
    const m = await captureStableNote((p) => setSinging(p), { holdSec: 0.7, timeoutSec: 7, signal: abort.current.signal })
    setSinging(null)
    if (m === null) return
    await record(sungCorrect(m, q.question.answer.targetMidi), midiToDisplayName(m))
  }

  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const score = (100 * right) / rounds
    void addAttempt({
      kind: 'ear',
      exerciseId: drill.id,
      title: drill.title,
      score,
      avgCents: 0,
      seconds: (Date.now() - started.current) / 1000,
      intervals: stats.current,
    })
    onFinish?.(score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  if (!pool) return <p className="text-muted">Loading…</p>

  if (done) {
    return (
      <section className="rounded-3xl border border-line bg-surface p-6 text-center" data-testid="ear-done">
        <div className="text-5xl font-bold tabular-nums text-spot">
          {right}/{rounds}
        </div>
        <p className="mt-2 text-muted">Round done. The ones you missed will come up more next time.</p>
        {!onFinish && (
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => {
              setDone(false)
              setCount(0)
              setRight(0)
              stats.current = {}
              started.current = Date.now()
              ask(pool)
            }}
          >
            Another round
          </Button>
        )}
      </section>
    )
  }

  if (!q) {
    return (
      <section className="rounded-3xl border border-line bg-surface p-6">
        {drill.id.startsWith('interval') && (
          <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-spot)]" checked={coreOnly} onChange={(e) => setCoreOnly(e.target.checked)} />
            Core intervals only (3rds, 4th, 5th, 6th, octave)
          </label>
        )}
        <Button variant="primary" onClick={() => ask(pool)} data-testid="ear-start">
          Start round
        </Button>
      </section>
    )
  }

  const a = q.question.answer
  return (
    <section className="rounded-3xl border border-line bg-surface p-5" aria-live="polite">
      <div className="mb-3 flex justify-between text-sm text-muted tabular-nums">
        <span>
          Question {Math.min(count + (answered ? 0 : 1), rounds)} of {rounds}
        </span>
        <span>
          {right} right
        </span>
      </div>
      <p className="text-lg font-semibold">{q.question.prompt}</p>
      <Button className="mt-3" onClick={() => q.question.play()}>
        ↻ Play again
      </Button>

      {a.type === 'choice' && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {a.options.map((o) => {
            const isRight = answered && o.value === a.correct
            const isWrongPick = answered && !answered.correct && o.value === answered.given
            return (
              <button
                key={o.value}
                disabled={!!answered}
                onClick={() => void record(o.value === a.correct, o.value)}
                className={`min-h-14 rounded-2xl border px-3 text-base font-medium capitalize transition ${
                  isRight ? 'border-good bg-good/20 text-good' : isWrongPick ? 'border-bad bg-bad/15 text-bad' : 'border-line bg-surface-2 hover:border-muted'
                }`}
              >
                {isRight ? '✓ ' : isWrongPick ? '✕ ' : ''}
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {a.type === 'sing' && !answered && (
        <div className="mt-4">
          {singing ? (
            <div className="flex items-center gap-4">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(singing.progress * 100)} aria-label="Hold">
                <div className="h-full bg-spot" style={{ width: `${singing.progress * 100}%` }} />
              </div>
              <span className="w-16 text-right text-2xl font-bold tabular-nums">{singing.midi !== null ? midiToDisplayName(singing.midi) : '…'}</span>
            </div>
          ) : (
            <Button variant="primary" onClick={() => void sing()}>
              🎤︎ Sing my answer
            </Button>
          )}
          <p className="mt-2 text-xs text-muted">Hold the note steady until the bar fills.</p>
        </div>
      )}

      {answered && (
        <div className={`mt-4 rounded-2xl p-4 ${answered.correct ? 'bg-good/15' : 'bg-bad/10'}`}>
          <p className={`font-semibold ${answered.correct ? 'text-good' : 'text-bad'}`}>
            {answered.correct ? '✓ Right' : '✕ Not quite'}
            {a.type === 'sing' && `: you sang ${answered.given}, the note was ${a.label}`}
          </p>
          <p className="mt-1 text-sm">{q.question.explain}</p>
          <Button variant="primary" className="mt-3" onClick={() => (count >= rounds ? setDone(true) : ask(pool))} data-testid="ear-next">
            {count >= rounds ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
    </section>
  )
}
