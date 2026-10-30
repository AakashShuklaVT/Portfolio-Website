import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useUiStore } from '../store/useUiStore'
import { useSettingsStore } from '../store/useSettingsStore'
import * as THREE from 'three/webgpu'
import { Html } from '@react-three/drei'
import { useWorldStore } from '../store/useWorldStore'
import type { StationRuntime } from '../world/buildWorld'
import { useRideStore } from '../store/useRideStore'

const mat = (color: string) => new THREE.MeshStandardNodeMaterial({ color, roughness: 0.9, flatShading: true })
export const buildingMaterials = {
  wall: mat('#f4e6cc'),
  wallWarm: mat('#f1d3a8'),
  wood: mat('#9a6a45'),
  woodDark: mat('#6e4a33'),
  roofRed: mat('#c9573f'),
  roofTeal: mat('#3f8c84'),
  roofGreen: mat('#5f8f4e'),
  stone: mat('#c9b7a1'),
  platform: mat('#d8c3a4'),
  dark: mat('#3a3230'),
  window: new THREE.MeshStandardNodeMaterial({ color: '#ffd889', emissive: '#ffb347', emissiveIntensity: 0.35, roughness: 0.4 }),
  white: mat('#f7f2ea'),
  red: mat('#cf4a3c'),
  glass: new THREE.MeshStandardNodeMaterial({ color: '#fff4c2', emissive: '#ffd36b', emissiveIntensity: 1.2, roughness: 0.2 }),
}

const box = new THREE.BoxGeometry(1, 1, 1)
// Unit gable roof: 1 x 1 footprint, ridge along x at height 1.
const gable = (() => {
  const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 1, 0], D = [-0.5, 1, 0]
  const E = [0.5, 0, -0.5], F = [-0.5, 0, -0.5]
  const tris = [A, B, C, A, C, D, E, F, D, E, D, C, F, A, D, B, E, C, F, E, B, F, B, A]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
  geometry.computeVertexNormals()
  return geometry
})()
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10)
const cone = new THREE.ConeGeometry(1, 1, 10)

interface HouseProps {
  w: number
  d: number
  h: number
  wall?: THREE.Material
  roof?: THREE.Material
  position?: [number, number, number]
  rotationY?: number
  chimney?: boolean
}

export function House({ w, d, h, wall = buildingMaterials.wall, roof = buildingMaterials.roofRed, position = [0, 0, 0], rotationY = 0, chimney }: HouseProps) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh geometry={box} material={wall} position-y={h / 2} scale={[w, h, d]} castShadow receiveShadow />
      <mesh geometry={gable} material={roof} position-y={h} scale={[w + 0.5, d * 0.55, d + 0.6]} castShadow />
      <mesh geometry={box} material={buildingMaterials.woodDark} position={[0, 0.65, d / 2 + 0.01]} scale={[0.7, 1.3, 0.05]} />
      <mesh geometry={box} material={buildingMaterials.window} position={[w * 0.28, h * 0.6, d / 2 + 0.01]} scale={[0.6, 0.55, 0.05]} />
      <mesh geometry={box} material={buildingMaterials.window} position={[-w * 0.28, h * 0.6, d / 2 + 0.01]} scale={[0.6, 0.55, 0.05]} />
      {chimney && <mesh geometry={box} material={buildingMaterials.stone} position={[w * 0.3, h + d * 0.35, -d * 0.2]} scale={[0.45, 1.1, 0.45]} castShadow />}
    </group>
  )
}

const beamMaterial = new THREE.MeshBasicNodeMaterial({
  color: '#fff1b8',
  transparent: true,
  opacity: 0.06,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
})
// A long cone lying along +x, apex at the lamp.
const beamGeometry = new THREE.ConeGeometry(2, 20, 12, 1, true).rotateZ(Math.PI / 2).translate(10, 0, 0)

function Lighthouse({ position }: { position: THREE.Vector3 }) {
  const stripes = 5
  const height = 9
  const beam = useRef<THREE.Group>(null)
  const glass = useMemo(() => buildingMaterials.glass.clone(), [])

  // Rotating beam; a sent signal makes the lamp and beam flash for a few seconds.
  useFrame((_, dt) => {
    const since = (performance.now() - useUiStore.getState().signalAt) / 1000
    const flashing = useUiStore.getState().signalAt > 0 && since < 3.5
    const pulse = flashing ? 0.5 + 0.5 * Math.sin(since * 14) : 0
    glass.emissiveIntensity = 1.2 + pulse * 5
    beamMaterial.opacity = 0.05 + pulse * 0.4
    if (beam.current && !useSettingsStore.getState().reducedMotion) beam.current.rotation.y += dt * (flashing ? 3 : 0.6)
  })

  return (
    <group position={position}>
      <mesh geometry={cyl} material={buildingMaterials.stone} position-y={0.4} scale={[2.6, 0.8, 2.6]} castShadow receiveShadow />
      {Array.from({ length: stripes }, (_, i) => {
        const t0 = i / stripes
        const t1 = (i + 1) / stripes
        const r0 = 1.6 - t0 * 0.55
        const r1 = 1.6 - t1 * 0.55
        const geometry = new THREE.CylinderGeometry(r1, r0, height / stripes, 12)
        return (
          <mesh
            key={i}
            geometry={geometry}
            material={i % 2 ? buildingMaterials.red : buildingMaterials.white}
            position-y={0.8 + (t0 + 0.5 / stripes) * height}
            castShadow
          />
        )
      })}
      <mesh geometry={cyl} material={buildingMaterials.dark} position-y={0.8 + height + 0.1} scale={[1.55, 0.2, 1.55]} castShadow />
      <mesh geometry={cyl} material={glass} position-y={0.8 + height + 0.8} scale={[0.85, 1.2, 0.85]} />
      <group ref={beam} position-y={0.8 + height + 0.8}>
        <mesh geometry={beamGeometry} material={beamMaterial} />
        <mesh geometry={beamGeometry} material={beamMaterial} rotation-y={Math.PI} />
      </group>
      <mesh geometry={cone} material={buildingMaterials.red} position-y={0.8 + height + 1.9} scale={[1.15, 1.0, 1.15]} castShadow />
    </group>
  )
}

function StationBuilding({ station }: { station: StationRuntime }) {
  const { position, tangent, side, buildingPosition } = station
  const yaw = useMemo(() => Math.atan2(-side.x, -side.z), [side])
  const platformYaw = useMemo(() => Math.atan2(tangent.x, tangent.z), [tangent])
  const platformPos = position.clone().addScaledVector(side, 2.35)
  const ground = buildingPosition.y - 0.25
  const type = station.def.building
  return (
    <group name={`station-${station.def.id}`}>
      <mesh geometry={box} material={buildingMaterials.platform} position={[platformPos.x, position.y - 0.15, platformPos.z]} rotation-y={platformYaw} scale={[2.2, 1.1, 11]} castShadow receiveShadow />
      <group position={[buildingPosition.x, ground, buildingPosition.z]} rotation-y={yaw}>
        {type === 'harbor' && (
          <>
            <House w={5} d={3.2} h={2.8} roof={buildingMaterials.roofTeal} chimney />
            <House w={2.6} d={2.4} h={2} position={[4.3, 0, 0.3]} wall={buildingMaterials.wallWarm} />
          </>
        )}
        {type === 'woodland' && (
          <>
            <House w={4.4} d={3.2} h={2.4} wall={buildingMaterials.wood} roof={buildingMaterials.roofGreen} chimney />
            <mesh geometry={box} material={buildingMaterials.woodDark} position={[3.4, 0.5, 0.6]} scale={[1.6, 1, 1.2]} castShadow />
          </>
        )}
        {type === 'mine' && (
          <>
            <House w={3.6} d={2.8} h={2.4} wall={buildingMaterials.wallWarm} roof={buildingMaterials.roofRed} />
            <mesh geometry={box} material={buildingMaterials.wood} position={[-3.6, 1.4, -0.8]} scale={[0.35, 2.8, 0.35]} castShadow />
            <mesh geometry={box} material={buildingMaterials.wood} position={[-1.6, 1.4, -0.8]} scale={[0.35, 2.8, 0.35]} castShadow />
            <mesh geometry={box} material={buildingMaterials.wood} position={[-2.6, 2.9, -0.8]} scale={[2.6, 0.35, 0.45]} castShadow />
            <mesh geometry={box} material={buildingMaterials.dark} position={[-2.6, 1.3, -1.0]} scale={[1.65, 2.6, 0.1]} />
          </>
        )}
        {type === 'village' && (
          <>
            <House w={4.2} d={3} h={2.6} roof={buildingMaterials.roofRed} chimney />
            <House w={2.8} d={2.6} h={2.2} position={[4.4, 0, -1.5]} rotationY={0.4} wall={buildingMaterials.wallWarm} roof={buildingMaterials.roofTeal} chimney />
            <House w={2.6} d={2.4} h={2} position={[-4.2, 0, -1.2]} rotationY={-0.3} roof={buildingMaterials.roofGreen} />
          </>
        )}
        {type === 'lighthouse' && <House w={3} d={2.4} h={2.2} wall={buildingMaterials.white} roof={buildingMaterials.roofRed} />}
      </group>
      <StationLabel station={station} />
    </group>
  )
}

function StationLabel({ station }: { station: StationRuntime }) {
  const visible = useRideStore((s) => s.state === 'INTRO')
  if (!visible) return null
  const p = station.buildingPosition
  return (
    <Html position={[p.x, p.y + 6, p.z]} center zIndexRange={[10, 0]} className="station-label">
      {station.def.name}
    </Html>
  )
}

export function StationBuildings() {
  const derived = useWorldStore((s) => s.derived)
  const lighthousePos = useMemo(() => {
    if (!derived) return null
    return new THREE.Vector3(0, derived.heightfield.heightAt(0, 0), 0)
  }, [derived])
  if (!derived || !lighthousePos) return null
  return (
    <group name="stations">
      {derived.stations.map((s) => (
        <StationBuilding key={s.def.id} station={s} />
      ))}
      <Lighthouse position={lighthousePos} />
    </group>
  )
}
