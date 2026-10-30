import { create } from 'zustand'
import type { Backend, QualitySettings } from '../core/quality'

interface AppState {
  backend: Backend
  quality: QualitySettings | null
  loaded: boolean
  setRenderInfo: (backend: Backend, quality: QualitySettings) => void
  setLoaded: (loaded: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  backend: 'pending',
  quality: null,
  loaded: false,
  setRenderInfo: (backend, quality) => set({ backend, quality }),
  setLoaded: (loaded) => set({ loaded }),
}))
