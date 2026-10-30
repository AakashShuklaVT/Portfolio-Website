import * as THREE from 'three/webgpu'
import { clamp, cos, float, max, mix, positionLocal, positionWorld, sin, smoothstep, step, texture, time, uniform, vec2, vec3 } from 'three/tsl'
import type { Heightfield } from '../world/terrainGen'

export const waterUniforms = {
  shallow: uniform(new THREE.Color('#7fd3d1')),
  deep: uniform(new THREE.Color('#2f8ca8')),
  foam: uniform(new THREE.Color('#f6fbf7')),
  waveHeight: uniform(0.16),
  waveSpeed: uniform(0.8),
  /** World units covered by the depth texture (half size). */
  extent: uniform(90),
}

/** How deep (in world units) maps to depth = 1 in the texture. */
export const MAX_DEPTH = 6

/** Bakes water depth below `level` into a small texture used for colour and shore foam. */
export function createDepthTexture(hf: Heightfield, level: number) {
  const n = hf.res + 1
  const data = new Uint8Array(n * n * 4)
  for (let k = 0; k < n * n; k++) {
    const depth = Math.min(1, Math.max(0, (level - hf.heights[k]) / MAX_DEPTH))
    const v = Math.round(depth * 255)
    data.set([v, v, v, 255], k * 4)
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

/** Stylised water: depth-tinted colour, animated shoreline foam bands and faceted waves. */
export function createWaterMaterial(depthTexture: THREE.DataTexture) {
  const u = waterUniforms
  const t = time.mul(u.waveSpeed)

  const material = new THREE.MeshStandardNodeMaterial({ transparent: true, roughness: 0.25, metalness: 0, flatShading: true })

  const p = positionLocal
  const wave = sin(p.x.mul(0.21).add(t)).mul(cos(p.z.mul(0.17).sub(t.mul(0.8)))).add(sin(p.x.mul(0.05).add(p.z.mul(0.07)).add(t.mul(0.6))).mul(0.6))
  material.positionNode = p.add(vec3(0, wave.mul(u.waveHeight), 0))

  const uv = positionWorld.xz.add(u.extent).div(u.extent.mul(2))
  const insideMap = step(0, uv.x).mul(step(uv.x, 1)).mul(step(0, uv.y)).mul(step(uv.y, 1))
  const depth = mix(float(1), texture(depthTexture, clamp(uv, vec2(0.001), vec2(0.999))).r, insideMap)

  const deepMix = smoothstep(0.02, 0.75, depth)
  const base = mix(u.shallow, u.deep, deepMix)

  // Foam: a solid rim right at the shore plus bands that roll in towards it.
  const rim = smoothstep(0.06, 0.015, depth)
  const bands = sin(depth.mul(70).sub(time.mul(1.6))).mul(0.5).add(0.5)
  const bandMask = smoothstep(0.2, 0.06, depth).mul(step(0.82, bands))
  const foam = max(rim, bandMask)

  material.colorNode = mix(base, u.foam, foam)
  // Fully opaque outside the depth map, so nothing shows through the open sea.
  material.opacityNode = max(max(mix(float(0.62), float(1), deepMix), foam), float(1).sub(insideMap))
  return material
}
