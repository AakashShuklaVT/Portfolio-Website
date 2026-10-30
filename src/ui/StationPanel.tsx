import { useEffect, useRef } from 'react'
import { CONTENT } from '../stations/content'
import { nextStationId, travelTo } from '../stations/travel'
import { useRideStore } from '../store/useRideStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconArrow, IconClose, IconInfo, IconMap } from './icons'
import { Sections } from './sections'
import { Words, pad2, stagger } from './Words'

/** The station sheet: a short editorial page for the current stop, plus the way on. */
export function StationPanel() {
  const stations = useWorldStore((s) => s.derived?.stations)
  const state = useRideStore((s) => s.state)
  const currentId = useRideStore((s) => s.currentStation)
  const overlayOpen = useRideStore((s) => s.overlayOpen)
  const setOverlayOpen = useRideStore((s) => s.setOverlayOpen)
  const togglePopover = useUiStore((s) => s.togglePopover)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const idle = state === 'IDLE_AT_STATION'
  const station = stations?.find((s) => s.def.id === currentId)
  const content = station ? CONTENT[station.def.contentId] : undefined
  const nextId = nextStationId(currentId)
  const next = stations?.find((s) => s.def.id === nextId)

  useEffect(() => {
    if (idle && overlayOpen) headingRef.current?.focus({ preventScroll: true })
  }, [idle, overlayOpen, currentId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && idle && overlayOpen) setOverlayOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idle, overlayOpen, setOverlayOpen])

  if (!idle || !station || !stations) return null
  const loopsBack = next?.index === 0

  if (!overlayOpen) {
    return (
      <div className="panel-mini" role="region" aria-label="Station controls">
        <button className="btn btn-glass" onClick={() => setOverlayOpen(true)}>
          <IconInfo /> {content?.label ?? station.def.name}
        </button>
        {next && (
          <button className="btn btn-primary" onClick={() => travelTo(next.def.id, false)}>
            {loopsBack ? 'Through the portal' : `Next: ${next.def.name}`} <IconArrow />
          </button>
        )}
      </div>
    )
  }

  return (
    <aside className="station-panel" aria-labelledby="station-title" key={station.def.id}>
      <header className="panel-head">
        <div className="label-row">
          <span className="label label-accent">
            Stop {pad2(station.index + 1)} / {pad2(stations.length)}
          </span>
          <span className="rule" aria-hidden="true" />
          <span className="label">{station.def.name}</span>
        </div>
        <h2 id="station-title" className="display" ref={headingRef} tabIndex={-1}>
          <Words text={content?.title ?? station.def.name} delay={450} />
        </h2>
        {content && (
          <p className="lead fade-up" style={stagger(2, 500)}>
            {content.intro}
          </p>
        )}
        <button className="icon-btn panel-close" onClick={() => setOverlayOpen(false)} aria-label="Hide the panel and look around">
          <IconClose />
        </button>
      </header>
      <div className="panel-body">{content && <Sections sections={content.sections} animate />}</div>
      <footer className="panel-foot">
        {next && (
          <button className="btn btn-primary" onClick={() => travelTo(next.def.id, false)}>
            <span className="next-label">
              <span className="label">{loopsBack ? 'Through the portal to' : 'Next stop'}</span>
              {next.def.name}
            </span>
            <IconArrow />
          </button>
        )}
        <button className="btn btn-ghost" data-popover-toggle onClick={() => togglePopover('route')} aria-label="Route map">
          <IconMap />
        </button>
      </footer>
    </aside>
  )
}
