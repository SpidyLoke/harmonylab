// Settings: re-run setup steps, engine details, backup, reset.

import { Link } from 'react-router'
import { db } from '../../db/schema'
import { midiToDisplayName } from '../../music/notes'
import { useProfile } from '../../state/profile'
import { useSettings } from '../../state/settings'
import { BackupPanel } from '../components/BackupPanel'
import { Button } from '../components/Button'
import { DebugPanel } from '../components/DebugPanel'
import { MicGate } from '../components/MicGate'

export function SettingsScreen() {
  const profile = useProfile((s) => s.profile)
  const loadProfile = useProfile((s) => s.load)
  const showDebug = useSettings((s) => s.showDebug)
  const update = useSettings((s) => s.update)

  const rows = [
    {
      label: 'Vocal range',
      value: profile.rangeLow !== null && profile.rangeHigh !== null ? `${midiToDisplayName(profile.rangeLow)} to ${midiToDisplayName(profile.rangeHigh)}` : 'Not measured',
      step: 'range',
    },
    {
      label: 'Timing delay',
      value: profile.latencyMethod === 'none' ? 'Not measured' : `${profile.latencyMs} ms (${profile.latencyMethod} test)`,
      step: 'latency',
    },
    {
      label: 'Headphones',
      value: { ok: 'Checked, all clear', bleed: 'Mic could hear the guide', unchecked: 'Not checked' }[profile.headphones],
      step: 'headphones',
    },
    { label: 'Starting level', value: profile.placementLevel ? `Level ${profile.placementLevel}` : 'Not placed', step: 'placement' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="pt-4 text-2xl font-bold">Settings</h1>
      <section className="mt-4 divide-y divide-line rounded-3xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.step} className="flex min-h-16 items-center gap-3 px-5 py-3">
            <span className="flex-1">
              <span className="block font-medium">{r.label}</span>
              <span className="block text-sm text-muted">{r.value}</span>
            </span>
            <Link to={`/setup?step=${r.step}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">
              Redo
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Engine details</h2>
        <p className="mt-1 text-sm text-muted">Live numbers from the pitch engine, and the noise filter. Handy when testing a new device.</p>
        <Button className="mt-3" onClick={() => update({ showDebug: !showDebug })} aria-expanded={showDebug}>
          {showDebug ? 'Hide' : 'Show'} engine details
        </Button>
        {showDebug && (
          <div className="mt-3">
            <MicGate>
              <DebugPanel />
            </MicGate>
          </div>
        )}
      </section>

      <BackupPanel />

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Privacy</h2>
        <p className="mt-1 text-sm text-muted">
          HarmonyLab runs entirely in your browser. The microphone is analysed on this device and thrown away as you
          sing; nothing is recorded to a server, and there is no account. Your progress and songs are stored in this
          browser only.
        </p>
        <Button
          variant="ghost"
          className="mt-3 text-bad"
          onClick={async () => {
            if (!confirm('Delete all your progress, songs and settings on this device? Export a backup first if you want to keep them.')) return
            await db.delete()
            await db.open()
            await loadProfile()
            location.hash = '#/welcome'
          }}
        >
          Delete all my data
        </Button>
      </section>
      <p className="mt-6 text-center text-xs text-muted">HarmonyLab {__APP_VERSION__}</p>
    </div>
  )
}
