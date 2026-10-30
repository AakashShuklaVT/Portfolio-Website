import { create } from 'zustand'

interface SettingsState {
  reducedMotion: boolean
  sound: boolean
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

function save(state: Pick<SettingsState, 'reducedMotion' | 'sound'>) {
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
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    save({ reducedMotion, sound: get().sound })
  },
  setSound: (sound) => set({ sound }),
}))
