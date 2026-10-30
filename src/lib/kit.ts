import * as THREE from 'three/webgpu'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { mulberry32 } from './noise'

// A tiny modelling kit: primitives are tinted with vertex colours, placed,
// and merged into one flat-shaded geometry per layer. A detailed building or
// carriage made of a hundred parts still renders in one or two draw calls.

export type KitLayer = 'base' | 'metal' | 'glow'
type V3 = [number, number, number]

export interface Placement {
  position?: V3
  rotation?: V3
  scale?: number | V3
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function placementMatrix({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: Placement) {
  _p.fromArray(position)
  _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]))
  if (typeof scale === 'number') _s.setScalar(scale)
  else _s.fromArray(scale)
  return _m.compose(_p, _q, _s)
}

/** Push vertices around (keeping shared corners together) for a hand-made look. */
export function lumpy(geometry: THREE.BufferGeometry, amount: number, seed: number) {
  const base = geometry.clone()
  base.deleteAttribute('normal')
  base.deleteAttribute('uv')
  const g = mergeVertices(base)
  const rand = mulberry32(seed)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + (rand() - 0.5) * amount, pos.getY(i) + (rand() - 0.5) * amount, pos.getZ(i) + (rand() - 0.5) * amount)
  }
  return g
}

export class Kit {
  private layers = new Map<KitLayer, THREE.BufferGeometry[]>()
  private rand: () => number
  /** Optional parent transform applied to everything added (for sub-assemblies). */
  private stack: THREE.Matrix4[] = []

  constructor(seed = 1) {
    this.rand = mulberry32(seed)
  }

  /** Run `fn` with every part placed relative to the given transform. */
  group(placement: Placement, fn: () => void) {
    const m = placementMatrix(placement).clone()
    const parent = this.stack[this.stack.length - 1]
    this.stack.push(parent ? parent.clone().multiply(m) : m)
    fn()
    this.stack.pop()
    return this
  }

  add(geometry: THREE.BufferGeometry, color: string, placement: Placement = {}, layer: KitLayer = 'base', jitter = 0.06) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name)
    const m = placementMatrix(placement)
    const parent = this.stack[this.stack.length - 1]
    g.applyMatrix4(parent ? parent.clone().multiply(m) : m)
    const c = new THREE.Color(color)
    const count = g.attributes.position.count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 3) {
      const k = 1 + (this.rand() - 0.5) * jitter
      for (let v = 0; v < 3 && i + v < count; v++) colors.set([c.r * k, c.g * k, c.b * k], (i + v) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    let list = this.layers.get(layer)
    if (!list) this.layers.set(layer, (list = []))
    list.push(g)
    return this
  }

  box(size: V3, color: string, position: V3 = [0, 0, 0], rotation?: V3, layer?: KitLayer) {
    return this.add(new THREE.BoxGeometry(size[0], size[1], size[2]), color, { position, rotation }, layer)
  }

  /** Cylinder along y; `rotation` turns it (e.g. [PI/2,0,0] to lie along z). */
  cyl(rTop: number, rBottom: number, h: number, color: string, position: V3 = [0, 0, 0], rotation?: V3, segs = 10, layer?: KitLayer) {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, segs), color, { position, rotation }, layer)
  }

  /** Cone sitting on its base at `position`. */
  cone(r: number, h: number, color: string, position: V3 = [0, 0, 0], segs = 8, rotation?: V3, layer?: KitLayer) {
    return this.add(new THREE.ConeGeometry(r, h, segs).translate(0, h / 2, 0), color, { position, rotation }, layer)
  }

  sphere(r: number, color: string, position: V3 = [0, 0, 0], scale: number | V3 = 1, detail = 1, layer?: KitLayer) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, { position, scale }, layer)
  }

  /** Gable roof: footprint w (x) by d (z), ridge along x, eaves at y = 0. */
  gable(w: number, d: number, h: number, color: string, position: V3 = [0, 0, 0], rotation?: V3, thickness = 0.12) {
    const g = gableGeometry(w, d, h, thickness)
    return this.add(g, color, { position, rotation })
  }

  build(): Partial<Record<KitLayer, THREE.BufferGeometry>> {
    const out: Partial<Record<KitLayer, THREE.BufferGeometry>> = {}
    for (const [layer, parts] of this.layers) {
      if (!parts.length) continue
      const merged = mergeGeometries(parts)!
      merged.computeVertexNormals()
      merged.computeBoundingSphere()
      merged.computeBoundingBox()
      out[layer] = merged
      parts.forEach((p) => p.dispose())
    }
    this.layers.clear()
    return out
  }
}

/** A roof with thickness and overhanging eaves; ridge along x. */
export function gableGeometry(w: number, d: number, h: number, t = 0.12) {
  const hd = d / 2
  const shape = new THREE.Shape()
  shape.moveTo(-hd, 0)
  shape.lineTo(0, h)
  shape.lineTo(hd, 0)
  shape.lineTo(hd - t, 0)
  shape.lineTo(0, h - t * 1.4)
  shape.lineTo(-hd + t, 0)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false })
  g.translate(0, 0, -w / 2)
  g.rotateY(Math.PI / 2)
  return g
}

/** Solid triangular gable end (the wall under a roof). */
export function gableEndGeometry(d: number, h: number, depth = 0.1) {
  const hd = d / 2
  const shape = new THREE.Shape()
  shape.moveTo(-hd, 0)
  shape.lineTo(0, h)
  shape.lineTo(hd, 0)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2)
}

/** Half-cylinder arched roof along z: width w, length l, rise h. */
export function archRoofGeometry(w: number, l: number, h: number, segs = 8) {
  const g = new THREE.CylinderGeometry(1, 1, l, segs * 2, 1, false, -Math.PI / 2, Math.PI)
  g.rotateX(-Math.PI / 2)
  g.scale(w / 2, h, 1)
  return g
}
