import * as THREE from 'three/webgpu'
import type { HeightFn } from '../world/terrainGen'
import type { TrackData } from '../world/types'

export type TrackKind = 0 | 1 | 2 | 3
export const GROUND: TrackKind = 0
export const TUNNEL: TrackKind = 1
export const BRIDGE: TrackKind = 2
/** Between the two portal gates: not rendered, the train travels through it hidden. */
export const WARP: TrackKind = 3

export interface TrackRun {
  kind: TrackKind
  start: number
  end: number
}

const SAMPLE_STEP = 0.5
const MIN_RUN = 4

/**
 * The railway as a closed, arc-length parameterised curve.
 * Distances wrap around the loop; everything is queried by distance.
 */
export class TrackPath {
  readonly curve: THREE.CatmullRomCurve3
  readonly length: number
  readonly sampleCount: number
  readonly step: number
  /** xyz per sample */
  readonly positions: Float32Array
  readonly kinds: Uint8Array
  readonly runs: TrackRun[]
  /** The hidden stretch between the exit gate (start) and the entry gate (end), if the track has gates. */
  readonly warp: { start: number; end: number; length: number } | null

  constructor(data: TrackData, natural: HeightFn) {
    const pts = data.points.map(({ p }) => new THREE.Vector3(p[0], p[1], p[2]))
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
    this.curve.arcLengthDivisions = Math.max(2000, pts.length * 40)
    this.length = this.curve.getLength()
    this.sampleCount = Math.ceil(this.length / SAMPLE_STEP)
    this.step = this.length / this.sampleCount

    this.positions = new Float32Array(this.sampleCount * 3)
    const spaced = this.curve.getSpacedPoints(this.sampleCount)
    for (let i = 0; i < this.sampleCount; i++) spaced[i].toArray(this.positions, i * 3)

    this.kinds = new Uint8Array(this.sampleCount)
    for (let i = 0; i < this.sampleCount; i++) {
      const x = this.positions[i * 3]
      const y = this.positions[i * 3 + 1]
      const z = this.positions[i * 3 + 2]
      const ground = natural(x, z)
      this.kinds[i] = ground - y > data.tunnelDepth ? TUNNEL : y - ground > data.bridgeHeight ? BRIDGE : GROUND
    }
    this.warp = null
    if (data.warp) {
      const [ex, ey, ez] = data.warp.exit
      const [nx, ny, nz] = data.warp.entry
      const start = this.nearestDistance({ x: ex, y: ey, z: ez })
      const end = this.nearestDistance({ x: nx, y: ny, z: nz })
      const length = this.ahead(start, end)
      if (length > 1) {
        this.warp = { start, end, length }
        const a = Math.round(start / this.step)
        const count = Math.round(length / this.step)
        for (let k = 0; k < count; k++) this.kinds[(a + k) % this.sampleCount] = WARP
      }
    }
    this.runs = this.buildRuns()
  }

  /** Merge kinds into runs and absorb runs too short to read as a tunnel or bridge. */
  private buildRuns(): TrackRun[] {
    const n = this.sampleCount
    const raw: { kind: TrackKind; a: number; b: number }[] = []
    for (let i = 0; i < n; i++) {
      const k = this.kinds[i] as TrackKind
      const last = raw[raw.length - 1]
      if (last && last.kind === k) last.b = i
      else raw.push({ kind: k, a: i, b: i })
    }
    // wrap: join the first and last runs when they share a kind
    if (raw.length > 1 && raw[0].kind === raw[raw.length - 1].kind) {
      const last = raw.pop()!
      raw[0].a = last.a - n
    }
    let changed = true
    while (changed && raw.length > 1) {
      changed = false
      for (const run of raw) {
        if (run.kind !== GROUND && (run.b - run.a + 1) * this.step < MIN_RUN) {
          run.kind = GROUND
          changed = true
        }
      }
      for (let r = raw.length - 1; r > 0; r--) {
        if (raw[r].kind === raw[r - 1].kind) {
          raw[r - 1].b = raw[r].b
          raw.splice(r, 1)
        }
      }
    }
    for (const run of raw) for (let i = run.a; i <= run.b; i++) this.kinds[((i % n) + n) % n] = run.kind
    return raw.map((r) => ({ kind: r.kind, start: r.a * this.step, end: (r.b + 1) * this.step }))
  }

  wrap(d: number) {
    return ((d % this.length) + this.length) % this.length
  }

  /** Forward distance from a to b along the loop. */
  ahead(a: number, b: number) {
    return this.wrap(b - a)
  }

  /** True inside the hidden stretch between the gates. */
  inWarp(d: number) {
    return !!this.warp && this.ahead(this.warp.start, d) < this.warp.length
  }

  kindAt(d: number): TrackKind {
    return this.kinds[Math.floor(this.wrap(d) / this.step) % this.sampleCount] as TrackKind
  }

  getPointAt(d: number, target: THREE.Vector3) {
    return this.curve.getPointAt(this.wrap(d) / this.length, target)
  }

  getTangentAt(d: number, target: THREE.Vector3) {
    return this.curve.getTangentAt(this.wrap(d) / this.length, target)
  }

  /** Distance along the track of the sample nearest to a point. */
  nearestDistance(p: { x: number; y: number; z: number }) {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < this.sampleCount; i++) {
      const dx = this.positions[i * 3] - p.x
      const dy = this.positions[i * 3 + 1] - p.y
      const dz = this.positions[i * 3 + 2] - p.z
      const d = dx * dx + dy * dy * 4 + dz * dz
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best * this.step
  }
}
