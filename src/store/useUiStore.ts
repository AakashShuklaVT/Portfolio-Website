import { create } from 'zustand'

type Popover = 'route' | 'settings' | null

interface UiState {
  popover: Popover
  /** Full-page HTML version of the portfolio. */
  liteOpen: boolean
  /** Timestamp of the last "send a signal" so the lighthouse can flash. */
  signalAt: number
  togglePopover: (p: Exclude<Popover, null>) => void
  closePopover: () => void
  setLiteOpen: (open: boolean) => void
  sendSignal: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  popover: null,
  liteOpen: false,
  signalAt: 0,
  togglePopover: (p) => set({ popover: get().popover === p ? null : p }),
  closePopover: () => set({ popover: null }),
  setLiteOpen: (liteOpen) => set({ liteOpen, popover: null }),
  sendSignal: () => set({ signalAt: performance.now() }),
}))
