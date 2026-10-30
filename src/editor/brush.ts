import * as THREE from 'three/webgpu'
import type { Heightfield } from '../world/terrainGen'
import type { ScatterLayer, WorldData } from '../world/types'
import type { BrushSettings } from './useEditorStore'

const STRIDE = 5
/** Instances never get closer than this to the railway or a station pad. */
const TRACK_CLEARANCE = 3

/** Ray march against the heightfield, then bisect. Much cheaper than raycasting the terrain mesh. */
export function rayTerrain(ray: THREE.Ray, hf: Heightfield, maxDist = 700): THREE.Vector3 | null {
  const p = new THREE.Vector3()
  let prevT = 0
  const step = 0.6
  for (let t = 0; t < maxDist; t += step) {
    ray.at(t, p)
    if (p.y <= hf.heightAt(p.x, p.z)) {
      let a = prevT
      let b = t
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2
        ray.at(m, p)
        if (p.y <= hf.heightAt(p.x, p.z)) b = m
        else a = m
      }
      ray.at(b, p)
      if (Math.abs(p.x) > hf.extent || Math.abs(p.z) > hf.extent) return null
      return p
    }
    prevT = t
  }
  return null
}

const sinkFor = (model: string, scale: number) => (model.startsWith('rock') ? 0.35 * scale : 0.05)

/** Adds instances inside the brush circle, honouring slope, height and spacing rules. */
export function stampScatter(world: WorldData, hf: Heightfield, center: THREE.Vector3, brush: BrushSettings): WorldData {
  const existing = world.scatter.find((l) => l.model === brush.model)
  const instances = existing ? existing.instances.slice() : []
  const spacing2 = brush.spacing * brush.spacing
  let added = 0
  for (let attempt = 0; attempt < brush.density * 4 && added < brush.density; attempt++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * brush.radius
    const x = center.x + Math.cos(a) * r
    const z = center.z + Math.sin(a) * r
    const y = hf.heightAt(x, z)
    if (y < brush.minHeight || y > brush.maxHeight) continue
    if (hf.normalYAt(x, z) < brush.minFlat) continue
    if (hf.clearanceAt(x, z) < TRACK_CLEARANCE) continue
    let tooClose = false
    for (let i = 0; i < instances.length; i += STRIDE) {
      const dx = instances[i] - x
      const dz = instances[i + 2] - z
      if (dx * dx + dz * dz < spacing2) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue
    const s = brush.scaleMin + Math.random() * (brush.scaleMax - brush.scaleMin)
    const rot = brush.randomRotation ? Math.random() * Math.PI * 2 : 0
    instances.push(+x.toFixed(2), +(y - sinkFor(brush.model, s)).toFixed(2), +z.toFixed(2), +rot.toFixed(2), +s.toFixed(2))
    added++
  }
  if (!added) return world
  const layer: ScatterLayer = existing ? { ...existing, instances } : { id: brush.model, model: brush.model, instances }
  const scatter = existing ? world.scatter.map((l) => (l === existing ? layer : l)) : [...world.scatter, layer]
  return { ...world, scatter }
}

/** Removes instances inside the circle, from one model's layer or from every layer. */
export function eraseScatter(world: WorldData, center: THREE.Vector3, radius: number, onlyModel?: string): WorldData {
  const r2 = radius * radius
  let changed = false
  const scatter = world.scatter.map((layer) => {
    if (onlyModel && layer.model !== onlyModel) return layer
    const kept: number[] = []
    for (let i = 0; i < layer.instances.length; i += STRIDE) {
      const dx = layer.instances[i] - center.x
      const dz = layer.instances[i + 2] - center.z
      if (dx * dx + dz * dz > r2) kept.push(...layer.instances.slice(i, i + STRIDE))
    }
    if (kept.length === layer.instances.length) return layer
    changed = true
    return { ...layer, instances: kept }
  })
  return changed ? { ...world, scatter } : world
}

/** After the terrain changes, drop every instance and prop back onto the ground. */
export function resnapToTerrain(world: WorldData, hf: Heightfield): WorldData {
  const scatter = world.scatter.map((layer) => {
    const instances = layer.instances.slice()
    for (let i = 0; i < instances.length; i += STRIDE) {
      instances[i + 1] = +(hf.heightAt(instances[i], instances[i + 2]) - sinkFor(layer.model, instances[i + 4])).toFixed(2)
    }
    return { ...layer, instances }
  })
  const props = world.props.map((p) => {
    if (p.model === 'boat' || p.model === 'pier') return p
    return { ...p, position: [p.position[0], +(hf.heightAt(p.position[0], p.position[2]) - 0.02).toFixed(2), p.position[2]] as typeof p.position }
  })
  return { ...world, scatter, props }
}

/** Removes scatter that ended up on the railway (e.g. after moving the track). */
export function clearScatterNearTrack(world: WorldData, hf: Heightfield): WorldData {
  const scatter = world.scatter.map((layer) => {
    const kept: number[] = []
    for (let i = 0; i < layer.instances.length; i += STRIDE) {
      if (hf.clearanceAt(layer.instances[i], layer.instances[i + 2]) >= TRACK_CLEARANCE) kept.push(...layer.instances.slice(i, i + STRIDE))
    }
    return { ...layer, instances: kept }
  })
  return { ...world, scatter }
}
