import { createNoise2D, fbm, mulberry32 } from '../lib/noise'
import { smoothstep } from '../lib/math'
import type { DerivedWorld } from './buildWorld'
import type { ScatterLayer, WorldData } from './types'

interface Rule {
  model: string
  /** Base chance per candidate point. */
  chance: number
  minHeight: number
  maxHeight: number
  /** Minimum ground normal.y (1 = flat). */
  minFlat: number
  maxFlat?: number
  /** Minimum distance from the railway and station pads. */
  clearance: number
  scale: [number, number]
  /** 0 = ignore, 1 = only inside noise clumps (forests). */
  clump: number
}

const RULES: Rule[] = [
  { model: 'pine', chance: 0.55, minHeight: 4, maxHeight: 30, minFlat: 0.8, clearance: 4.5, scale: [0.8, 1.25], clump: 1 },
  { model: 'pine-tall', chance: 0.25, minHeight: 6, maxHeight: 26, minFlat: 0.82, clearance: 5, scale: [0.85, 1.2], clump: 1 },
  { model: 'round-tree', chance: 0.18, minHeight: 2.6, maxHeight: 16, minFlat: 0.85, clearance: 4.5, scale: [0.8, 1.2], clump: 0.6 },
  { model: 'bush', chance: 0.12, minHeight: 2.4, maxHeight: 28, minFlat: 0.75, clearance: 3.2, scale: [0.7, 1.3], clump: 0.3 },
  { model: 'flowers', chance: 0.06, minHeight: 2.4, maxHeight: 22, minFlat: 0.88, clearance: 3, scale: [0.8, 1.2], clump: 0 },
  { model: 'rock', chance: 0.07, minHeight: 1.5, maxHeight: 30, minFlat: 0.45, maxFlat: 0.8, clearance: 3, scale: [0.6, 1.6], clump: 0 },
  { model: 'rock-dark', chance: 0.05, minHeight: -1, maxHeight: 2.2, minFlat: 0.6, clearance: 3, scale: [0.6, 1.4], clump: 0 },
]

const SPACING = 2.1

/** Fills the island with forests, bushes and rocks. Deterministic for a seed. */
export function autoScatter(world: WorldData, derived: DerivedWorld): ScatterLayer[] {
  const { heightfield: hf } = derived
  const rand = mulberry32(world.terrain.seed * 977)
  const forestNoise = createNoise2D(world.terrain.seed + 101)
  const layers = new Map<string, number[]>(RULES.map((r) => [r.model, []]))
  const R = world.terrain.radius * 1.05

  for (let z = -R; z <= R; z += SPACING) {
    for (let x = -R; x <= R; x += SPACING) {
      const px = x + (rand() - 0.5) * SPACING * 0.9
      const pz = z + (rand() - 0.5) * SPACING * 0.9
      if (Math.hypot(px, pz) < 5) continue // keep the summit clear for the lighthouse
      const h = hf.heightAt(px, pz)
      const flat = hf.normalYAt(px, pz)
      const clear = hf.clearanceAt(px, pz)
      const forest = smoothstep(-0.05, 0.35, fbm(forestNoise, px * 0.045, pz * 0.045, 2))
      const roll = rand()
      let acc = 0
      for (const rule of RULES) {
        if (h < rule.minHeight || h > rule.maxHeight) continue
        if (flat < rule.minFlat || (rule.maxFlat !== undefined && flat > rule.maxFlat)) continue
        if (clear < rule.clearance) continue
        const density = rule.chance * (1 - rule.clump + rule.clump * forest)
        acc += density
        if (roll < acc * 0.6) {
          const s = rule.scale[0] + rand() * (rule.scale[1] - rule.scale[0])
          const sink = rule.model.startsWith('rock') ? 0.35 * s : 0.05
          layers.get(rule.model)!.push(+px.toFixed(2), +(h - sink).toFixed(2), +pz.toFixed(2), +(rand() * Math.PI * 2).toFixed(2), +s.toFixed(2))
          break
        }
      }
    }
  }
  return [...layers.entries()].filter(([, v]) => v.length).map(([model, instances]) => ({ id: model, model, instances }))
}
