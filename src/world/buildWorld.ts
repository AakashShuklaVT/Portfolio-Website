import * as THREE from 'three/webgpu'
import { TrackPath, GROUND, TUNNEL } from '../rail/TrackPath'
import { lerp, smoothstep } from '../lib/math'
import { createNaturalHeight, generateHeightfield, type HeightFn, type Heightfield, type Stamp } from './terrainGen'
import type { CameraShot, StationDef, WorldData } from './types'

export interface StationRuntime {
  def: StationDef
  index: number
  /** Stop distance along the track. */
  distance: number
  position: THREE.Vector3
  tangent: THREE.Vector3
  /** Unit vector from the track towards the building. */
  side: THREE.Vector3
  buildingPosition: THREE.Vector3
  camera: CameraShot
}

export interface DerivedWorld {
  natural: HeightFn
  track: TrackPath
  heightfield: Heightfield
  stations: StationRuntime[]
}

const UP = new THREE.Vector3(0, 1, 0)
const BUILDING_OFFSET = 6

function defaultStationCamera(pos: THREE.Vector3, tangent: THREE.Vector3, side: THREE.Vector3, hf: Heightfield): CameraShot {
  // Stand on the open (outer) side of the track, a little behind, looking back at the platform.
  const away = side.clone().negate()
  const cam = pos
    .clone()
    .addScaledVector(away, 17)
    .addScaledVector(tangent, -7)
    .addScaledVector(UP, 8)
  cam.y = Math.max(cam.y, hf.heightAt(cam.x, cam.z) + 4)
  const target = pos.clone().addScaledVector(side, BUILDING_OFFSET * 0.5).addScaledVector(UP, 2)
  return { position: cam.toArray() as CameraShot['position'], target: target.toArray() as CameraShot['target'] }
}

export function buildDerivedWorld(world: WorldData): DerivedWorld {
  const natural = createNaturalHeight(world.terrain)
  const track = new TrackPath(world.track, natural)

  const stationBase = world.stations.map((def) => {
    const distance = track.nearestDistance({ x: def.anchor[0], y: def.anchor[1], z: def.anchor[2] })
    const position = track.getPointAt(distance, new THREE.Vector3())
    const tangent = track.getTangentAt(distance, new THREE.Vector3())
    tangent.y = 0
    tangent.normalize()
    const left = new THREE.Vector3().crossVectors(UP, tangent).normalize()
    // Default: build on the uphill (inner) side of the line.
    const inward = new THREE.Vector3(-position.x, 0, -position.z).normalize()
    const sideSign = def.side ?? (left.dot(inward) >= 0 ? 1 : -1)
    const side = left.multiplyScalar(sideSign)
    const buildingPosition = position.clone().addScaledVector(side, BUILDING_OFFSET)
    return { def, distance, position, tangent, side, buildingPosition }
  })

  // Flatten the rail bed along ground runs and pads under every station.
  // Near tunnel mouths the cut narrows so the hill above the portal survives.
  const portals = track.runs.filter((r) => r.kind === TUNNEL).flatMap((r) => [r.start, r.end])
  const stamps: Stamp[] = []
  for (let i = 0; i < track.sampleCount; i++) {
    if (track.kinds[i] !== GROUND) continue
    const d = i * track.step
    const toPortal = portals.reduce((m, pd) => Math.min(m, track.ahead(d, pd), track.ahead(pd, d)), Infinity)
    const k = smoothstep(1, 12, toPortal)
    stamps.push({
      x: track.positions[i * 3],
      z: track.positions[i * 3 + 2],
      y: track.positions[i * 3 + 1] - 0.35,
      inner: lerp(1.8, 2.2, k),
      outer: lerp(2.8, 7.5, k),
      path: 1,
    })
  }
  for (const s of stationBase) {
    stamps.push({
      x: s.buildingPosition.x,
      z: s.buildingPosition.z,
      y: s.position.y - 0.3,
      inner: 5.5,
      outer: 11,
      path: 0.35,
    })
  }
  const heightfield = generateHeightfield(world.terrain, natural, stamps)

  const stations: StationRuntime[] = stationBase
    .map((s) => ({
      ...s,
      index: 0,
      camera: s.def.camera ?? defaultStationCamera(s.position, s.tangent, s.side, heightfield),
    }))
    .sort((a, b) => a.distance - b.distance)
  stations.forEach((s, i) => (s.index = i))

  return { natural, track, heightfield, stations }
}
