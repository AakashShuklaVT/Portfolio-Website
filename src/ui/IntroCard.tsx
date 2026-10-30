import { profile } from '../config/profile'
import { travelTo } from '../stations/travel'
import { useRideStore } from '../store/useRideStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconArrow } from './icons'

export function IntroCard() {
  const state = useRideStore((s) => s.state)
  const ready = useWorldStore((s) => !!s.derived)
  const stations = useWorldStore((s) => s.derived?.stations)
  const togglePopover = useUiStore((s) => s.togglePopover)
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  if (state !== 'INTRO' || !ready || !stations?.length) return null

  return (
    <section className="intro-card" aria-labelledby="intro-title">
      <p className="eyebrow">Welcome to {profile.siteName}</p>
      <h1 id="intro-title">{profile.name}</h1>
      <p className="intro-roles">{profile.roles.join(' · ')}</p>
      <p className="intro-copy">{profile.tagline} Hop on the little train and ride around the island. Every station holds a piece of my work.</p>
      <div className="intro-actions">
        <button className="btn btn-primary btn-lg" onClick={() => travelTo(stations[0].def.id)}>
          Board the train <IconArrow />
        </button>
        <button className="btn btn-ghost" onClick={() => togglePopover('route')}>
          Jump to a stop
        </button>
      </div>
      <p className="hint">
        You can hop off anywhere and stay as long as you like. In a hurry?{' '}
        <button className="link" onClick={() => setLiteOpen(true)}>
          Skip to the simple version
        </button>
        .
      </p>
    </section>
  )
}
