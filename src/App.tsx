import { lazy, Suspense, useEffect } from 'react'
import { createHashRouter, Navigate, NavLink, Outlet, RouterProvider, useLocation } from 'react-router'
import { useSettings } from './state/settings'
import { useProfile } from './state/profile'
import { HomeScreen } from './ui/screens/HomeScreen'

const PracticeScreen = lazy(() => import('./ui/screens/PracticeScreen').then((m) => ({ default: m.PracticeScreen })))
const SetupScreen = lazy(() => import('./ui/screens/SetupScreen').then((m) => ({ default: m.SetupScreen })))
const LearnScreen = lazy(() => import('./ui/screens/LearnScreens').then((m) => ({ default: m.LearnScreen })))
const LevelScreen = lazy(() => import('./ui/screens/LearnScreens').then((m) => ({ default: m.LevelScreen })))
const DrillScreen = lazy(() => import('./ui/screens/LearnScreens').then((m) => ({ default: m.DrillScreen })))
const EarScreen = lazy(() => import('./ui/screens/EarScreens').then((m) => ({ default: m.EarScreen })))
const EarDrillScreen = lazy(() => import('./ui/screens/EarScreens').then((m) => ({ default: m.EarDrillScreen })))
const SongsScreen = lazy(() => import('./ui/screens/SongScreens').then((m) => ({ default: m.SongsScreen })))
const NewSongScreen = lazy(() => import('./ui/screens/NewSongScreen').then((m) => ({ default: m.NewSongScreen })))
const SongEditScreen = lazy(() => import('./ui/screens/SongScreens').then((m) => ({ default: m.SongEditScreen })))
const SongPracticeScreen = lazy(() => import('./ui/screens/SongScreens').then((m) => ({ default: m.SongPracticeScreen })))
const ProgressScreen = lazy(() => import('./ui/screens/ProgressScreen').then((m) => ({ default: m.ProgressScreen })))
const SessionScreen = lazy(() => import('./ui/screens/SessionScreen').then((m) => ({ default: m.SessionScreen })))
const SettingsScreen = lazy(() => import('./ui/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })))

const TABS = [
  { to: '/', label: 'Today', icon: '☀' },
  { to: '/learn', label: 'Learn', icon: '♪' },
  { to: '/ear', label: 'Ear', icon: '◉' },
  { to: '/songs', label: 'Songs', icon: '♫' },
  { to: '/progress', label: 'Progress', icon: '↗' },
]

function Layout() {
  const location = useLocation()
  const inSetup = location.pathname.startsWith('/setup')
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-stage/85 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <NavLink to="/" className="text-lg font-bold tracking-tight">
            Harmony<span className="text-spot">Lab</span>
          </NavLink>
          {!inSetup && (
            <nav className="hidden gap-1 md:flex" aria-label="Main">
              {TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.to === '/'}
                  className={({ isActive }) =>
                    `min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          )}
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) => `flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xl ${isActive ? 'bg-surface-2' : 'text-muted hover:text-ink'}`}
          >
            ⚙
          </NavLink>
        </div>
      </header>
      <main className="flex-1 pb-24 md:pb-8">
        <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      {!inSetup && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-stage/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Main"
        >
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'text-spot' : 'text-muted'}`
              }
            >
              <span aria-hidden className="text-lg leading-none">
                {t.icon}
              </span>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

/** Sends first-time visitors to setup. */
function RequireSetup({ children }: { children: React.ReactNode }) {
  const onboarded = useProfile((s) => s.profile.onboarded)
  return onboarded ? <>{children}</> : <Navigate to="/welcome" replace />
}

// Hash routing works on any static host (GitHub Pages) without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        element: (
          <RequireSetup>
            <HomeScreen />
          </RequireSetup>
        ),
      },
      { path: '/welcome', element: <HomeScreen welcome /> },
      { path: '/setup', element: <SetupScreen /> },
      { path: '/practice', element: <PracticeScreen /> },
      { path: '/learn', element: <LearnScreen /> },
      { path: '/learn/:level', element: <LevelScreen /> },
      { path: '/learn/:level/:drill', element: <DrillScreen /> },
      { path: '/ear', element: <EarScreen /> },
      { path: '/ear/:drill', element: <EarDrillScreen /> },
      { path: '/songs', element: <SongsScreen /> },
      { path: '/songs/new', element: <NewSongScreen /> },
      { path: '/songs/:id', element: <SongEditScreen /> },
      { path: '/songs/:id/practice', element: <SongPracticeScreen /> },
      { path: '/progress', element: <ProgressScreen /> },
      { path: '/session', element: <SessionScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  const loadSettings = useSettings((s) => s.load)
  const settingsLoaded = useSettings((s) => s.loaded)
  const loadProfile = useProfile((s) => s.load)
  const profileLoaded = useProfile((s) => s.loaded)
  useEffect(() => {
    void loadSettings()
    void loadProfile()
  }, [loadSettings, loadProfile])
  if (!settingsLoaded || !profileLoaded) return null
  return <RouterProvider router={router} />
}
