import { profile } from '../config/profile'
import { travelTo } from '../stations/travel'
import { useAppStore } from '../store/useAppStore'
import { useRideStore } from '../store/useRideStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconArrow } from './icons'
import { stagger } from './Words'

/** The hero over the island overview: name, one line, one action. */
export function IntroCard() {
  const state = useRideStore((s) => s.state)
  const loaded = useAppStore((s) => s.loaded)
  const stations = useWorldStore((s) => s.derived?.stations)
  const togglePopover = useUiStore((s) => s.togglePopover)
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  if (state !== 'INTRO' || !loaded || !stations?.length) return null
  const [first, ...rest] = profile.name.split(' ')
  const D = 700

  return (
    <section className="intro" aria-labelledby="intro-title">
      <div className="intro-hero">
        <p className="label label-accent fade-up" style={stagger(0, D)}>
          (01) {profile.siteName}
        </p>
        <h1 id="intro-title" className="display">
          <span className="reveal">
            <span style={stagger(0, D + 60)}>{first}</span>
          </span>
          <span className="reveal">
            <span style={stagger(1, D + 60)}>
              <em>{rest.join(' ')}</em>
            </span>
          </span>
        </h1>
        <p className="intro-lede fade-up" style={stagger(3, D)}>
          {profile.tagline} Ride the train; every stop is a piece of my work.
        </p>
        <div className="intro-roles fade-up" style={stagger(4, D)}>
          {profile.roles.map((r) => (
            <span key={r} className="label">
              {r}
            </span>
          ))}
        </div>
        <div className="intro-actions fade-up" style={stagger(5, D)}>
          <button className="btn btn-primary" onClick={() => travelTo(stations[0].def.id)}>
            Board the train <IconArrow />
          </button>
          <button className="btn btn-ghost" data-popover-toggle onClick={() => togglePopover('route')}>
            Jump to a stop
          </button>
        </div>
      </div>
      <div className="intro-meta fade-up" style={stagger(7, D)}>
        <ul aria-label="Toolbox">
          {profile.skills.slice(0, 6).map((s) => (
            <li key={s} className="label">
              {s}
            </li>
          ))}
        </ul>
        <button className="link small" onClick={() => setLiteOpen(true)}>
          In a hurry? Simple version
        </button>
      </div>
    </section>
  )
}
