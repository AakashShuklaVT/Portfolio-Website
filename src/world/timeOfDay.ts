import { ATMOSPHERE_PRESETS } from './atmospherePresets'
import type { AtmosphereData } from './types'

export type TimeOfDay = 'day' | 'sunset' | 'night' | 'auto'

/** Smoothed 0 (day) .. 1 (night) value read by lights, windows and stars each frame. */
export const nightRuntime = { factor: 0 }

/** Maps the visitor's local clock to a time of day. */
export function localTimeOfDay(date = new Date()): Exclude<TimeOfDay, 'auto'> {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 6.5 && h < 17.5) return 'day'
  if ((h >= 17.5 && h < 19.5) || (h >= 5.5 && h < 6.5)) return 'sunset'
  return 'night'
}

export function resolveAtmosphere(mode: TimeOfDay, worldAtmosphere: AtmosphereData): { atmosphere: AtmosphereData; night: number } {
  const resolved = mode === 'auto' ? localTimeOfDay() : mode
  if (resolved === 'day') return { atmosphere: worldAtmosphere, night: 0 }
  return {
    atmosphere: { ...worldAtmosphere, ...ATMOSPHERE_PRESETS[resolved] },
    night: resolved === 'night' ? 1 : 0.35,
  }
}
