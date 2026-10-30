import { useEffect, useRef } from 'react'
import { CONTENT } from '../stations/content'
import { nextStationId, travelTo } from '../stations/travel'
import { useRideStore } from '../store/useRideStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconArrow, IconClose, IconInfo } from './icons'
import { Sections } from './sections'

/** The station overlay: content for the current stop plus the "continue" controls. */
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

  const continueBtn = next && (
    <button className="btn btn-primary" onClick={() => travelTo(next.def.id, false)}>
      {next.index === 0 ? 'Ride back down to' : 'Continue to'} {next.def.name} <IconArrow />
    </button>
  )

  if (!overlayOpen) {
    return (
      <div className="panel-mini" role="region" aria-label="Station controls">
        <button className="btn" onClick={() => setOverlayOpen(true)}>
          <IconInfo /> {station.def.name}
        </button>
        {continueBtn}
      </div>
    )
  }

  return (
    <aside className="station-panel" aria-labelledby="station-title" key={station.def.id}>
      <header className="station-panel-head">
        <p className="eyebrow">
          Stop {station.index + 1} of {stations.length} · {station.def.name}
        </p>
        <h2 id="station-title" ref={headingRef} tabIndex={-1}>
          {content?.title ?? station.def.name}
        </h2>
        <button className="icon-btn panel-close" onClick={() => setOverlayOpen(false)} aria-label="Hide station info and look around">
          <IconClose />
        </button>
      </header>
      <div className="station-panel-body">
        {content ? (
          <>
            <p className="lead">{content.intro}</p>
            <Sections sections={content.sections} />
          </>
        ) : (
          <p className="muted">Content for “{station.def.contentId}” is on its way.</p>
        )}
      </div>
      <footer className="station-panel-foot">
        {continueBtn}
        <button className="btn btn-ghost" onClick={() => togglePopover('route')}>
          Pick another stop
        </button>
      </footer>
    </aside>
  )
}
