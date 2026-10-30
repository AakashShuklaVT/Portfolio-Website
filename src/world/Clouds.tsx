import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { lumpy } from '../lib/kit'
import { mulberry32 } from '../lib/noise'
import { useSettingsStore } from '../store/useSettingsStore'
import { nightRuntime } from './timeOfDay'

// Puffy low-poly clouds drifting downwind across the island. A few shapes
// are instanced; each cloud slides along the wind, bobs and breathes, and
// shrinks away at the edge of the world before re-forming upwind.

const VARIANTS = 4
const PER_VARIANT = 4
const RANGE = 170
const WIND = new THREE.Vector3(1, 0, 0.35).normalize()

function buildCloud(seed: number) {
  const rand = mulberry32(seed)
  const puffs: THREE.BufferGeometry[] = []
  const n = 5 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5
    const r = (2.4 - Math.abs(t) * 2.2) * (0.8 + rand() * 0.45)
    const g = lumpy(new THREE.IcosahedronGeometry(r, 1), r * 0.25, seed * 13 + i)
    const pos = g.attributes.position
    for (let k = 0; k < pos.count; k++) if (pos.getY(k) < -r * 0.25) pos.setY(k, -r * 0.25)
    g.translate(t * 9 + (rand() - 0.5), rand() * 0.9 + (0.5 - Math.abs(t)) * 1.2, (rand() - 0.5) * 3)
    puffs.push(g.toNonIndexed())
  }
  const merged = mergeGeometries(puffs)!
  merged.computeVertexNormals()
  puffs.forEach((p) => p.dispose())
  return merged
}

interface Cloud {
  base: THREE.Vector3
  offset: number
  speed: number
  scale: number
  yaw: number
  bob: number
}

export function Clouds() {
  const material = useMemo(
    () => new THREE.MeshStandardNodeMaterial({ color: '#ffffff', emissive: '#fff6ea', emissiveIntensity: 0.4, roughness: 1, flatShading: true }),
    [],
  )
  const { meshes, clouds } = useMemo(() => {
    const rand = mulberry32(99)
    const meshes = Array.from({ length: VARIANTS }, (_, v) => {
      const im = new THREE.InstancedMesh(buildCloud(200 + v), material, PER_VARIANT)
      im.frustumCulled = false
      return im
    })
    const clouds: Cloud[] = Array.from({ length: VARIANTS * PER_VARIANT }, (_, i) => ({
      base: new THREE.Vector3((rand() - 0.5) * 60, 44 + rand() * 18, (rand() - 0.5) * 220),
      offset: (i / (VARIANTS * PER_VARIANT)) * RANGE * 2 + rand() * 20,
      speed: 1.1 + rand() * 1.1,
      scale: 0.75 + rand() * 0.7,
      yaw: (rand() - 0.5) * 0.6,
      bob: rand() * 10,
    }))
    return { meshes, clouds }
  }, [material])

  const state = useMemo(() => ({ t: 0 }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, dt) => {
    material.emissiveIntensity = 0.4 * (1 - nightRuntime.factor)
    state.t += Math.min(dt, 0.1) * (useSettingsStore.getState().reducedMotion ? 0.3 : 1)
    const windYaw = Math.atan2(WIND.x, WIND.z)
    clouds.forEach((c, i) => {
      const travel = ((c.offset + state.t * c.speed) % (RANGE * 2)) - RANGE
      // fade in and out at the edges of the loop by shrinking
      const edge = Math.min(1, (RANGE - Math.abs(travel)) / 30)
      const breathe = 1 + Math.sin(state.t * 0.3 + c.bob) * 0.04
      p.copy(c.base).addScaledVector(WIND, travel)
      p.y += Math.sin(state.t * 0.25 + c.bob) * 0.8
      q.setFromAxisAngle(up, windYaw + Math.PI / 2 + c.yaw)
      s.set(breathe, 1 / breathe, breathe).multiplyScalar(c.scale * Math.max(0.001, edge))
      meshes[i % VARIANTS].setMatrixAt(Math.floor(i / VARIANTS), m.compose(p, q, s))
    })
    meshes.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true))
  })

  return (
    <group name="clouds">
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  )
}
