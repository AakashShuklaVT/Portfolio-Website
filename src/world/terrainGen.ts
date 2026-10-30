import { createNoise2D, fbm } from '../lib/noise'
import { clamp, lerp, smoothstep } from '../lib/math'
import type { TerrainParams } from './types'

export type HeightFn = (x: number, z: number) => number

const terrace = (h: number, step: number, flat: number) => {
  const k = h / step
  const f = Math.floor(k)
  return (f + smoothstep(flat, 1, k - f)) * step
}

/** Height of the untouched island (before the railway is carved in). */
export function createNaturalHeight(p: TerrainParams): HeightFn {
  const noise = createNoise2D(p.seed)
  const detailNoise = createNoise2D(p.seed + 17)
  return (x, z) => {
    const r = Math.hypot(x, z)
    const n = fbm(noise, x * p.noiseScale, z * p.noiseScale, 3)
    const rr = r / p.radius + n * p.noiseAmount
    const land = smoothstep(1.06, 0.93, rr)
    const mountain = p.peakHeight * Math.pow(clamp(1 - rr), p.profilePower)
    const detail = fbm(detailNoise, x * 0.12, z * 0.12, 2) * 0.35 * land
    return lerp(-6, 1.2, land) + terrace(mountain, p.terraceStep, p.terraceFlatness) + detail
  }
}

/** A flattening stamp: inside `inner` the ground is exactly `y`, fading out by `outer`. */
export interface Stamp {
  x: number
  z: number
  y: number
  inner: number
  outer: number
  /** 0..1 how much the stamp marks the ground as a path (gravel colour). */
  path: number
}

export interface Heightfield {
  extent: number
  res: number
  /** (res + 1)^2 heights, row-major in z then x. */
  heights: Float32Array
  /** Path mask per vertex, 0..1. */
  path: Float32Array
  /** Distance from each vertex to the nearest stamp centre (railway or station), capped. */
  clearance: Float32Array
  /** 1 where the terrain is cut away for a tunnel mouth (triangles touching it are not rendered). */
  cut: Uint8Array
  cell: number
  heightAt: (x: number, z: number) => number
  normalYAt: (x: number, z: number) => number
  clearanceAt: (x: number, z: number) => number
}

const CLEARANCE_CAP = 99

export function generateHeightfield(p: TerrainParams, natural: HeightFn, stamps: Stamp[]): Heightfield {
  const res = p.resolution
  const n = res + 1
  const extent = p.extent
  const cell = (extent * 2) / res
  const heights = new Float32Array(n * n)
  const path = new Float32Array(n * n)
  const weight = new Float32Array(n * n)
  const target = new Float32Array(n * n)
  const clearance = new Float32Array(n * n).fill(CLEARANCE_CAP)

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      heights[j * n + i] = natural(-extent + i * cell, -extent + j * cell)
    }
  }

  // Keep the strongest stamp per vertex.
  for (const s of stamps) {
    const i0 = Math.max(0, Math.floor((s.x - s.outer + extent) / cell))
    const i1 = Math.min(res, Math.ceil((s.x + s.outer + extent) / cell))
    const j0 = Math.max(0, Math.floor((s.z - s.outer + extent) / cell))
    const j1 = Math.min(res, Math.ceil((s.z + s.outer + extent) / cell))
    for (let j = j0; j <= j1; j++) {
      const z = -extent + j * cell
      for (let i = i0; i <= i1; i++) {
        const x = -extent + i * cell
        const d = Math.hypot(x - s.x, z - s.z)
        const k = j * n + i
        if (d < clearance[k]) clearance[k] = d
        if (d > s.outer) continue
        const w = 1 - smoothstep(s.inner, s.outer, d)
        if (w > weight[k]) {
          weight[k] = w
          target[k] = s.y
        }
        const pm = s.path * (1 - smoothstep(s.inner * 0.9, s.inner * 1.6, d))
        if (pm > path[k]) path[k] = pm
      }
    }
  }
  for (let k = 0; k < n * n; k++) {
    if (weight[k] > 0) heights[k] = lerp(heights[k], target[k], weight[k])
  }

  // Height on the rendered triangles (each quad is split along the same diagonal as the mesh).
  const heightAt = (x: number, z: number) => {
    const fx = clamp((x + extent) / cell, 0, res - 1e-4)
    const fz = clamp((z + extent) / cell, 0, res - 1e-4)
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    const u = fx - i
    const v = fz - j
    const h00 = heights[j * n + i]
    const h10 = heights[j * n + i + 1]
    const h01 = heights[(j + 1) * n + i]
    const h11 = heights[(j + 1) * n + i + 1]
    return u + v <= 1
      ? h00 + (h10 - h00) * u + (h01 - h00) * v
      : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
  }
  const normalYAt = (x: number, z: number) => {
    const e = cell
    const dx = heightAt(x + e, z) - heightAt(x - e, z)
    const dz = heightAt(x, z + e) - heightAt(x, z - e)
    return (2 * e) / Math.hypot(dx, 2 * e, dz)
  }

  const clearanceAt = (x: number, z: number) => {
    const i = Math.round(clamp((x + extent) / cell, 0, res))
    const j = Math.round(clamp((z + extent) / cell, 0, res))
    return clearance[j * n + i]
  }

  return { extent, res, heights, path, clearance, cut: new Uint8Array(n * n), cell, heightAt, normalYAt, clearanceAt }
}
