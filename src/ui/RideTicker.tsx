import { useEffect, useRef } from 'react'
import { trainRuntime } from '../rail/trainRuntime'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconSkip } from './icons'

/** While the train moves: where it is heading, a live route line, and a skip. */
export function RideTicker() {
  const state = useRideStore((s) => s.state)
  const targetId = useRideStore((s) => s.targetStation)
  const inWarp = useRideStore((s) => s.inWarp)
  const stations = useWorldStore((s) => s.derived?.stations)
  const track = useWorldStore((s) => s.derived?.track)
  const fill = useRef<HTMLSpanElement>(null)
  const train = useRef<HTMLSpanElement>(null)
  const moving = state === 'DEPARTING' || state === 'RIDING' || state === 'ARRIVING' || state === 'FAST_TRAVEL'
  const target = stations?.find((s) => s.def.id === targetId)
  const origin = stations?.[0]?.distance ?? 0

  // The line is the whole loop from the first station; the train is read every animation frame.
  useEffect(() => {
    if (!moving || !track) return
    let raf = 0
    const tick = () => {
      const p = track.ahead(origin, trainRuntime.distance) / track.length
      if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`
      if (train.current) train.current.style.left = `${(p * 100).toFixed(2)}%`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [moving, track, origin])

  if (!moving || !target || !stations || !track) return null
  const fast = state === 'FAST_TRAVEL'
  const here = track.ahead(origin, trainRuntime.distance) / track.length
  const phase = inWarp ? 'Through the portal' : fast ? 'Express to' : state === 'ARRIVING' ? 'Arriving at' : 'Next stop'

  return (
    <div className="ticker" role="status" aria-live="polite">
      <div className="ticker-text">
        <span className="label label-accent">{phase}</span>
        <strong>{target.def.name}</strong>
      </div>
      <div className="route-line" aria-hidden="true">
        <span className="track" />
        <span className="fill" ref={fill} />
        {stations.map((s) => {
          const p = track.ahead(origin, s.distance) / track.length
          const cls = s.def.id === target.def.id ? 'target' : p <= here ? 'passed' : ''
          return <span key={s.def.id} className={`dot ${cls}`} style={{ left: `${p * 100}%` }} />
        })}
        <span className="train" ref={train} />
      </div>
      {!fast && state !== 'ARRIVING' && !inWarp ? (
        <button className="btn btn-ghost btn-sm skip-btn" onClick={() => useRideStore.getState().depart(target.def.id, true)}>
          Skip <IconSkip />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}
