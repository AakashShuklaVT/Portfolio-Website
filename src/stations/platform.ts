import { GROUND, type TrackPath } from '../rail/TrackPath'
import { frameAt, sweepProfile } from '../rail/trackGeometry'
import * as THREE from 'three/webgpu'
import type { StationRuntime } from '../world/buildWorld'
import type { StationBuilding } from '../world/types'
import { Kit } from '../lib/kit'
import { PALETTE } from './stationKits'

/** Platform extent along the track, relative to the stop (the train stops with its nose at 0). */
const PLATFORM_BACK = 16
const PLATFORM_AHEAD = 2

/**
 * A platform that follows the curve of the line on the building side, so it
 * never cuts into the track. It is clipped to open ground (no platforms in tunnels).
 */
export function buildPlatform(track: TrackPath, station: StationRuntime) {
  const f = frameAt(track, station.distance)
  const sign = Math.sign(f.side.dot(station.side)) || 1
  const ranges: [number, number][] = []
  let start: number | null = null
  for (let d = -PLATFORM_BACK; d <= PLATFORM_AHEAD; d += 0.5) {
    const ok = track.kindAt(station.distance + d) === GROUND
    if (ok && start === null) start = d
    if ((!ok || d + 0.5 > PLATFORM_AHEAD) && start !== null) {
      ranges.push([station.distance + start, station.distance + (ok ? d : d - 0.5)])
      start = null
    }
  }
  const shape = (inner: number, outer: number, bottom: number, top: number) => {
    const p: [number, number][] = [
      [inner * sign, bottom],
      [outer * sign, bottom],
      [outer * sign, top],
      [inner * sign, top],
    ]
    return sign < 0 ? p.reverse() : p
  }
  return {
    body: sweepProfile(track, ranges, shape(1.42, 3.9, -0.8, 0.7), 0.5),
    edge: sweepProfile(track, ranges, shape(1.38, 1.75, 0.69, 0.75), 0.5),
  }
}

const CANOPY: Record<StationBuilding, string> = {
  harbor: PALETTE.roofTeal,
  woodland: PALETTE.roofMoss,
  mine: PALETTE.roofSlate,
  village: PALETTE.roofRed,
  lighthouse: PALETTE.roofRed,
}

const signCache = new Map<string, THREE.MeshStandardNodeMaterial>()

/** A painted station name board, drawn to a canvas (redrawn once the display font has loaded). */
function signMaterial(name: string, accent: string) {
  let m = signCache.get(name)
  if (m) return m
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 244
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const draw = () => {
    const c = canvas.getContext('2d')!
    c.fillStyle = '#2b2522'
    c.fillRect(0, 0, 1024, 244)
    c.fillStyle = '#f6ecd8'
    c.fillRect(14, 14, 996, 216)
    c.fillStyle = accent
    c.fillRect(14, 196, 996, 34)
    c.fillStyle = '#2b2522'
    c.font = '600 112px Fraunces, Georgia, serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(name, 512, 104, 940)
    texture.needsUpdate = true
  }
  draw()
  document.fonts?.ready.then(draw)
  m = new THREE.MeshStandardNodeMaterial({ map: texture, roughness: 0.7 })
  signCache.set(name, m)
  return m
}

/**
 * Platform dressing in world space: a curved canopy on posts, lamps, benches
 * and name boards, all following the line.
 */
export function platformFurniture(track: TrackPath, station: StationRuntime) {
  const kit = new Kit(station.index + 40)
  const f = frameAt(track, station.distance)
  const sign = Math.sign(f.side.dot(station.side)) || 1
  const roof = CANOPY[station.def.building]
  const at = (d: number, s: number, up = 0) => {
    frameAt(track, station.distance + d, f)
    const p = f.pos.clone().addScaledVector(f.side, s * sign).addScaledVector(f.up, up)
    const facing = f.side.clone().multiplyScalar(-sign)
    return { p, yaw: Math.atan2(facing.x, facing.z) }
  }
  const ok = (d: number) => track.kindAt(station.distance + d) === GROUND

  // Canopy over the middle of the platform.
  const c0 = -10
  const c1 = -2
  if (ok(c0) && ok(c1)) {
    const roofShape: [number, number][] = [
      [1.75 * sign, 3.35],
      [3.95 * sign, 3.05],
      [3.95 * sign, 3.2],
      [1.75 * sign, 3.5],
    ]
    const canopy = sweepProfile(track, [[station.distance + c0, station.distance + c1]], sign < 0 ? roofShape.reverse() : roofShape, 0.5)
    kit.add(canopy, roof)
    canopy.dispose()
    const valance: [number, number][] = [
      [1.7 * sign, 3.1],
      [1.78 * sign, 3.1],
      [1.78 * sign, 3.42],
      [1.7 * sign, 3.42],
    ]
    const trim = sweepProfile(track, [[station.distance + c0, station.distance + c1]], sign < 0 ? valance.reverse() : valance, 0.5)
    kit.add(trim, PALETTE.cream)
    trim.dispose()
    for (let d = c0 + 0.5; d <= c1; d += 2.5) {
      const { p, yaw } = at(d, 3.5)
      kit.group({ position: [p.x, p.y, p.z], rotation: [0, yaw, 0] }, () => {
        kit.cyl(0.08, 0.08, 2.4, PALETTE.iron, [0, 1.9, 0], undefined, 6, 'metal')
        kit.box([0.06, 0.6, 0.06], PALETTE.iron, [0, 2.95, 0.4], [0.9, 0, 0], 'metal')
      })
    }
    const b = at(-6, 3.25, 0.7)
    kit.group({ position: [b.p.x, b.p.y, b.p.z], rotation: [0, b.yaw, 0] }, () => {
      kit.box([1.5, 0.08, 0.42], PALETTE.woodLight, [0, 0.45, 0])
      kit.box([1.5, 0.3, 0.06], PALETTE.woodLight, [0, 0.72, -0.2])
      for (const x of [-0.62, 0.62]) kit.box([0.08, 0.45, 0.4], PALETTE.iron, [x, 0.22, 0], undefined, 'metal')
    })
  }

  // Lamps along the platform
  for (const d of [-14, 0.5]) {
    if (!ok(d)) continue
    const { p } = at(d, 3.5, 0.7)
    kit.cyl(0.06, 0.08, 2.4, PALETTE.iron, [p.x, p.y + 1.2, p.z], undefined, 6, 'metal')
    kit.box([0.3, 0.38, 0.3], PALETTE.glass, [p.x, p.y + 2.6, p.z], undefined, 'glow')
    kit.cone(0.28, 0.22, PALETTE.iron, [p.x, p.y + 2.79, p.z], 4, [0, Math.PI / 4, 0], 'metal')
  }

  // Name boards on posts, double-sided.
  const signs: { position: THREE.Vector3; yaw: number; material: THREE.Material }[] = []
  const material = typeof document === 'undefined' ? null : signMaterial(station.def.name, roof)
  for (const d of [-12.5, -1]) {
    if (!ok(d) || !material) continue
    const { p, yaw } = at(d, 3.4, 0.7)
    const along = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    for (const o of [-1.2, 1.2]) kit.box([0.1, 2.3, 0.1], PALETTE.iron, [p.x + along.x * o, p.y + 1.15, p.z + along.z * o], undefined, 'metal')
    kit.box([2.75, 0.75, 0.08], '#2b2522', [p.x, p.y + 2.05, p.z], [0, yaw, 0])
    const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    signs.push({ position: p.clone().add(new THREE.Vector3(0, 2.05, 0)).addScaledVector(n, 0.05), yaw, material })
    signs.push({ position: p.clone().add(new THREE.Vector3(0, 2.05, 0)).addScaledVector(n, -0.05), yaw: yaw + Math.PI, material })
  }

  return { layers: kit.build(), signs }
}
