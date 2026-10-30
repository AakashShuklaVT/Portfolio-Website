import * as THREE from 'three/webgpu'
import type { TrackPath } from './TrackPath'

const UP = new THREE.Vector3(0, 1, 0)

export interface Frame {
  pos: THREE.Vector3
  tangent: THREE.Vector3
  side: THREE.Vector3
  up: THREE.Vector3
}

/** Orthonormal frame at a distance: side is horizontal (left), up leans with the slope. */
export function frameAt(track: TrackPath, d: number, out?: Frame): Frame {
  const f = out ?? { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3(), up: new THREE.Vector3() }
  track.getPointAt(d, f.pos)
  track.getTangentAt(d, f.tangent)
  f.side.crossVectors(UP, f.tangent).normalize()
  f.up.crossVectors(f.tangent, f.side).normalize()
  return f
}

/**
 * Sweep a closed 2D profile (side, up) along [start, end] of the track.
 * Produces a flat-shaded, non-indexed geometry.
 */
export function sweepProfile(track: TrackPath, ranges: [number, number][], profile: [number, number][], step = 0.5) {
  const pos: number[] = []
  const f = frameAt(track, 0)
  const ring = (d: number) => {
    frameAt(track, d, f)
    return profile.map(([s, u]) => f.pos.clone().addScaledVector(f.side, s).addScaledVector(f.up, u))
  }
  for (const [start, end] of ranges) {
    const count = Math.max(1, Math.ceil((end - start) / step))
    let prev = ring(start)
    for (let i = 1; i <= count; i++) {
      const next = ring(start + ((end - start) * i) / count)
      for (let k = 0; k < profile.length; k++) {
        const k2 = (k + 1) % profile.length
        const a = prev[k]
        const b = prev[k2]
        const c = next[k]
        const d = next[k2]
        pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
        pos.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
      }
      prev = next
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Tunnel portal dimensions (metres, relative to the rail at the portal face). */
export const PORTAL = {
  width: 7.2,
  height: 6.0,
  halfWidth: 1.85,
  /** Height where the arch starts. */
  spring: 2.45,
  /** Depth of the stone block; it reaches past the terrain cut at the mouth. */
  depth: 3.7,
  /** How far in front of the tunnel start the facade stands. */
  lead: 1.2,
}

/** Stone portal block: a slab with an arched opening, face at z = 0, extending back along -z. */
export function createPortalGeometry() {
  const { width: w, height: h, halfWidth: hw, spring } = PORTAL
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, -0.8)
  shape.lineTo(w / 2, -0.8)
  shape.lineTo(w / 2, h - 0.8)
  shape.lineTo(-w / 2, h - 0.8)
  shape.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-hw, -0.8)
  hole.lineTo(hw, -0.8)
  hole.lineTo(hw, spring)
  hole.absarc(0, spring, hw, 0, Math.PI, false)
  hole.lineTo(-hw, -0.8)
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: PORTAL.depth, bevelEnabled: false, curveSegments: 8 })
  geometry.translate(0, 0, -PORTAL.depth)
  return geometry
}
