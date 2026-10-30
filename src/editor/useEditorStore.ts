import { create } from 'zustand'
import { useWorldStore } from '../store/useWorldStore'
import type { WorldData } from '../world/types'

export type Tool = 'select' | 'place' | 'scatter' | 'erase' | 'track' | 'station'
export type GizmoMode = 'translate' | 'rotate' | 'scale'
export type Selection =
  | { kind: 'prop'; id: string }
  | { kind: 'station'; id: string }
  | { kind: 'trackPoint'; index: number }
  | null

export interface BrushSettings {
  model: string
  radius: number
  /** Instances per stamp. */
  density: number
  scaleMin: number
  scaleMax: number
  randomRotation: boolean
  /** Minimum ground normal.y (1 = flat only). */
  minFlat: number
  minHeight: number
  maxHeight: number
  /** Minimum spacing between instances. */
  spacing: number
}

export interface PlaceSettings {
  randomRotation: boolean
  scaleMin: number
  scaleMax: number
  alignToNormal: boolean
}

const HISTORY_LIMIT = 120
const AUTOSAVE_KEY = 'portfolio-island:world-autosave'

interface EditorState {
  tool: Tool
  gizmo: GizmoMode
  selection: Selection
  placeModel: string
  place: PlaceSettings
  brush: BrushSettings
  snapToGrid: boolean
  snapToTerrain: boolean
  past: WorldData[]
  future: WorldData[]
  dirty: boolean
  status: string
  setTool: (tool: Tool) => void
  setGizmo: (g: GizmoMode) => void
  select: (s: Selection) => void
  setPlaceModel: (id: string) => void
  setPlace: (p: Partial<PlaceSettings>) => void
  setBrush: (b: Partial<BrushSettings>) => void
  setSnap: (s: Partial<{ snapToGrid: boolean; snapToTerrain: boolean }>) => void
  /** Snapshot the current world so the next change(s) can be undone as one step. */
  checkpoint: () => void
  /** Apply a change. With `history`, it becomes its own undo step. */
  commit: (update: (w: WorldData) => WorldData, history?: boolean) => void
  undo: () => void
  redo: () => void
  setStatus: (status: string) => void
  markSaved: () => void
}

let autosaveTimer = 0
const autosave = () => {
  window.clearTimeout(autosaveTimer)
  autosaveTimer = window.setTimeout(() => {
    const world = useWorldStore.getState().world
    if (!world) return
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: Date.now(), world }))
    } catch {
      // storage full or unavailable; the explicit save still works
    }
  }, 800)
}

export function readAutosave(): { savedAt: number; world: WorldData } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tool: 'select',
  gizmo: 'translate',
  selection: null,
  placeModel: 'pine',
  place: { randomRotation: true, scaleMin: 0.9, scaleMax: 1.15, alignToNormal: false },
  brush: { model: 'pine', radius: 6, density: 3, scaleMin: 0.8, scaleMax: 1.25, randomRotation: true, minFlat: 0.75, minHeight: 1.6, maxHeight: 40, spacing: 1.6 },
  snapToGrid: false,
  snapToTerrain: true,
  past: [],
  future: [],
  dirty: false,
  status: '',
  setTool: (tool) => set({ tool, selection: tool === 'select' || tool === 'track' || tool === 'station' ? get().selection : null }),
  setGizmo: (gizmo) => set({ gizmo }),
  select: (selection) => set({ selection }),
  setPlaceModel: (placeModel) => set({ placeModel }),
  setPlace: (p) => set({ place: { ...get().place, ...p } }),
  setBrush: (b) => set({ brush: { ...get().brush, ...b } }),
  setSnap: (s) => set(s),
  checkpoint: () => {
    const world = useWorldStore.getState().world
    if (!world) return
    set({ past: [...get().past, world].slice(-HISTORY_LIMIT), future: [] })
  },
  commit: (update, history = true) => {
    const world = useWorldStore.getState().world
    if (!world) return
    if (history) set({ past: [...get().past, world].slice(-HISTORY_LIMIT), future: [] })
    useWorldStore.getState().setWorld(update(world))
    set({ dirty: true })
    autosave()
  },
  undo: () => {
    const { past, future } = get()
    const world = useWorldStore.getState().world
    if (!past.length || !world) return
    const prev = past[past.length - 1]
    set({ past: past.slice(0, -1), future: [world, ...future], dirty: true, status: 'Undo' })
    useWorldStore.getState().setWorld(prev)
    autosave()
  },
  redo: () => {
    const { past, future } = get()
    const world = useWorldStore.getState().world
    if (!future.length || !world) return
    const next = future[0]
    set({ past: [...past, world], future: future.slice(1), dirty: true, status: 'Redo' })
    useWorldStore.getState().setWorld(next)
    autosave()
  },
  setStatus: (status) => set({ status }),
  markSaved: () => set({ dirty: false }),
}))

/** Convenience: commit from outside React. */
export const commitWorld = (update: (w: WorldData) => WorldData, history = true) => useEditorStore.getState().commit(update, history)

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`
