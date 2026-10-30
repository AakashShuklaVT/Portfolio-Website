import * as THREE from 'three/webgpu'
import { TrackPath, GROUND, TUNNEL, type TrackRun } from '../rail/TrackPath'
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
    .addScaledVector(away, 22)
    .addScaledVector(tangent, -10)
    .addScaledVector(UP, 11)
  cam.y = Math.max(cam.y, hf.heightAt(cam.x, cam.z) + 5)
  const target = pos.clone().addScaledVector(side, BUILDING_OFFSET * 0.5).addScaledVector(UP, 2)
  return { position: cam.toArray() as CameraShot['position'], target: target.toArray() as CameraShot['target'] }
}

/** Tunnel mouths: the stone portal block reaches this far into the tunnel. */
export const PORTAL_ZONE = 1.2
/** Roof of the tunnel vault above the rail. */
const TUNNEL_COVER = 5.4
const TUNNEL_SEARCH = 4.5

/**
 * Makes tunnels truly hollow. Every vertex near the railway finds its nearest
 * rail sample. Over the inside of a tunnel the hill is raised so it always
 * clears the vault; at the mouths the terrain is cut away so the stone portal
 * and the vault inside show through instead of a wall of earth.
 */
function shapeTunnels(hf: Heightfield, track: TrackPath) {
  const tunnels = track.runs.filter((r) => r.kind === TUNNEL)
  if (!tunnels.length) return
  const { res, extent, cell, heights, cut } = hf
  const n = res + 1
  const nearest = new Float32Array(n * n).fill(Infinity)
  const owner = new Int32Array(n * n).fill(-1)
  for (let s = 0; s < track.sampleCount; s++) {
    const kind = track.kinds[s]
    if (kind !== GROUND && kind !== TUNNEL) continue
    const x = track.positions[s * 3]
    const z = track.positions[s * 3 + 2]
    const i0 = Math.max(0, Math.floor((x - TUNNEL_SEARCH + extent) / cell))
    const i1 = Math.min(res, Math.ceil((x + TUNNEL_SEARCH + extent) / cell))
    const j0 = Math.max(0, Math.floor((z - TUNNEL_SEARCH + extent) / cell))
    const j1 = Math.min(res, Math.ceil((z + TUNNEL_SEARCH + extent) / cell))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(-extent + i * cell - x, -extent + j * cell - z)
        const k = j * n + i
        if (d < nearest[k]) {
          nearest[k] = d
          owner[k] = s
        }
      }
    }
  }
  const runOf = (d: number): TrackRun | undefined => tunnels.find((r) => track.ahead(r.start, d) <= r.end - r.start)
  for (let k = 0; k < n * n; k++) {
    const s = owner[k]
    if (s < 0 || track.kinds[s] !== TUNNEL) continue
    const d = s * track.step
    const run = runOf(d)
    if (!run) continue
    const railY = track.positions[s * 3 + 1]
    const fromMouth = Math.min(track.ahead(run.start, d), track.ahead(d, run.end))
    if (fromMouth < PORTAL_ZONE) {
      if (nearest[k] < 2.7 && heights[k] < railY + 5.2) cut[k] = 1
    } else {
      const w = 1 - smoothstep(2.6, TUNNEL_SEARCH, nearest[k])
      if (w > 0) heights[k] = Math.max(heights[k], lerp(heights[k], railY + TUNNEL_COVER, w))
    }
  }
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
  shapeTunnels(heightfield, track)

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
