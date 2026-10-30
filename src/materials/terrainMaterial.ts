import * as THREE from 'three/webgpu'
import { attribute, mix, normalWorld, smoothstep, uniform, vec3 } from 'three/tsl'

/** Live-tunable terrain colours (bound to editor sliders later). */
export const terrainUniforms = {
  sand: uniform(new THREE.Color('#ecd49b')),
  grassLow: uniform(new THREE.Color('#7fb350')),
  grassHigh: uniform(new THREE.Color('#b5c96a')),
  rock: uniform(new THREE.Color('#b39a83')),
  rockDark: uniform(new THREE.Color('#8f7867')),
  gravel: uniform(new THREE.Color('#c9ad88')),
  seabed: uniform(new THREE.Color('#d9c48e')),
  beachHeight: uniform(2.1),
  cliffSlope: uniform(0.72),
  variation: uniform(0.12),
}

/**
 * Terrain colouring from per-face data packed in `aFace`:
 *   x = face centre height, y = path mask, z = random 0..1.
 * Every value is constant across a triangle, so faces read as flat low-poly facets.
 */
export function createTerrainMaterial() {
  const u = terrainUniforms
  const face = attribute('aFace', 'vec3')
  const height = face.x
  const pathMask = face.y
  const rnd = face.z

  const shade = rnd.sub(0.5).mul(u.variation).add(1)
  const grass = mix(u.grassLow, u.grassHigh, smoothstep(4, 26, height)).mul(shade)
  const rock = mix(u.rockDark, u.rock, rnd).mul(shade)
  const slope = normalWorld.y
  const land = mix(rock, grass, smoothstep(u.cliffSlope.sub(0.08), u.cliffSlope.add(0.06), slope))
  const beach = mix(u.sand.mul(shade), land, smoothstep(u.beachHeight, u.beachHeight.add(0.6), height))
  const seabed = mix(u.seabed.mul(0.75), u.sand, smoothstep(-2.5, 0.8, height))
  const ground = mix(seabed, beach, smoothstep(0.2, 1.0, height))
  const withPath = mix(ground, u.gravel.mul(shade), smoothstep(0.35, 0.75, pathMask))

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 })
  material.colorNode = vec3(withPath)
  return material
}
