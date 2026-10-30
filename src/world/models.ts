import * as THREE from 'three/webgpu'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../lib/noise'

// Procedural low-poly model library. Every model is a single vertex-coloured
// geometry so it can be instanced in one draw call. GLB models dropped into
// /public/models can be registered next to these later.

export type ModelTag = 'tree' | 'bush' | 'rock' | 'prop' | 'water' | 'building'

export interface ModelDef {
  id: string
  label: string
  tags: ModelTag[]
  /** Sways in the wind (vertex displacement scaled by height). */
  wind: boolean
  /** Rough height, used to normalise wind sway. */
  height: number
  build: () => THREE.BufferGeometry
}

const tint = (geometry: THREE.BufferGeometry, color: string, jitter = 0, seed = 1) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const c = new THREE.Color(color)
  const rand = mulberry32(seed)
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 3) {
    const k = 1 + (rand() - 0.5) * jitter
    for (let v = 0; v < 3; v++) colors.set([c.r * k, c.g * k, c.b * k], (i + v) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  return g
}

/** Push vertices around (keeping shared corners together) for a hand-made look. */
const lumpy = (geometry: THREE.BufferGeometry, amount: number, seed: number) => {
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

const finish = (parts: THREE.BufferGeometry[]) => {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

const cone = (r: number, h: number, y: number, segs = 7) => new THREE.ConeGeometry(r, h, segs, 1).translate(0, y + h / 2, 0)
const cyl = (r0: number, r1: number, h: number, y: number, segs = 6) => new THREE.CylinderGeometry(r1, r0, h, segs).translate(0, y + h / 2, 0)

function pine(seed: number, tall = false) {
  const s = tall ? 1.3 : 1
  return finish([
    tint(cyl(0.2, 0.16, 1.1 * s, 0), '#7a5136', 0.1, seed),
    tint(cone(1.35, 1.7 * s, 0.9 * s), '#3f7d4a', 0.12, seed + 1),
    tint(cone(1.05, 1.5 * s, 1.85 * s), '#4b8c50', 0.12, seed + 2),
    tint(cone(0.72, 1.3 * s, 2.75 * s), '#5a9b56', 0.12, seed + 3),
  ])
}

function roundTree(seed: number) {
  const crown = lumpy(new THREE.IcosahedronGeometry(1.25, 1), 0.35, seed).scale(1, 1.05, 1).translate(0, 2.6, 0)
  const crown2 = lumpy(new THREE.IcosahedronGeometry(0.8, 0), 0.25, seed + 9).translate(0.7, 2.1, 0.3)
  return finish([
    tint(cyl(0.22, 0.16, 1.8, 0), '#7a5136', 0.1, seed),
    tint(crown, '#7fae4e', 0.14, seed + 1),
    tint(crown2, '#8fbb57', 0.14, seed + 2),
  ])
}

function bush(seed: number) {
  return finish([
    tint(lumpy(new THREE.IcosahedronGeometry(0.7, 0), 0.25, seed).scale(1, 0.7, 1).translate(0, 0.35, 0), '#6f9f48', 0.15, seed),
    tint(lumpy(new THREE.IcosahedronGeometry(0.45, 0), 0.2, seed + 3).scale(1, 0.75, 1).translate(0.55, 0.25, 0.2), '#82ad52', 0.15, seed + 1),
  ])
}

function rock(seed: number, color = '#b3a493') {
  return finish([tint(lumpy(new THREE.DodecahedronGeometry(0.9, 0), 0.45, seed).scale(1, 0.7, 1.1).translate(0, 0.3, 0), color, 0.18, seed)])
}

function boat(seed: number) {
  const hull = new THREE.CylinderGeometry(0.9, 0.55, 3.2, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2)
  hull.scale(1, 0.7, 1).translate(0, 0.55, 0)
  return finish([
    tint(hull, '#c9573f', 0.05, seed),
    tint(new THREE.BoxGeometry(1.5, 0.08, 3).translate(0, 0.58, 0), '#e9d8b4', 0.05, seed),
    tint(cyl(0.06, 0.05, 2.6, 0.6, 5), '#7a5136', 0, seed),
    tint(new THREE.ConeGeometry(0.9, 2.0, 3).rotateY(Math.PI / 6).scale(0.08, 1, 1).translate(0, 2.0, -0.35), '#f7f2ea', 0.03, seed),
  ])
}

function pier(seed: number) {
  const parts: THREE.BufferGeometry[] = [tint(new THREE.BoxGeometry(2.2, 0.18, 10).translate(0, 0.7, 5), '#a87a52', 0.12, seed)]
  for (let z = 0.5; z <= 9.5; z += 3) {
    for (const x of [-0.95, 0.95]) parts.push(tint(cyl(0.12, 0.12, 2.4, -1.7, 5).translate(x, 0, z), '#6e4a33', 0.05, seed))
  }
  return finish(parts)
}

function fence(seed: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-1.4, 0, 1.4]) parts.push(tint(new THREE.BoxGeometry(0.15, 0.9, 0.15).translate(x, 0.45, 0), '#9a6a45', 0.1, seed))
  parts.push(tint(new THREE.BoxGeometry(3, 0.1, 0.08).translate(0, 0.65, 0), '#b07d52', 0.05, seed))
  parts.push(tint(new THREE.BoxGeometry(3, 0.1, 0.08).translate(0, 0.35, 0), '#b07d52', 0.05, seed))
  return finish(parts)
}

function crates(seed: number) {
  return finish([
    tint(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(0, 0.4, 0), '#b8874f', 0.1, seed),
    tint(new THREE.BoxGeometry(0.6, 0.6, 0.6).rotateY(0.4).translate(0.75, 0.3, 0.2), '#a8773f', 0.1, seed + 1),
    tint(new THREE.BoxGeometry(0.55, 0.55, 0.55).rotateY(0.2).translate(0.1, 1.08, 0.05), '#c0925a', 0.1, seed + 2),
  ])
}

function mineCart(seed: number) {
  return finish([
    tint(new THREE.CylinderGeometry(0.75, 0.55, 0.8, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.4).translate(0, 0.75, 0), '#6b625b', 0.1, seed),
    tint(lumpy(new THREE.IcosahedronGeometry(0.45, 0), 0.2, seed).scale(1.3, 0.6, 1.6).translate(0, 1.15, 0), '#e0b54a', 0.2, seed + 1),
    ...[-0.5, 0.5].flatMap((z) => [-0.5, 0.5].map((x) => tint(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8).rotateZ(Math.PI / 2).translate(x, 0.2, z), '#3a3230', 0, seed))),
  ])
}

function flowers(seed: number) {
  const rand = mulberry32(seed)
  const colors = ['#f2c14e', '#ef8a6f', '#f7f2ea', '#c98bd6']
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 7; i++) {
    const x = (rand() - 0.5) * 1.4
    const z = (rand() - 0.5) * 1.4
    parts.push(tint(cyl(0.025, 0.025, 0.35, 0, 3).translate(x, 0, z), '#5f8f4e', 0, seed))
    parts.push(tint(new THREE.OctahedronGeometry(0.1, 0).translate(x, 0.4, z), colors[i % colors.length], 0.1, seed + i))
  }
  return finish(parts)
}

export const MODELS: ModelDef[] = [
  { id: 'pine', label: 'Pine', tags: ['tree'], wind: true, height: 4, build: () => pine(11) },
  { id: 'pine-tall', label: 'Tall pine', tags: ['tree'], wind: true, height: 5.3, build: () => pine(21, true) },
  { id: 'round-tree', label: 'Round tree', tags: ['tree'], wind: true, height: 3.8, build: () => roundTree(31) },
  { id: 'bush', label: 'Bush', tags: ['bush'], wind: true, height: 1, build: () => bush(41) },
  { id: 'flowers', label: 'Flowers', tags: ['bush'], wind: true, height: 0.5, build: () => flowers(45) },
  { id: 'rock', label: 'Rock', tags: ['rock'], wind: false, height: 1, build: () => rock(51) },
  { id: 'rock-dark', label: 'Dark rock', tags: ['rock'], wind: false, height: 1, build: () => rock(61, '#948473') },
  { id: 'boat', label: 'Sail boat', tags: ['prop', 'water'], wind: false, height: 3, build: () => boat(71) },
  { id: 'pier', label: 'Pier', tags: ['prop', 'water'], wind: false, height: 1, build: () => pier(81) },
  { id: 'fence', label: 'Fence', tags: ['prop'], wind: false, height: 1, build: () => fence(91) },
  { id: 'crates', label: 'Crates', tags: ['prop'], wind: false, height: 1.3, build: () => crates(101) },
  { id: 'mine-cart', label: 'Mine cart', tags: ['prop'], wind: false, height: 1.3, build: () => mineCart(111) },
]

export const MODEL_MAP = new Map(MODELS.map((m) => [m.id, m]))

const geometryCache = new Map<string, THREE.BufferGeometry>()
export function getModelGeometry(id: string) {
  let g = geometryCache.get(id)
  if (!g) {
    const def = MODEL_MAP.get(id)
    g = def ? def.build() : new THREE.BoxGeometry(1, 1, 1)
    geometryCache.set(id, g)
  }
  return g
}
