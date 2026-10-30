import { useEffect, useRef } from 'react'
import { profile } from '../config/profile'
import { CONTENT } from '../stations/content'
import { travelTo } from '../stations/travel'
import { useAppStore } from '../store/useAppStore'
import { useRideStore } from '../store/useRideStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconMap, IconSettings, IconSoundOff, IconSoundOn } from './icons'

/** Top bar: name, route map, sound and settings. */
export function Hud() {
  const state = useRideStore((s) => s.state)
  const popover = useUiStore((s) => s.popover)
  const togglePopover = useUiStore((s) => s.togglePopover)
  const closePopover = useUiStore((s) => s.closePopover)
  const sound = useSettingsStore((s) => s.sound)
  const setSound = useSettingsStore((s) => s.setSound)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePopover()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePopover])

  return (
    <header className={`hud ${state === 'INTRO' ? 'hud-intro' : ''}`}>
      <div className="brand">
        <span className="brand-dot" aria-hidden="true" />
        <span>
          <strong>{profile.name}</strong>
          <span className="brand-role">{profile.role}</span>
        </span>
      </div>
      <nav className="hud-actions" aria-label="Island controls">
        <button className="icon-btn" aria-label={sound ? 'Mute sound' : 'Turn sound on'} aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? <IconSoundOn /> : <IconSoundOff />}
        </button>
        <button className="icon-btn" aria-label="Settings" aria-expanded={popover === 'settings'} onClick={() => togglePopover('settings')}>
          <IconSettings />
        </button>
        <button className="btn btn-route" aria-expanded={popover === 'route'} onClick={() => togglePopover('route')}>
          <IconMap /> <span>Route map</span>
        </button>
      </nav>
      {popover === 'route' && <RouteMap />}
      {popover === 'settings' && <Settings />}
    </header>
  )
}

function RouteMap() {
  const stations = useWorldStore((s) => s.derived?.stations) ?? []
  const current = useRideStore((s) => s.currentStation)
  const target = useRideStore((s) => s.targetStation)
  const state = useRideStore((s) => s.state)
  const closePopover = useUiStore((s) => s.closePopover)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.querySelector<HTMLButtonElement>('button')?.focus(), [])

  return (
    <div className="popover route-map" ref={ref} role="dialog" aria-label="Route map">
      <p className="eyebrow">Route map · tap a stop to travel express</p>
      <ol>
        {stations.map((s) => {
          const here = state === 'IDLE_AT_STATION' && s.def.id === current
          const heading = s.def.id === target
          return (
            <li key={s.def.id} className={`${here ? 'here' : ''} ${heading ? 'heading' : ''}`}>
              <button
                onClick={() => {
                  travelTo(s.def.id)
                  closePopover()
                }}
                aria-current={here ? 'location' : undefined}
              >
                <span className="stop-dot" aria-hidden="true" />
                <span className="stop-name">{s.def.name}</span>
                <span className="stop-label">{here ? 'You are here' : heading ? 'Heading here' : CONTENT[s.def.contentId]?.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Settings() {
  const reduced = useSettingsStore((s) => s.reducedMotion)
  const setReduced = useSettingsStore((s) => s.setReducedMotion)
  const backend = useAppStore((s) => s.backend)
  const tier = useAppStore((s) => s.quality?.tier)
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  return (
    <div className="popover settings" role="dialog" aria-label="Settings">
      <label className="toggle">
        <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
        <span>Reduced motion</span>
      </label>
      <button className="btn btn-ghost" onClick={() => setLiteOpen(true)}>
        Open the simple HTML version
      </button>
      <p className="muted small">
        Renderer: {backend === 'webgpu' ? 'WebGPU' : backend === 'webgl' ? 'WebGL 2 (fallback)' : '…'} · quality tier {tier ?? '-'}
      </p>
    </div>
  )
}
