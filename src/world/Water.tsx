import { useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { useWorldStore } from '../store/useWorldStore'

/** Phase 1 water: a flat translucent plane. Replaced by the TSL water material in Phase 3. */
export function Water() {
  const water = useWorldStore((s) => s.world?.water)
  const material = useMemo(
    () => new THREE.MeshStandardNodeMaterial({ color: '#5fbcc9', roughness: 0.35, transparent: true, opacity: 0.85 }),
    [],
  )
  if (!water) return null
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={water.level} material={material} receiveShadow>
      <circleGeometry args={[600, 64]} />
    </mesh>
  )
}
