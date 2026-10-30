import * as THREE from 'three/webgpu'
import { float, positionGeometry, positionLocal, sin, time, uniform, vec3 } from 'three/tsl'

export const windUniforms = {
  strength: uniform(0.12),
  speed: uniform(1.3),
  /** Spatial frequency of gusts rolling across the island. */
  gustScale: uniform(0.08),
}

/**
 * Wind sway in the vertex stage. The offset grows with the square of the
 * model-space height, so trunks stay planted and crowns move. No CPU work
 * per instance.
 */
function windPosition(height: number) {
  const w = windUniforms
  const h = positionGeometry.y.div(height).clamp(0, 1.5)
  const bend = h.mul(h).mul(w.strength)
  const phase = time.mul(w.speed).add(positionLocal.x.mul(w.gustScale)).add(positionLocal.z.mul(w.gustScale.mul(0.7)))
  const gust = sin(phase).mul(0.7).add(sin(phase.mul(2.3).add(1.7)).mul(0.3))
  return positionLocal.add(vec3(gust.mul(bend), float(0), sin(phase.mul(0.8).add(0.5)).mul(bend).mul(0.6)))
}

const cache = new Map<string, THREE.MeshStandardNodeMaterial>()

/** Shared vertex-coloured material per (wind, height) pair. */
export function getNatureMaterial(wind: boolean, height: number) {
  const key = wind ? `wind:${height}` : 'static'
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true })
    if (wind) m.positionNode = windPosition(height)
    cache.set(key, m)
  }
  return m
}
