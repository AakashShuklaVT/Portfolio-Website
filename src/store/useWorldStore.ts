import { create } from 'zustand'
import { buildDerivedWorld, type DerivedWorld } from '../world/buildWorld'
import { createDefaultWorld } from '../world/defaultWorld'
import { autoScatter } from '../world/autoScatter'
import { autoProps } from '../world/autoProps'
import type { WorldData } from '../world/types'
import { flags } from '../core/flags'

interface WorldState {
  world: WorldData | null
  derived: DerivedWorld | null
  /** Bumped whenever the derived terrain/track is rebuilt. */
  revision: number
  load: () => Promise<void>
  setWorld: (world: WorldData) => void
}

const needsRebuild = (a: WorldData | null, b: WorldData) =>
  !a || a.terrain !== b.terrain || a.track !== b.track || a.stations !== b.stations

export const useWorldStore = create<WorldState>((set, get) => ({
  world: null,
  derived: null,
  revision: 0,
  load: async () => {
    let world: WorldData
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/world.json`, { cache: flags.edit ? 'no-cache' : 'default' })
      if (!res.ok) throw new Error(String(res.status))
      world = (await res.json()) as WorldData
    } catch {
      world = createDefaultWorld()
    }
    // A fresh world gets an automatic forest and station props; saved worlds keep their own.
    if (!world.scatter.length || !world.props.length) {
      const derived = buildDerivedWorld(world)
      world = {
        ...world,
        scatter: world.scatter.length ? world.scatter : autoScatter(world, derived),
        props: world.props.length ? world.props : autoProps(derived),
      }
      set({ world, derived, revision: get().revision + 1 })
      return
    }
    get().setWorld(world)
  },
  setWorld: (world) => {
    const prev = get().world
    if (needsRebuild(prev, world)) {
      set({ world, derived: buildDerivedWorld(world), revision: get().revision + 1 })
    } else {
      set({ world })
    }
  },
}))
