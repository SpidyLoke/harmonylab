// Live engine numbers for testing on real devices: latency estimate, reading
// rate, and the noise gate thresholds you can tune while singing.

import { pitchEngine } from '../../audio/pitchEngine'
import { laneStats } from './laneStats'
import { useSettings } from '../../state/settings'
import { useLive } from './useLive'

function fmt(ms: number | null) {
  return ms === null ? 'not reported' : `${ms.toFixed(1)} ms`
}

export function DebugPanel() {
  const gate = useSettings((s) => s.gate)
  const update = useSettings((s) => s.update)
  const data = useLive(
    () => ({ lat: pitchEngine.latency(), f: pitchEngine.latest, sr: pitchEngine.sampleRate(), lane: { ...laneStats } }),
    6,
  )
  const { lat, f, sr, lane } = data
  const under = lat.totalMs < 50

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 text-sm" aria-label="Engine details">
      <h3 className="text-base font-semibold">Engine details</h3>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 tabular-nums">
        <dt className="text-muted">Mic hardware (browser-reported)</dt>
        <dd>{fmt(lat.inputMs)}</dd>
        <dt className="text-muted">Analysis window</dt>
        <dd>{fmt(lat.analysisMs)}</dd>
        <dt className="text-muted">Audio thread to screen</dt>
        <dd>{fmt(lat.deliveryMs)}</dd>
        <dt className="text-muted">Drawing</dt>
        <dd>{fmt(lat.drawMs)}</dd>
        <dt className="font-semibold">Estimated voice to screen</dt>
        <dd className={`font-semibold ${under ? 'text-good' : 'text-near'}`} data-testid="latency-total">
          {under ? '✓ ' : '▲ '}
          {lat.totalMs.toFixed(0)} ms{lat.inputMs === null ? ' + mic' : ''}
        </dd>
        <dt className="text-muted">Readings per second</dt>
        <dd data-testid="readings-per-second">{lat.readingsPerSecond}</dd>
        <dt className="text-muted">Sample rate</dt>
        <dd>{sr ? `${sr} Hz` : 'n/a'}</dd>
        <dt className="text-muted">Raw pitch</dt>
        <dd>{f && f.rawHz > 0 ? `${f.rawHz.toFixed(1)} Hz` : 'n/a'}</dd>
        <dt className="text-muted">Clarity</dt>
        <dd>{f ? f.clarity.toFixed(2) : 'n/a'}</dd>
        <dt className="text-muted">Loudness</dt>
        <dd>{f && Number.isFinite(f.db) ? `${f.db.toFixed(0)} dB` : 'n/a'}</dd>
        <dt className="text-muted">Voice detected</dt>
        <dd>{f ? (f.midi !== null ? 'yes' : 'no') : 'n/a'}</dd>
        <dt className="text-muted">Lane size</dt>
        <dd data-testid="lane-size">
          {Math.round(lane.cssWidth)}×{Math.round(lane.cssHeight)} ({lane.pixelWidth}×{lane.pixelHeight} px, ×
          {lane.dpr})
        </dd>
        <dt className="text-muted">Lane frames drawn</dt>
        <dd data-testid="lane-frames">{lane.framesDrawn}</dd>
        <dt className="text-muted">Build</dt>
        <dd data-testid="build">{__APP_VERSION__}</dd>
      </dl>
      {lane.lastError && (
        <p className="mt-3 break-words font-mono text-xs text-bad" data-testid="lane-error">
          Lane error: {lane.lastError}
        </p>
      )}

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="flex justify-between">
            <span>Clarity needed to count as voice</span>
            <span className="tabular-nums">{gate.minClarity.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={gate.minClarity}
            onChange={(e) => update({ gate: { ...gate, minClarity: Number(e.target.value) } })}
            className="mt-2 w-full accent-[var(--color-spot)]"
          />
          <span className="text-xs text-muted">Higher ignores more breath and hiss, but can drop soft singing.</span>
        </label>
        <label className="block">
          <span className="flex justify-between">
            <span>Quietest sound that counts</span>
            <span className="tabular-nums">{gate.minDb} dB</span>
          </span>
          <input
            type="range"
            min={-80}
            max={-20}
            step={1}
            value={gate.minDb}
            onChange={(e) => update({ gate: { ...gate, minDb: Number(e.target.value) } })}
            className="mt-2 w-full accent-[var(--color-spot)]"
          />
          <span className="text-xs text-muted">Raise it in a noisy room.</span>
        </label>
      </div>
      <p className="mt-4 text-xs text-muted">
        The total is an estimate built from the parts above. Phase 2 adds a measured tap test for scoring.
      </p>
    </section>
  )
}
