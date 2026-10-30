import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { getNatureMaterial } from '../materials/natureMaterials'
import { useWorldStore } from '../store/useWorldStore'
import { MODEL_MAP, getModelGeometry } from './models'
import type { PropInstance } from './types'

function Prop({ prop }: { prop: PropInstance }) {
  const def = MODEL_MAP.get(prop.model)
  const ref = useRef<THREE.Mesh>(null)
  const floats = def?.tags.includes('water') && prop.model !== 'pier'

  useFrame(({ clock }) => {
    if (!floats || !ref.current) return
    const t = clock.elapsedTime + prop.position[0] * 0.3
    ref.current.position.y = prop.position[1] + Math.sin(t * 1.2) * 0.12
    ref.current.rotation.z = Math.sin(t * 0.9) * 0.05
    ref.current.rotation.x = Math.cos(t * 0.7) * 0.03
  })

  return (
    <mesh
      ref={ref}
      name={prop.name ?? prop.id}
      geometry={getModelGeometry(prop.model)}
      material={getNatureMaterial(def?.wind ?? false, def?.height ?? 1)}
      position={prop.position}
      rotation={prop.rotation}
      scale={prop.scale}
      userData={{ propId: prop.id }}
      castShadow
      receiveShadow
    />
  )
}

export function Props() {
  const props = useWorldStore((s) => s.world?.props)
  if (!props) return null
  return (
    <group name="props">
      {props.map((p) => (
        <Prop key={p.id} prop={p} />
      ))}
    </group>
  )
}
