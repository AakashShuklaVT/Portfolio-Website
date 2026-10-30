import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../lib/noise'
import { useSettingsStore } from '../store/useSettingsStore'
import { nightRuntime } from './timeOfDay'

const CLOUD_COUNT = 9

function buildCloud(seed: number) {
  const rand = mulberry32(seed)
  const puffs: THREE.BufferGeometry[] = []
  const n = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const r = 1.8 + rand() * 1.8
    const base = new THREE.IcosahedronGeometry(r, 0)
    base.deleteAttribute('normal')
    base.deleteAttribute('uv')
    const g = mergeVertices(base)
    const pos = g.attributes.position
    for (let k = 0; k < pos.count; k++) {
      // flatten the underside
      if (pos.getY(k) < -r * 0.3) pos.setY(k, -r * 0.3)
    }
    g.translate((i - n / 2) * 2.6 + rand(), rand() * 1.2, (rand() - 0.5) * 2.5)
    puffs.push(g.toNonIndexed())
  }
  const merged = mergeGeometries(puffs)!
  merged.computeVertexNormals()
  return merged
}

/** Slow-drifting low-poly clouds circling the island; they also cast soft moving shadows. */
export function Clouds() {
  const group = useRef<THREE.Group>(null)
  const material = useMemo(
    () => new THREE.MeshStandardNodeMaterial({ color: '#ffffff', emissive: '#fff6ea', emissiveIntensity: 0.35, roughness: 1, flatShading: true }),
    [],
  )
  const clouds = useMemo(() => {
    const rand = mulberry32(99)
    return Array.from({ length: CLOUD_COUNT }, (_, i) => {
      const angle = (i / CLOUD_COUNT) * Math.PI * 2 + rand() * 0.5
      const radius = 30 + rand() * 70
      return {
        geometry: buildCloud(200 + i),
        position: new THREE.Vector3(Math.sin(angle) * radius, 46 + rand() * 14, Math.cos(angle) * radius),
        scale: 0.8 + rand() * 0.7,
        yaw: rand() * Math.PI,
      }
    })
  }, [])

  useFrame((_, dt) => {
    material.emissiveIntensity = 0.35 * (1 - nightRuntime.factor)
    if (!group.current || useSettingsStore.getState().reducedMotion) return
    group.current.rotation.y += dt * 0.012
  })

  return (
    <group ref={group} name="clouds">
      {clouds.map((c, i) => (
        <mesh key={i} geometry={c.geometry} material={material} position={c.position} scale={c.scale} rotation-y={c.yaw} castShadow />
      ))}
    </group>
  )
}
