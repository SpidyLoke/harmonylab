import { useEffect, useState } from 'react'

/** Re-renders at most `fps` times a second with a fresh value from `read`. For readouts, not the lane. */
export function useLive<T>(read: () => T, fps = 15): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick)
      if (ts - last < 1000 / fps) return
      last = ts
      setValue(read())
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps])
  return value
}
