import { create } from 'zustand'

export type RideState = 'INTRO' | 'IDLE_AT_STATION' | 'DEPARTING' | 'RIDING' | 'ARRIVING' | 'FAST_TRAVEL'

interface RideStore {
  state: RideState
  /** Station the train is stopped at (or last left). */
  currentStation: string | null
  targetStation: string | null
  overlayOpen: boolean
  /** The engine is between the portal gates. */
  inWarp: boolean
  /** Board: leave the overview and arrive at the first station. */
  board: (firstStation: string) => void
  depart: (target: string, fast?: boolean) => void
  setState: (state: RideState) => void
  arrive: (station: string) => void
  setOverlayOpen: (open: boolean) => void
  setInWarp: (inWarp: boolean) => void
}

export const useRideStore = create<RideStore>((set, get) => ({
  state: 'INTRO',
  currentStation: null,
  targetStation: null,
  overlayOpen: false,
  inWarp: false,
  board: (firstStation) => set({ state: 'ARRIVING', currentStation: firstStation, targetStation: firstStation }),
  depart: (target, fast = false) => {
    const { currentStation, state } = get()
    if (target === currentStation && state === 'IDLE_AT_STATION') return
    set({ state: fast ? 'FAST_TRAVEL' : 'DEPARTING', targetStation: target, overlayOpen: false })
  },
  setState: (state) => set({ state }),
  arrive: (station) => set({ state: 'IDLE_AT_STATION', currentStation: station, targetStation: null, overlayOpen: true }),
  setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
  setInWarp: (inWarp) => set({ inWarp }),
}))
