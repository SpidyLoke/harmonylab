// Accuracy over time: one series, so no legend box (the heading names it).
// 2px line, 8px markers with a surface ring, 10% area wash, hairline grid,
// crosshair + tooltip on hover/touch, and a table view for screen readers.

import { useEffect, useRef, useState } from 'react'
import type { DayAccuracy } from '../../progress/stats'

const H = 220
const PAD = { l: 40, r: 16, t: 14, b: 28 }
const LINE = '#f5c451'
const SURFACE = '#13131b'
const GRID = '#2a2a3a'
const INK_MUTED = '#9a9ab2'

const shortDate = (day: string) => {
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function TrendChart({ data }: { data: DayAccuracy[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  // Draw at the real width so text stays readable on phones.
  const box = useRef<HTMLElement>(null)
  const [W, setW] = useState(640)
  const empty = data.length === 0
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [empty])
  if (empty) {
    return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Sing a few takes and your accuracy trend shows up here.</p>
  }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => PAD.t + ih - (v / 100) * ih
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.accuracy).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const last = data[data.length - 1]

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    })
    setHover(best)
  }

  const h = hover !== null ? data[hover] : null
  return (
    <figure className="relative" ref={box}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`Accuracy trend over ${data.length} practice days, latest ${Math.round(last.accuracy)}% in tune`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
              {v}%
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(80)} y2={y(80)} stroke="#4a4a60" strokeWidth={1} />
        <text x={PAD.l + 4} y={y(80) - 4} fontSize={10} fill={INK_MUTED}>
          pass mark 80%
        </text>
        <path d={area} fill={LINE} opacity={0.1} />
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={d.day} cx={x(i)} cy={y(d.accuracy)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
        ))}
        <text x={x(data.length - 1)} y={y(last.accuracy) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="#ececf3">
          {Math.round(last.accuracy)}%
        </text>
        <text x={x(0)} y={H - 8} fontSize={11} fill={INK_MUTED} textAnchor={data.length === 1 ? 'middle' : 'start'}>
          {shortDate(data[0].day)}
        </text>
        {data.length > 1 && (
          <text x={x(data.length - 1)} y={H - 8} fontSize={11} fill={INK_MUTED} textAnchor="end">
            {shortDate(last.day)}
          </text>
        )}
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#ececf3" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={x(hover)} cy={y(h.accuracy)} r={6} fill={LINE} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-105%' : '5%'})` }}
          role="status"
        >
          <div className="font-semibold">{shortDate(h.day)}</div>
          <div className="text-muted">
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: LINE }} />
            {Math.round(h.accuracy)}% in tune · {h.takes} take{h.takes > 1 ? 's' : ''}
          </div>
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">In tune</th>
              <th className="py-1 font-medium">Takes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1">{shortDate(d.day)}</td>
                <td className="py-1">{Math.round(d.accuracy)}%</td>
                <td className="py-1">{d.takes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
