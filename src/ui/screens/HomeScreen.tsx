import { Link } from 'react-router'

export function HomeScreen() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div
        aria-hidden
        className="mb-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_#f5c45155_0%,_#f5c45111_45%,_transparent_70%)]"
      />
      <h1 className="text-5xl font-bold tracking-tight">HarmonyLab</h1>
      <p className="mt-4 text-lg text-muted">
        Learn to find and hold a harmony, a few minutes at a time, with live feedback on every note.
      </p>
      <Link
        to="/practice"
        className="mt-10 inline-flex min-h-14 items-center rounded-2xl bg-spot px-10 text-lg font-semibold text-stage shadow-[0_0_40px_-6px_var(--color-spot)] hover:brightness-110"
      >
        Start singing
      </Link>
      <p className="mt-6 text-sm text-muted">Use headphones. Your voice never leaves this device.</p>
    </div>
  )
}
