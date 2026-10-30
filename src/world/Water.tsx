import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { createDepthTexture, createWaterMaterial, waterUniforms } from '../materials/waterMaterial'
import { useWorldStore } from '../store/useWorldStore'

const NEAR_SIZE = 560
const NEAR_SEGMENTS = 180

/** A detailed animated patch around the island plus a flat far ocean that fades into the haze. */
export function Water() {
  const water = useWorldStore((s) => s.world?.water)
  const heightfield = useWorldStore((s) => s.derived?.heightfield)

  const depthTexture = useMemo(
    () => (heightfield && water ? createDepthTexture(heightfield, water.level) : null),
    [heightfield, water],
  )
  const material = useMemo(() => (depthTexture ? createWaterMaterial(depthTexture) : null), [depthTexture])
  const nearGeometry = useMemo(() => new THREE.PlaneGeometry(NEAR_SIZE, NEAR_SIZE, NEAR_SEGMENTS, NEAR_SEGMENTS).rotateX(-Math.PI / 2), [])
  const farGeometry = useMemo(() => new THREE.RingGeometry(NEAR_SIZE * 0.5 - 0.5, 900, 64, 1).rotateX(-Math.PI / 2), [])
  const farMaterial = useMemo(() => new THREE.MeshStandardNodeMaterial({ roughness: 0.3, flatShading: true }), [])

  useEffect(() => {
    if (!water || !heightfield) return
    waterUniforms.shallow.value.set(water.shallow)
    waterUniforms.deep.value.set(water.deep)
    waterUniforms.foam.value.set(water.foam)
    waterUniforms.extent.value = heightfield.extent
    farMaterial.color.set(water.deep)
  }, [water, heightfield, farMaterial])

  useEffect(() => () => depthTexture?.dispose(), [depthTexture])
  useEffect(() => () => material?.dispose(), [material])

  if (!water || !material) return null
  return (
    <group position-y={water.level} name="water">
      <mesh geometry={nearGeometry} material={material} receiveShadow />
      <mesh geometry={farGeometry} material={farMaterial} position-y={-0.15} />
    </group>
  )
}
