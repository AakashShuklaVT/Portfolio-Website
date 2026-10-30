import { useEffect, useRef } from 'react'
import { trainRuntime } from '../rail/trainRuntime'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconSkip } from './icons'

/** "Next stop" ticker with a live progress bar and a skip button while the train moves. */
export function RideTicker() {
  const state = useRideStore((s) => s.state)
  const targetId = useRideStore((s) => s.targetStation)
  const currentId = useRideStore((s) => s.currentStation)
  const inTunnel = useRideStore((s) => s.inTunnel)
  const stations = useWorldStore((s) => s.derived?.stations)
  const bar = useRef<HTMLSpanElement>(null)
  const moving = state === 'DEPARTING' || state === 'RIDING' || state === 'ARRIVING' || state === 'FAST_TRAVEL'
  const target = stations?.find((s) => s.def.id === targetId)
  const from = stations?.find((s) => s.def.id === currentId)

  // Progress is read from the train runtime each animation frame, outside React.
  useEffect(() => {
    if (!moving || !target) return
    const track = useWorldStore.getState().derived!.track
    const start = from?.distance ?? trainRuntime.distance
    const total = Math.max(1, track.ahead(start, target.distance))
    let raf = 0
    const tick = () => {
      const remaining = track.ahead(trainRuntime.distance, target.distance)
      const p = remaining > total ? 1 : 1 - remaining / total
      if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(4)})`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [moving, target, from])

  if (!moving || !target) return null
  const fast = state === 'FAST_TRAVEL'

  return (
    <div className="ticker" role="status" aria-live="polite">
      <div className="ticker-text">
        <span className="eyebrow">{inTunnel ? 'Through the mountain…' : fast ? 'Express to' : state === 'ARRIVING' ? 'Arriving at' : 'Next stop'}</span>
        <strong>{target.def.name}</strong>
      </div>
      <span className="ticker-bar" aria-hidden="true">
        <span ref={bar} />
      </span>
      {!fast && state !== 'ARRIVING' && (
        <button className="icon-btn" onClick={() => useRideStore.getState().depart(target.def.id, true)} aria-label="Skip the ride">
          <IconSkip />
        </button>
      )}
    </div>
  )
}
