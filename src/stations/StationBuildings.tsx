import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { abs, color, dot, float, length, normalView, normalize, positionGeometry, positionView, pow, smoothstep, uniform, uv, exp, vertexColor } from 'three/tsl'
import { Html } from '@react-three/drei'
import { useUiStore } from '../store/useUiStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { nightRuntime } from '../world/timeOfDay'
import { useWorldStore } from '../store/useWorldStore'
import type { StationRuntime } from '../world/buildWorld'
import { useRideStore } from '../store/useRideStore'
import { buildPlatform, buildSignMesh, platformFurniture, type SignPlacement } from './platform'
import { LIGHTHOUSE, MINE_WHEEL, buildLighthouseGeometry, buildStation, buildWheelGeometry } from './stationKits'
import { createKitMaterials, kitMaterials, type KitMaterials } from '../materials/kitMaterials'
import { Kit, type KitLayer } from '../lib/kit'
import type { TrackPath } from '../rail/TrackPath'
import { lighthouseRuntime } from './lighthouseRuntime'

function KitMeshes({ layers, shadows = true, materials = kitMaterials }: { layers: Partial<Record<KitLayer, THREE.BufferGeometry>>; shadows?: boolean; materials?: KitMaterials }) {
  return (
    <>
      {layers.base && <mesh geometry={layers.base} material={materials.base} castShadow={shadows} receiveShadow />}
      {layers.metal && <mesh geometry={layers.metal} material={materials.metal} castShadow={shadows} />}
      {layers.glow && <mesh geometry={layers.glow} material={materials.glow} />}
    </>
  )
}

const wheelGeometry = buildWheelGeometry()

/**
 * Everything static at a stop (architecture, platform, canopy, lamps, sign
 * posts) merged into one kit in world space: three draw calls per station.
 */
function buildStationScene(track: TrackPath, station: StationRuntime, lighthouse: THREE.Vector3) {
  const type = station.def.building
  // The lighthouse stop is arranged around the tower; every other stop sits on its own plot facing the line.
  let position: THREE.Vector3
  let yaw: number
  if (type === 'lighthouse') {
    const toLine = station.position.clone().sub(lighthouse).setY(0).normalize()
    position = lighthouse.clone()
    yaw = Math.atan2(toLine.x, toLine.z)
  } else {
    position = station.buildingPosition.clone().setY(station.buildingPosition.y - 0.3)
    yaw = Math.atan2(-station.side.x, -station.side.z)
  }
  const kit = new Kit(station.index * 13 + 5)
  kit.group({ position: position.toArray() as [number, number, number], rotation: [0, yaw, 0] }, () => buildStation(kit, type))
  const platform = buildPlatform(track, station)
  kit.add(platform.body, '#d9c7a8', {}, 'base', 0.04)
  kit.add(platform.edge, '#f2e3c6', {}, 'base', 0.02)
  platform.body.dispose()
  platform.edge.dispose()
  const signs = platformFurniture(track, station, kit)
  return { layers: kit.build(), signs, position, yaw }
}

function StationBuilding({ station, scene }: { station: StationRuntime; scene: ReturnType<typeof buildStationScene> }) {
  const wheel = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (wheel.current && !useSettingsStore.getState().reducedMotion) wheel.current.rotation.x += dt * 0.9
  })
  return (
    <group name={`station-${station.def.id}`}>
      <KitMeshes layers={scene.layers} />
      {station.def.building === 'mine' && (
        <group position={scene.position} rotation-y={scene.yaw}>
          <mesh ref={wheel} geometry={wheelGeometry} material={kitMaterials.metal} position={MINE_WHEEL.position} castShadow />
        </group>
      )}
      <StationLabel station={station} />
    </group>
  )
}

function StationSigns({ signs }: { signs: SignPlacement[] }) {
  const mesh = useMemo(() => (signs.length && typeof document !== 'undefined' ? buildSignMesh(signs) : null), [signs])
  useEffect(
    () => () => {
      mesh?.geometry.dispose()
      mesh?.material.dispose()
      mesh?.texture.dispose()
    },
    [mesh],
  )
  if (!mesh) return null
  return <mesh geometry={mesh.geometry} material={mesh.material} />
}

// ---------------------------------------------------------------- lighthouse

const BEAM_LENGTH = 70
const beamUniforms = { intensity: uniform(0.2) }

/** A soft volumetric-looking cone: bright along its axis and near the lamp, fading out over distance. */
function createBeamMaterial() {
  const t = positionGeometry.x.div(BEAM_LENGTH).clamp(0, 1)
  const along = pow(float(1).sub(t), 1.7).mul(smoothstep(0.0, 0.03, t))
  const facing = abs(dot(normalize(normalView), normalize(positionView.negate())))
  const core = pow(facing, 2.2)
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
  m.colorNode = color('#fff1c4')
  m.opacityNode = along.mul(core).mul(beamUniforms.intensity)
  return m
}

const flareUniforms = { strength: uniform(0.4) }
function createFlareMaterial() {
  const p = uv().sub(0.5)
  const r = length(p).mul(2)
  const glow = smoothstep(1, 0, r).pow(3)
  const streak = exp(abs(p.y).mul(-60)).mul(exp(abs(p.x).mul(-4)))
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  m.colorNode = color('#fff3cf')
  m.opacityNode = glow.add(streak.mul(0.8)).mul(flareUniforms.strength)
  return m
}

const beamGeometry = new THREE.ConeGeometry(7, BEAM_LENGTH, 28, 1, true).rotateZ(Math.PI / 2).translate(BEAM_LENGTH / 2, 0, 0)
const flareGeometry = new THREE.PlaneGeometry(1, 1)
const towerLayers = buildLighthouseGeometry()
/** The tower's lantern (and its little windows) glow on their own level, so a signal can strobe them. */
const lampLevel = uniform(0.6)
const towerMaterials = (() => {
  const m = createKitMaterials()
  m.glow.emissiveNode = vertexColor().mul(lampLevel)
  return m
})()
const tmpDir = new THREE.Vector3()
const tmpCam = new THREE.Vector3()
const lampWorld = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const lensGeometry = new THREE.BoxGeometry(0.5, 0.7, 0.5)

function Lighthouse({ position }: { position: THREE.Vector3 }) {
  const rotor = useRef<THREE.Group>(null)
  const flare = useRef<THREE.Mesh>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const camera = useThree((s) => s.camera)
  const beamMaterial = useMemo(createBeamMaterial, [])
  const flareMaterial = useMemo(createFlareMaterial, [])
  useEffect(() => {
    lighthouseRuntime.lamp.copy(position).y += LIGHTHOUSE.lamp
    lighthouseRuntime.ready = true
  }, [position])
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(60, -14, 0)
    return o
  }, [])

  useFrame((_, dt) => {
    const since = (performance.now() - useUiStore.getState().signalAt) / 1000
    const flashing = useUiStore.getState().signalAt > 0 && since < 3.5
    // A strobing signal: sharp bright blinks that ease off over the flash.
    const pulse = flashing ? Math.pow(0.5 + 0.5 * Math.sin(since * 11), 4) * (1 - (since / 3.5) * 0.4) : 0
    const night = nightRuntime.factor
    const reduced = useSettingsStore.getState().reducedMotion
    if (rotor.current) rotor.current.rotation.y += dt * (flashing ? 3 : reduced ? 0.25 : 0.55)
    beamUniforms.intensity.value = 0.3 + night * 0.65 + pulse * 2
    lampLevel.value = 0.6 + night * 2 + pulse * 7
    if (spot.current) spot.current.intensity = night * 900 + pulse * 600

    // The lamp flares when a beam swings round towards the camera.
    if (rotor.current && flare.current) {
      tmpDir.set(1, 0, 0).applyQuaternion(rotor.current.getWorldQuaternion(tmpQuat))
      lampWorld.copy(position).y += LIGHTHOUSE.lamp
      tmpCam.copy(camera.position).sub(lampWorld).normalize()
      // Sit the flare just outside the lantern glass, towards the viewer, so the glass never hides it.
      flare.current.position.set(0, LIGHTHOUSE.lamp, 0).addScaledVector(tmpCam, 1.4)
      const facing = Math.max(0, Math.abs(tmpDir.x * tmpCam.x + tmpDir.z * tmpCam.z) - Math.abs(tmpCam.y) * 0.4)
      const hit = Math.pow(facing, 12)
      flareUniforms.strength.value = (0.35 + night * 0.65) * (0.45 + hit * 1.6) + pulse * 2.5
      flare.current.scale.setScalar(2.6 + hit * 9 * (0.4 + night) + pulse * 12)
    }
  })

  return (
    <group position={position}>
      <KitMeshes layers={towerLayers} materials={towerMaterials} />
      <group ref={rotor} position-y={LIGHTHOUSE.lamp}>
        <mesh geometry={beamGeometry} material={beamMaterial} renderOrder={4} />
        <mesh geometry={beamGeometry} material={beamMaterial} rotation-y={Math.PI} renderOrder={4} />
        <primitive object={spotTarget} />
        <spotLight ref={spot} target={spotTarget} color="#fff1c4" intensity={0} distance={150} angle={0.17} penumbra={0.6} decay={1.2} />
        <mesh geometry={lensGeometry} material={kitMaterials.metal} />
      </group>
      <mesh ref={flare} geometry={flareGeometry} material={flareMaterial} position-y={LIGHTHOUSE.lamp} renderOrder={5} />
    </group>
  )
}

function StationLabel({ station }: { station: StationRuntime }) {
  const visible = useRideStore((s) => s.state === 'INTRO')
  if (!visible) return null
  const p = station.def.building === 'lighthouse' ? station.position : station.buildingPosition
  return (
    <Html position={[p.x, p.y + 7, p.z]} center zIndexRange={[10, 0]} className="station-label">
      <span className="station-label-index">{String(station.index + 1).padStart(2, '0')}</span>
      <span className="station-label-name">{station.def.name}</span>
    </Html>
  )
}

export function StationBuildings() {
  const derived = useWorldStore((s) => s.derived)
  const lighthousePos = useMemo(() => {
    if (!derived) return null
    return new THREE.Vector3(0, derived.heightfield.heightAt(0, 0) - 0.2, 0)
  }, [derived])
  const scenes = useMemo(
    () => (derived && lighthousePos ? derived.stations.map((s) => buildStationScene(derived.track, s, lighthousePos)) : []),
    [derived, lighthousePos],
  )
  const signs = useMemo(() => scenes.flatMap((s) => s.signs), [scenes])
  useEffect(() => () => scenes.forEach((s) => Object.values(s.layers).forEach((g) => g?.dispose())), [scenes])
  if (!derived || !lighthousePos) return null
  return (
    <group name="stations">
      {derived.stations.map((s, i) => (
        <StationBuilding key={s.def.id} station={s} scene={scenes[i]} />
      ))}
      <StationSigns signs={signs} />
      <Lighthouse position={lighthousePos} />
    </group>
  )
}
