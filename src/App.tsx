import { useEffect } from 'react'
import { createHashRouter, NavLink, Outlet, RouterProvider } from 'react-router'
import { useSettings } from './state/settings'
import { HomeScreen } from './ui/screens/HomeScreen'
import { PracticeScreen } from './ui/screens/PracticeScreen'

function Layout() {
  return (
    <div className="flex min-h-screen flex-col pb-[env(safe-area-inset-bottom)]">
      <nav className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <NavLink to="/" className="text-lg font-bold tracking-tight">
          Harmony<span className="text-spot">Lab</span>
        </NavLink>
        <NavLink
          to="/practice"
          className={({ isActive }) =>
            `min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-surface-2 text-ink' : 'text-muted'}`
          }
        >
          Practise
        </NavLink>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

// Hash routing works on any static host (GitHub Pages) without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/practice', element: <PracticeScreen /> },
    ],
  },
])

export default function App() {
  const load = useSettings((s) => s.load)
  const loaded = useSettings((s) => s.loaded)
  useEffect(() => {
    void load()
  }, [load])
  if (!loaded) return null
  return <RouterProvider router={router} />
}
