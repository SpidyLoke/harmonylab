// Today: the session button, current level, streak. First visit: welcome.

import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { getLevel } from '../../curriculum/levels'
import { db } from '../../db/schema'
import { localDay } from '../../db/repo'
import { streak } from '../../progress/stats'
import { midiToDisplayName } from '../../music/notes'
import { useProfile } from '../../state/profile'

export function HomeScreen({ welcome = false }: { welcome?: boolean }) {
  if (welcome) return <Welcome />
  return <Today />
}

function Welcome() {
  const onboarded = useProfile((s) => s.profile.onboarded)
  return (
    <div className="mx-auto flex min-h-[78vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div aria-hidden className="mb-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_#f5c45155_0%,_#f5c45111_45%,_transparent_70%)]" />
      <h1 className="text-5xl font-bold tracking-tight">HarmonyLab</h1>
      <p className="mt-4 text-lg text-muted">
        Go from "can't hold a part" to finding and holding a harmony on songs you love, a few minutes a day, with live
        feedback on every note.
      </p>
      <Link
        to={onboarded ? '/' : '/setup'}
        className="mt-10 inline-flex min-h-14 items-center rounded-2xl bg-spot px-10 text-lg font-semibold text-stage shadow-[0_0_40px_-6px_var(--color-spot)] hover:brightness-110"
      >
        {onboarded ? 'Continue' : 'Set up (about 4 minutes)'}
      </Link>
      <p className="mt-6 text-sm text-muted">Headphones needed. Your voice never leaves this device. No account.</p>
    </div>
  )
}

function Today() {
  const profile = useProfile((s) => s.profile)
  const levels = useLiveQuery(() => db.levels.toArray(), []) ?? []
  const days = useLiveQuery(async () => [...new Set((await db.attempts.toArray()).map((a) => a.day))], []) ?? []
  const n = Math.max(1, ...levels.filter((l) => l.unlocked).map((l) => l.level))
  const level = getLevel(n)!
  const s = streak(days, localDay())
  const practisedToday = days.includes(localDay())

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-spot/40 bg-[radial-gradient(ellipse_at_top,_#f5c45133,_transparent_70%)] p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-muted">{practisedToday ? 'Done one today, go again?' : "Today's practice"}</p>
        <h1 className="mt-2 text-3xl font-bold">Ten minutes, built for you</h1>
        <p className="mt-2 text-muted">A warm-up, a drill, an ear exercise and a song section, leaning on your weak spots.</p>
        <Link
          to="/session"
          className="mt-6 inline-flex min-h-14 items-center rounded-2xl bg-spot px-10 text-lg font-semibold text-stage shadow-[0_0_40px_-6px_var(--color-spot)] hover:brightness-110"
          data-testid="start-session"
        >
          Start today's session
        </Link>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to={`/learn/${n}`} className="rounded-3xl border border-line bg-surface p-5 hover:border-muted">
          <div className="text-xs uppercase tracking-widest text-muted">Your level</div>
          <div className="mt-1 text-xl font-semibold">
            {n}. {level.title}
          </div>
          <div className="mt-1 text-sm text-muted">{level.goal}</div>
        </Link>
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="text-xs uppercase tracking-widest text-muted">Streak</div>
          <div className="mt-1 text-4xl font-bold tabular-nums">
            {s} <span className="text-lg font-medium text-muted">day{s === 1 ? '' : 's'}</span>
          </div>
          {profile.rangeLow !== null && profile.rangeHigh !== null && (
            <div className="mt-1 text-sm text-muted">
              Range {midiToDisplayName(profile.rangeLow)} to {midiToDisplayName(profile.rangeHigh)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/practice" className="rounded-3xl border border-line bg-surface p-4 text-center hover:border-muted">
          <div className="text-2xl" aria-hidden>
            🎯︎
          </div>
          <div className="font-semibold">Free practice</div>
          <div className="text-xs text-muted">Any note, live feedback</div>
        </Link>
        <Link to="/songs" className="rounded-3xl border border-line bg-surface p-4 text-center hover:border-muted">
          <div className="text-2xl" aria-hidden>
            ♫
          </div>
          <div className="font-semibold">My songs</div>
          <div className="text-xs text-muted">Harmonise your own tunes</div>
        </Link>
      </div>
    </div>
  )
}
