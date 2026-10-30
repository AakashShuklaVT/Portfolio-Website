import { useEffect, useRef } from 'react'
import { profile } from '../config/profile'
import { CONTENT } from '../stations/content'
import { travelTo } from '../stations/travel'
import { useAppStore } from '../store/useAppStore'
import { useRideStore } from '../store/useRideStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useUiStore } from '../store/useUiStore'
import { useWorldStore } from '../store/useWorldStore'
import { IconMap, IconSettings } from './icons'
import { pad2, stagger } from './Words'
import type { TimeOfDay } from '../world/timeOfDay'

/** Top bar: wordmark on the left, one glass pill of controls on the right. */
export function Hud() {
  const state = useRideStore((s) => s.state)
  const popover = useUiStore((s) => s.popover)
  const togglePopover = useUiStore((s) => s.togglePopover)
  const closePopover = useUiStore((s) => s.closePopover)
  const sound = useSettingsStore((s) => s.sound)
  const setSound = useSettingsStore((s) => s.setSound)
  const stops = useWorldStore((s) => s.derived?.stations.length ?? 0)
  const loaded = useAppStore((s) => s.loaded)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePopover()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePopover])

  // A tap or click anywhere outside the open popover (the 3D scene included) closes it.
  // Buttons that toggle a popover are left alone so they can close it themselves.
  useEffect(() => {
    if (!popover) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest('.popover, [data-popover-toggle]')) return
      closePopover()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [popover, closePopover])

  if (!loaded) return null
  return (
    <header className={`hud ${state === 'INTRO' ? 'hud-intro' : ''}`}>
      <div className="wordmark">
        <strong>{profile.name}</strong>
        <span className="label">{profile.role}</span>
      </div>
      <nav className="controls fade-up" style={stagger(0, 900)} aria-label="Island controls">
        <button className="icon-btn" aria-label={sound ? 'Mute sound' : 'Turn sound on'} aria-pressed={sound} onClick={() => setSound(!sound)}>
          <span className={`eq ${sound ? 'on' : ''}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        <button className="icon-btn" data-popover-toggle aria-label="Settings" aria-expanded={popover === 'settings'} onClick={() => togglePopover('settings')}>
          <IconSettings />
        </button>
        <span className="divider" aria-hidden="true" />
        <button className="route-btn" data-popover-toggle aria-expanded={popover === 'route'} aria-label="Route map" onClick={() => togglePopover('route')}>
          <span className="route-text">Route</span>
          <span className="label">{pad2(stops)} stops</span>
          <IconMap />
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
      <p className="label">Route · tap a stop to go express</p>
      <ol>
        {stations.map((s, i) => {
          const here = state === 'IDLE_AT_STATION' && s.def.id === current
          const heading = s.def.id === target
          return (
            <li key={s.def.id} className={`${here ? 'here' : ''} ${heading ? 'heading' : ''}`} style={stagger(i)}>
              <button
                onClick={() => {
                  travelTo(s.def.id)
                  closePopover()
                }}
                aria-current={here ? 'location' : undefined}
              >
                <span className="stop-dot" aria-hidden="true" />
                <span className="stop-name">
                  <span className="label">
                    {pad2(i + 1)} · {CONTENT[s.def.contentId]?.label}
                  </span>
                  <strong>{s.def.name}</strong>
                </span>
                <span className="label label-accent">{here ? 'Here' : heading ? 'Next' : ''}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const TIMES: [TimeOfDay, string][] = [
  ['day', 'Day'],
  ['sunset', 'Dusk'],
  ['night', 'Night'],
  ['auto', 'Local'],
]

function Settings() {
  const reduced = useSettingsStore((s) => s.reducedMotion)
  const setReduced = useSettingsStore((s) => s.setReducedMotion)
  const backend = useAppStore((s) => s.backend)
  const tier = useAppStore((s) => s.quality?.tier)
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  const timeOfDay = useSettingsStore((s) => s.timeOfDay)
  const setTimeOfDay = useSettingsStore((s) => s.setTimeOfDay)
  return (
    <div className="popover settings" role="dialog" aria-label="Settings">
      <fieldset className="segmented">
        <legend className="label">Time of day</legend>
        {TIMES.map(([value, label]) => (
          <label key={value} className={timeOfDay === value ? 'on' : ''}>
            <input type="radio" name="time-of-day" value={value} checked={timeOfDay === value} onChange={() => setTimeOfDay(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="toggle">
        <span>Reduced motion</span>
        <input type="checkbox" role="switch" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
      </label>
      <div className="settings-foot">
        <button className="link small" onClick={() => setLiteOpen(true)}>
          Simple version
        </button>
        <span className="label">
          {backend === 'webgpu' ? 'WebGPU' : backend === 'webgl' ? 'WebGL 2' : '…'} · tier {tier ?? '-'}
        </span>
      </div>
    </div>
  )
}
