import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useSettingsStore } from '../store/useSettingsStore'

// Two little flocks gliding in lazy circles over the island (scripted, works on every tier).
const FLOCKS = [
  { count: 5, radius: 52, height: 38, speed: 0.11, phase: 0 },
  { count: 4, radius: 34, height: 48, speed: -0.08, phase: 2.4 },
]

const wingGeometry = (() => {
  const g = new THREE.BufferGeometry()
  // One wing: a thin triangle along +x; the other is mirrored at render time.
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0.9, 0, 0, 0, 0, -0.25], 3))
  g.computeVertexNormals()
  return g
})()
const material = new THREE.MeshBasicNodeMaterial({ color: '#4a3d38', side: THREE.DoubleSide })

export function Birds() {
  const birds = useMemo(
    () =>
      FLOCKS.flatMap((f, fi) =>
        Array.from({ length: f.count }, (_, i) => ({
          flock: fi,
          offset: new THREE.Vector3((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.6, Math.sin(i) * 0.6, -Math.ceil(i / 2) * 1.8),
          flap: Math.random() * Math.PI * 2,
        })),
      ),
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])
  const t = useRef(0)

  useFrame((_, dt) => {
    if (!useSettingsStore.getState().reducedMotion) t.current += dt
    birds.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const f = FLOCKS[b.flock]
      const a = t.current * f.speed + f.phase
      const dir = Math.sign(f.speed)
      g.position.set(Math.sin(a) * f.radius, f.height + Math.sin(t.current * 0.5 + i) * 0.8, Math.cos(a) * f.radius)
      g.rotation.set(0, a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0)
      g.translateX(b.offset.x).translateY(b.offset.y).translateZ(b.offset.z)
      const flap = Math.sin(t.current * 7 + b.flap) * 0.6
      g.children[0].rotation.z = flap
      g.children[1].rotation.z = -flap
    })
  })

  return (
    <group name="birds">
      {birds.map((_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} scale={0.9}>
          <mesh geometry={wingGeometry} material={material} />
          <mesh geometry={wingGeometry} material={material} scale-x={-1} />
        </group>
      ))}
    </group>
  )
}
