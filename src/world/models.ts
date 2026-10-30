import * as THREE from 'three/webgpu'
import { mulberry32 } from '../lib/noise'
import { Kit, lumpy } from '../lib/kit'

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

const PI = Math.PI

/** Build with the kit and return the single merged layer. */
function single(seed: number, fn: (kit: Kit, rand: () => number) => void) {
  const kit = new Kit(seed)
  fn(kit, mulberry32(seed * 7 + 1))
  return kit.build().base!
}

/** Colour faces whose centre is above `y` and facing up (moss, grass caps, snow). */
function capTint(geometry: THREE.BufferGeometry, y: number, color: string, minUp = 0.35) {
  const pos = geometry.attributes.position
  const col = geometry.attributes.color
  const c = new THREE.Color(color)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const d = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    d.fromBufferAttribute(pos, i + 2)
    const cy = (a.y + b.y + d.y) / 3
    const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize()
    if (cy > y && n.y > minUp) for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r, c.g, c.b)
  }
  return geometry
}

/** A cone with its rim pushed around a little, so tiers of a pine don't look machined. */
const ragged = (r: number, h: number, segs: number, seed: number) => {
  const g = lumpy(new THREE.ConeGeometry(r, h, segs, 1), r * 0.18, seed)
  return g.translate(0, h / 2, 0)
}

function pine(seed: number, tall = false) {
  return single(seed, (kit, rand) => {
    const s = tall ? 1.35 : 1
    const tiers = tall ? 6 : 5
    kit.cyl(0.13, 0.22, 1.3 * s, '#6e4630', [0, 0.6 * s, 0], undefined, 6)
    kit.cyl(0.2, 0.3, 0.25, '#5d3b28', [0, 0.1, 0], undefined, 6)
    const greens = ['#2f6b40', '#3a7a46', '#44884c', '#4f9452', '#5a9e56', '#66a85c']
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1)
      const r = (1.5 - t * 1.1) * (tall ? 0.85 : 1)
      const h = (1.25 - t * 0.35) * s
      const y = (0.85 + i * 0.62) * s
      kit.add(ragged(r, h, 8, seed + i), greens[i], { position: [0, y, 0], rotation: [0, rand() * PI, 0] }, 'base', 0.14)
    }
  })
}

function roundTree(seed: number) {
  return single(seed, (kit, rand) => {
    kit.cyl(0.14, 0.24, 1.9, '#7a5136', [0, 0.95, 0], undefined, 6)
    kit.cyl(0.07, 0.11, 1.0, '#7a5136', [0.35, 1.9, 0.1], [0, 0, -0.7], 5)
    kit.cyl(0.07, 0.1, 0.9, '#7a5136', [-0.3, 2.0, -0.1], [0.2, 0, 0.6], 5)
    const greens = ['#6f9f48', '#7fae4e', '#8fbb57', '#79a84c']
    const blobs: [number, number, number, number][] = [
      [0, 2.75, 0, 1.15],
      [0.75, 2.35, 0.25, 0.8],
      [-0.7, 2.45, -0.15, 0.78],
      [0.15, 3.35, -0.3, 0.7],
      [-0.2, 2.2, 0.7, 0.6],
    ]
    blobs.forEach(([x, y, z, r], i) => {
      const g = lumpy(new THREE.IcosahedronGeometry(r, 1), r * 0.3, seed + i)
      kit.add(g, greens[i % greens.length], { position: [x, y, z], rotation: [rand(), rand(), rand()] }, 'base', 0.16)
    })
  })
}

function birch(seed: number) {
  return single(seed, (kit, rand) => {
    kit.cyl(0.1, 0.15, 3.2, '#efe9df', [0, 1.6, 0], undefined, 6)
    for (let i = 0; i < 6; i++) kit.box([0.05, 0.05, 0.2], '#3d3633', [0.12 * Math.cos(i * 2.1), 0.5 + i * 0.45, 0.12 * Math.sin(i * 2.1)], [0, i * 2.1, 0])
    kit.cyl(0.04, 0.06, 0.9, '#efe9df', [0.3, 2.4, 0], [0, 0, -0.6], 5)
    const greens = ['#a6c35a', '#b6cf63', '#94b552']
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2
      const g = lumpy(new THREE.IcosahedronGeometry(0.62, 0), 0.22, seed + i)
      kit.add(g, greens[i % 3], { position: [Math.cos(a) * 0.45, 3.0 + rand() * 0.8, Math.sin(a) * 0.45], scale: [1, 1.25, 1] }, 'base', 0.14)
    }
    kit.add(lumpy(new THREE.IcosahedronGeometry(0.6, 0), 0.2, seed + 9), greens[1], { position: [0, 3.9, 0], scale: [1, 1.3, 1] }, 'base', 0.14)
  })
}

function bush(seed: number) {
  return single(seed, (kit, rand) => {
    const greens = ['#5f9445', '#6f9f48', '#82ad52']
    for (let i = 0; i < 4; i++) {
      const r = 0.38 + rand() * 0.3
      kit.add(lumpy(new THREE.IcosahedronGeometry(r, 1), r * 0.35, seed + i), greens[i % 3], { position: [(rand() - 0.5) * 0.9, r * 0.7, (rand() - 0.5) * 0.9], scale: [1, 0.78, 1] }, 'base', 0.15)
    }
    for (let i = 0; i < 6; i++) kit.add(new THREE.OctahedronGeometry(0.07, 0), rand() < 0.5 ? '#f7f2ea' : '#ef6f6c', { position: [(rand() - 0.5) * 0.9, 0.55 + rand() * 0.35, (rand() - 0.5) * 0.9] })
  })
}

function flowers(seed: number) {
  return single(seed, (kit, rand) => {
    const colors = ['#f2c14e', '#ef8a6f', '#f7f2ea', '#c98bd6', '#ff9f43', '#7fb6e8']
    for (let i = 0; i < 9; i++) {
      const x = (rand() - 0.5) * 1.5
      const z = (rand() - 0.5) * 1.5
      const h = 0.25 + rand() * 0.25
      kit.cyl(0.02, 0.025, h, '#5f8f4e', [x, h / 2, z], undefined, 3)
      kit.box([0.14, 0.02, 0.06], '#6f9f48', [x + 0.05, h * 0.4, z], [0, rand() * PI, 0.4])
      const c = colors[Math.floor(rand() * colors.length)]
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * PI * 2
        kit.add(new THREE.OctahedronGeometry(0.06, 0).scale(1, 0.4, 1), c, { position: [x + Math.cos(a) * 0.06, h + 0.02, z + Math.sin(a) * 0.06] })
      }
      kit.sphere(0.035, '#f2c14e', [x, h + 0.04, z], 1, 0)
    }
  })
}

function grass(seed: number) {
  return single(seed, (kit, rand) => {
    const greens = ['#7fb350', '#8fbf58', '#6ea347', '#9cc865']
    for (let i = 0; i < 9; i++) {
      const x = (rand() - 0.5) * 0.7
      const z = (rand() - 0.5) * 0.7
      const h = 0.3 + rand() * 0.35
      kit.add(new THREE.ConeGeometry(0.05, h, 3).translate(0, h / 2, 0), greens[i % 4], { position: [x, 0, z], rotation: [(rand() - 0.5) * 0.6, rand() * PI, (rand() - 0.5) * 0.6] })
    }
  })
}

function reeds(seed: number) {
  return single(seed, (kit, rand) => {
    for (let i = 0; i < 8; i++) {
      const x = (rand() - 0.5) * 0.9
      const z = (rand() - 0.5) * 0.9
      const h = 0.8 + rand() * 0.7
      kit.cyl(0.015, 0.03, h, '#7d9a4a', [x, h / 2, z], [(rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3], 3)
      if (i % 2) kit.cyl(0.05, 0.05, 0.22, '#6b4a33', [x, h - 0.05, z], undefined, 5)
    }
  })
}

function boat(seed: number) {
  return single(seed, (kit) => {
    // hull: a lathed half-shell, wider at the gunwale
    const hull = new THREE.CylinderGeometry(0.95, 0.5, 3.6, 8, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2).scale(1, 0.75, 1)
    kit.add(hull, '#c9573f', { position: [0, 0.62, 0] })
    kit.add(new THREE.CylinderGeometry(0.97, 0.97, 3.62, 8, 1, true, 0, PI).rotateZ(PI / 2).rotateY(PI / 2).scale(1, 0.08, 1), '#f7f2ea', { position: [0, 0.6, 0] })
    kit.box([1.6, 0.08, 3.4], '#e9d8b4', [0, 0.64, 0])
    kit.cone(0.55, 0.9, '#c9573f', [0, 0.25, 1.7], 4, [PI / 2, PI / 4, 0])
    // cabin
    kit.box([1.0, 0.6, 1.0], '#f7f2ea', [0, 0.98, -0.7])
    kit.box([1.1, 0.08, 1.15], '#3f8c84', [0, 1.32, -0.7])
    kit.box([0.6, 0.25, 0.05], '#2b3640', [0, 1.05, -0.18])
    // mast, boom and sail
    kit.cyl(0.05, 0.06, 3.0, '#7a5136', [0, 2.1, 0.4], undefined, 5)
    kit.cyl(0.035, 0.035, 1.6, '#7a5136', [0, 1.25, 1.1], [PI / 2, 0, 0], 4)
    kit.add(new THREE.ConeGeometry(1.0, 2.4, 3).rotateY(PI / 6).scale(0.06, 1, 0.75), '#fbf6ee', { position: [0, 2.45, 1.0] })
    kit.add(new THREE.ConeGeometry(0.15, 0.4, 3).rotateZ(-PI / 2).scale(1, 1, 0.2), '#cf4a3c', { position: [0.18, 3.55, 0.4] })
  })
}

function pier(seed: number) {
  return single(seed, (kit, rand) => {
    for (let z = 0.2; z < 10; z += 0.42) kit.box([2.3, 0.1, 0.38], rand() < 0.5 ? '#b08256' : '#a07650', [(rand() - 0.5) * 0.06, 0.72, z])
    for (const x of [-1.05, 1.05]) kit.box([0.1, 0.14, 10], '#7a5136', [x, 0.6, 5])
    for (let z = 0.4; z <= 9.8; z += 2.35) {
      for (const x of [-1.05, 1.05]) {
        kit.cyl(0.13, 0.13, 3.0, '#6e4a33', [x, -0.75, z], undefined, 6)
        kit.cyl(0.08, 0.08, 0.9, '#6e4a33', [x, 1.15, z], undefined, 5)
      }
    }
    for (const x of [-1.05, 1.05]) kit.cyl(0.03, 0.03, 9.4, '#d8c08a', [x, 1.45, 5.1], [PI / 2, 0, 0], 4)
    kit.cyl(0.05, 0.06, 2.2, '#3d3a39', [0.9, 1.8, 9.6], undefined, 6)
    kit.box([0.3, 0.36, 0.3], '#ffd38a', [0.9, 3.0, 9.6])
    kit.add(new THREE.TorusGeometry(0.28, 0.08, 5, 10), '#cf4a3c', { position: [-1.12, 1.15, 6], rotation: [0, PI / 2, 0] })
  })
}

function fence(seed: number) {
  return single(seed, (kit, rand) => {
    for (const x of [-1.4, 0, 1.4]) kit.box([0.15, 0.95, 0.15], '#9a6a45', [x, 0.47, 0], [0, 0, (rand() - 0.5) * 0.08])
    kit.box([3, 0.1, 0.08], '#b07d52', [0, 0.7, 0], [0, 0, (rand() - 0.5) * 0.05])
    kit.box([3, 0.1, 0.08], '#b07d52', [0, 0.38, 0], [0, 0, (rand() - 0.5) * 0.05])
  })
}

function crates(seed: number) {
  return single(seed, (kit) => {
    const crate = (p: [number, number, number], s: number, r: number) =>
      kit.group({ position: p, rotation: [0, r, 0] }, () => {
        kit.box([s, s, s], '#c0925a', [0, s / 2, 0])
        kit.box([s + 0.03, 0.07, s + 0.03], '#8b5a3a', [0, s - 0.05, 0])
        kit.box([s + 0.03, 0.07, s + 0.03], '#8b5a3a', [0, 0.05, 0])
        kit.box([0.07, s * 1.3, s + 0.02], '#8b5a3a', [0, s / 2, 0], [0, 0, 0.78])
      })
    crate([0, 0, 0], 0.8, 0)
    crate([0.82, 0, 0.2], 0.6, 0.4)
    crate([0.1, 0.8, 0.05], 0.55, 0.2)
    kit.cyl(0.28, 0.28, 0.7, '#9a6a45', [-0.75, 0.35, 0.35], undefined, 9)
    kit.cyl(0.3, 0.3, 0.05, '#3d3a39', [-0.75, 0.15, 0.35], undefined, 9)
    kit.cyl(0.3, 0.3, 0.05, '#3d3a39', [-0.75, 0.55, 0.35], undefined, 9)
  })
}

function mineCart(seed: number) {
  return single(seed, (kit) => {
    kit.cyl(0.75, 0.55, 0.8, '#6b625b', [0, 0.75, 0], [0, PI / 4, 0], 4)
    kit.add(lumpy(new THREE.IcosahedronGeometry(0.45, 0), 0.2, seed).scale(1.3, 0.6, 1.6), '#e0b54a', { position: [0, 1.15, 0] })
    for (const z of [-0.5, 0.5]) for (const x of [-0.5, 0.5]) kit.cyl(0.2, 0.2, 0.1, '#3a3230', [x, 0.2, z], [0, 0, PI / 2], 8)
  })
}

function mushrooms(seed: number) {
  return single(seed, (kit, rand) => {
    for (let i = 0; i < 4; i++) {
      const x = (rand() - 0.5) * 0.6
      const z = (rand() - 0.5) * 0.6
      const h = 0.15 + rand() * 0.15
      kit.cyl(0.04, 0.05, h, '#f2e3c6', [x, h / 2, z], undefined, 5)
      kit.sphere(0.12 + rand() * 0.05, '#d6493a', [x, h, z], [1, 0.55, 1], 0)
    }
  })
}

/** A lumpy boulder with a smaller one at its foot; up-facing tops are mossy. */
function mossyRock(seed: number, color: string, moss: string) {
  const g = single(seed, (kit) => {
    const body = lumpy(new THREE.DodecahedronGeometry(0.9, 1), 0.42, seed).scale(1.1, 0.72, 1)
    kit.add(body, color, { position: [0, 0.32, 0] }, 'base', 0.2)
    kit.add(lumpy(new THREE.DodecahedronGeometry(0.45, 0), 0.2, seed + 3), color, { position: [0.85, 0.15, 0.3] }, 'base', 0.2)
  })
  return capTint(g, 0.55, moss, 0.6)
}

export const MODELS: ModelDef[] = [
  { id: 'pine', label: 'Pine', tags: ['tree'], wind: true, height: 4, build: () => pine(11) },
  { id: 'pine-tall', label: 'Tall pine', tags: ['tree'], wind: true, height: 5.3, build: () => pine(21, true) },
  { id: 'round-tree', label: 'Round tree', tags: ['tree'], wind: true, height: 3.8, build: () => roundTree(31) },
  { id: 'birch', label: 'Birch', tags: ['tree'], wind: true, height: 4.4, build: () => birch(35) },
  { id: 'bush', label: 'Bush', tags: ['bush'], wind: true, height: 1, build: () => bush(41) },
  { id: 'flowers', label: 'Flowers', tags: ['bush'], wind: true, height: 0.5, build: () => flowers(45) },
  { id: 'grass', label: 'Grass tuft', tags: ['bush'], wind: true, height: 0.6, build: () => grass(47) },
  { id: 'reeds', label: 'Reeds', tags: ['bush', 'water'], wind: true, height: 1.3, build: () => reeds(48) },
  { id: 'mushrooms', label: 'Toadstools', tags: ['bush'], wind: false, height: 0.4, build: () => mushrooms(49) },
  { id: 'rock', label: 'Rock', tags: ['rock'], wind: false, height: 1, build: () => mossyRock(51, '#b3a493', '#8fa85a') },
  { id: 'rock-dark', label: 'Dark rock', tags: ['rock'], wind: false, height: 1, build: () => mossyRock(61, '#948473', '#7f9a50') },
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
