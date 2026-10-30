import { create } from 'zustand'

/** Tiny store shared by the app shell and the (lazy, dev-only) editor. */
interface EditorModeState {
  /** 'edit' shows editor tools; 'play' runs the visitor experience inside the editor. */
  mode: 'edit' | 'play'
  setMode: (mode: 'edit' | 'play') => void
  /** Makes the train loop continuously so the track can be felt while editing. */
  previewTrain: boolean
  setPreviewTrain: (v: boolean) => void
}

export const useEditorMode = create<EditorModeState>((set) => ({
  mode: 'edit',
  setMode: (mode) => set({ mode }),
  previewTrain: false,
  setPreviewTrain: (previewTrain) => set({ previewTrain }),
}))
