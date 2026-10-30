import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mulberry32 } from '../lib/noise'
import { nightRuntime } from './timeOfDay'

const COUNT = 260

/** Tiny star facets on the upper sky dome; they fade in with the night factor. */
export function Stars() {
  const { mesh, material } = useMemo(() => {
    const material = new THREE.MeshBasicNodeMaterial({ color: '#fff6dd', transparent: true, opacity: 0, fog: false, depthWrite: false })
    const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), material, COUNT)
    const rand = mulberry32(5)
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      const az = rand() * Math.PI * 2
      const el = 0.08 + rand() * 1.4
      p.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(520)
      m.makeScale(1, 1, 1).multiplyScalar(0.6 + rand() * 1.4).setPosition(p)
      mesh.setMatrixAt(i, m)
    }
    mesh.frustumCulled = false
    mesh.renderOrder = -1
    return { mesh, material }
  }, [])

  useFrame(() => {
    material.opacity = Math.max(0, nightRuntime.factor - 0.4) / 0.6
    mesh.visible = material.opacity > 0.01
  })

  return <primitive object={mesh} />
}
