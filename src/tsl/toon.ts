import * as THREE from 'three/webgpu'

/**
 * A stepped light ramp for MeshToonNodeMaterial. Brightness values are kept
 * high so shadowed faces stay warm instead of going muddy.
 */
export function createToonRamp(steps = 4, floor = 0.45): THREE.DataTexture {
  const data = new Uint8Array(steps * 4)
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 1 : i / (steps - 1)
    const v = Math.round((floor + (1 - floor) * t) * 255)
    data.set([v, v, v, 255], i * 4)
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

let sharedRamp: THREE.DataTexture | null = null
export const getSharedToonRamp = () => (sharedRamp ??= createToonRamp())
