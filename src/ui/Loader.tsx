import { useEffect, useRef, useState } from 'react'
import { profile } from '../config/profile'
import { useAppStore } from '../store/useAppStore'
import { useWorldStore } from '../store/useWorldStore'
import { stagger } from './Words'

/**
 * Opening curtain: the name, a live counter and a hairline progress bar.
 * Progress follows real stages (renderer, world, shader warm-up); once the
 * island is ready the curtain lifts and the hero takes over.
 */
export function Loader() {
  const loaded = useAppStore((s) => s.loaded)
  const backend = useAppStore((s) => s.backend)
  const ready = useWorldStore((s) => !!s.derived)
  const [lifting, setLifting] = useState(false)
  const [gone, setGone] = useState(false)
  const count = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)

  const target = loaded ? 100 : ready && backend !== 'pending' ? 84 : ready ? 62 : backend !== 'pending' ? 38 : 16
  const status = loaded ? 'All aboard' : ready ? 'Warming up the engine' : 'Assembling the island'

  useEffect(() => {
    let raf = 0
    const tick = () => {
      shown.current += (target - shown.current) * 0.08
      if (target - shown.current < 0.4) shown.current = target
      const v = Math.round(shown.current)
      if (count.current) count.current.textContent = String(v).padStart(3, '0')
      if (bar.current) bar.current.style.transform = `scaleX(${shown.current / 100})`
      if (shown.current < target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  useEffect(() => {
    if (!loaded) return
    const lift = setTimeout(() => setLifting(true), 550)
    const hide = setTimeout(() => setGone(true), 1600)
    return () => {
      clearTimeout(lift)
      clearTimeout(hide)
    }
  }, [loaded])

  if (gone) return null
  const [first, ...rest] = profile.name.split(' ')
  return (
    <div className={`loader ${lifting ? 'loader-done' : ''}`} role="status" aria-live="polite" aria-label={status}>
      <div className="loader-top">
        <span className="label fade-up">{profile.siteName}</span>
        <span className="label fade-up" style={stagger(1)}>
          {profile.role}
        </span>
      </div>
      <h1 className="loader-name display" aria-hidden="true">
        <span className="reveal">
          <span style={stagger(0, 100)}>{first}</span>
        </span>
        <span className="reveal">
          <span style={stagger(1, 100)}>
            <em>{rest.join(' ')}</em>
          </span>
        </span>
      </h1>
      <div className="loader-bottom">
        <div className="loader-row">
          <span className="label">{status}</span>
          <span className="loader-count" ref={count}>
            000
          </span>
        </div>
        <div className="loader-bar">
          <span ref={bar} />
        </div>
      </div>
    </div>
  )
}
