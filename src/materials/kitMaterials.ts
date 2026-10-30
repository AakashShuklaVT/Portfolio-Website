import * as THREE from 'three/webgpu'
import { uniform, vertexColor } from 'three/tsl'
import type { KitLayer } from '../lib/kit'

/** Brightness of every glowing kit part (windows, lamps, crystals). Driven by the time of day. */
export const glowLevel = uniform(0.3)

export type KitMaterials = Record<KitLayer, THREE.MeshStandardNodeMaterial>

/** Vertex-coloured materials for kit-built models. `mask` discards fragments where it is false. */
export function createKitMaterials(mask?: THREE.Node): KitMaterials {
  const base = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: true })
  const metal = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.55, flatShading: true })
  const glow = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, flatShading: true })
  glow.emissiveNode = vertexColor().mul(glowLevel)
  if (mask) for (const m of [base, metal, glow]) m.maskNode = mask as never
  return { base, metal, glow }
}

export const kitMaterials = createKitMaterials()
