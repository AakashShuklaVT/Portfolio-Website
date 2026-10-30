import { useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { color, mix, normalWorld, positionWorld, smoothstep } from 'three/tsl'
import { getSharedToonRamp } from '../tsl/toon'

// Phase 0 grey-box: a faceted cone mountain shaded with a TSL height/slope colour ramp.
export function PlaceholderIsland() {
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.ConeGeometry(40, 26, 24, 8).toNonIndexed()
    geometry.computeVertexNormals()

    const grass = color('#86b85a')
    const rock = color('#a58f7c')
    const sand = color('#ecd7a3')
    const slope = smoothstep(0.55, 0.8, normalWorld.y)
    const ground = mix(rock, grass, slope)
    const colorNode = mix(sand, ground, smoothstep(0.6, 1.6, positionWorld.y))

    const material = new THREE.MeshToonNodeMaterial({ gradientMap: getSharedToonRamp() })
    material.colorNode = colorNode
    return { geometry, material }
  }, [])

  return (
    <group>
      <mesh geometry={geometry} material={material} position={[0, 12.5, 0]} castShadow receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={0.4} receiveShadow>
        <circleGeometry args={[140, 48]} />
        <meshStandardNodeMaterial color="#6fc3d4" roughness={0.4} />
      </mesh>
    </group>
  )
}
