import { create } from 'zustand'
import type { TimeOfDay } from '../world/timeOfDay'

interface SettingsState {
  reducedMotion: boolean
  sound: boolean
  timeOfDay: TimeOfDay
  setTimeOfDay: (t: TimeOfDay) => void
  setReducedMotion: (v: boolean) => void
  setSound: (v: boolean) => void
}

const KEY = 'portfolio-island:settings'

function loadSaved(): Partial<SettingsState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(state: Pick<SettingsState, 'reducedMotion' | 'timeOfDay'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage may be unavailable (private mode); settings stay in memory
  }
}

const saved = loadSaved()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  reducedMotion: saved.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // Sound is off until the visitor opts in.
  sound: false,
  timeOfDay: saved.timeOfDay ?? 'day',
  setTimeOfDay: (timeOfDay) => {
    set({ timeOfDay })
    save({ reducedMotion: get().reducedMotion, timeOfDay })
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    save({ reducedMotion, timeOfDay: get().timeOfDay })
  },
  setSound: (sound) => set({ sound }),
}))
