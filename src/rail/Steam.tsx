import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useAppStore } from '../store/useAppStore'
import { trainRuntime } from './trainRuntime'

const MAX = 48
interface Puff {
  pos: THREE.Vector3
  vel: THREE.Vector3
  age: number
  life: number
  size: number
}

const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s = new THREE.Vector3()

/** Puffs of steam from the locomotive chimney; more and faster when the train works harder. */
export function Steam() {
  const scale = useAppStore((st) => st.quality?.particleScale ?? 1)
  const capacity = Math.max(12, Math.round(MAX * scale))
  const mesh = useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(1, 1)
    const material = new THREE.MeshStandardNodeMaterial({ color: '#f7f3ee', emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 1, flatShading: true })
    const im = new THREE.InstancedMesh(geometry, material, capacity)
    im.frustumCulled = false
    im.count = 0
    return im
  }, [capacity])
  const puffs = useRef<Puff[]>([])
  const spawnAcc = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const speed = trainRuntime.speed
    // Idle trains still breathe a little.
    const rate = 0.9 + speed * 0.55
    spawnAcc.current += rate * dt
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1
      if (puffs.current.length >= capacity) puffs.current.shift()
      puffs.current.push({
        pos: trainRuntime.chimney.clone(),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.2 + Math.random() * 0.8 + speed * 0.05, (Math.random() - 0.5) * 0.6),
        age: 0,
        life: 1.1 + Math.random() * 0.7,
        size: 0.2 + Math.random() * 0.12,
      })
    }

    let n = 0
    for (const p of puffs.current) {
      p.age += dt
      if (p.age >= p.life) continue
      p.vel.y *= 1 - 0.9 * dt
      p.vel.x += 0.25 * dt // light breeze
      p.pos.addScaledVector(p.vel, dt)
      const t = p.age / p.life
      const size = p.size * (1 + t * 1.8) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1)
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.age * 0.8)
      mesh.setMatrixAt(n++, m.compose(p.pos, q, s.setScalar(Math.max(0.001, size))))
    }
    puffs.current = puffs.current.filter((p) => p.age < p.life)
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
