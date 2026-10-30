import * as THREE from 'three/webgpu'
import { Kit, archRoofGeometry, lumpy } from '../lib/kit'
import { createKitMaterials } from '../materials/kitMaterials'
import { warpMask } from './warp'

// Procedural rolling stock, built with the modelling kit. Each car's origin
// sits on the rail at its centre, facing +z. Wheels and rods are separate
// meshes so they can move; everything else merges into one draw per layer.

export type CarKind = 'engine' | 'tender' | 'coach'

export interface AxleSpec {
  z: number
  radius: number
  spoked: boolean
}

export interface CarSpec {
  kind: CarKind
  length: number
  /** Distance from each end to the point that rides on the rail (bogie pivot). */
  bogieInset: number
  axles: AxleSpec[]
  variant?: number
}

export const CAR_GAP = 0.56
/** Rail head height above the track centre line. */
const RAIL_TOP = 0.24
/** Wheels sit on the rails, which are 1.2 apart. */
const WHEEL_X = 0.6
export const DRIVER_RADIUS = 0.62

export const ENGINE: CarSpec = {
  kind: 'engine',
  length: 5.4,
  bogieInset: 1.1,
  axles: [
    { z: 2.12, radius: 0.34, spoked: true },
    { z: 0.42, radius: DRIVER_RADIUS, spoked: true },
    { z: -0.95, radius: DRIVER_RADIUS, spoked: true },
  ],
}
export const TENDER: CarSpec = {
  kind: 'tender',
  length: 3.2,
  bogieInset: 0.75,
  axles: [
    { z: 0.85, radius: 0.4, spoked: true },
    { z: -0.85, radius: 0.4, spoked: true },
  ],
}
export const coachSpec = (variant: number): CarSpec => ({
  kind: 'coach',
  length: 4.6,
  bogieInset: 0.8,
  variant,
  axles: [1.95, 1.05, -1.05, -1.95].map((z) => ({ z, radius: 0.36, spoked: false })),
})

/** Top of the chimney in engine space (the steam emitter). */
export const CHIMNEY_TOP = new THREE.Vector3(0, 3.55, 2.2)
/** Driving-wheel crank throw and connecting-rod geometry. */
export const CRANK = 0.26
export const CYLINDER = { y: 1.05, z: 1.9, x: 1.02, rodLength: 0.8 }

export const trainMaterials = createKitMaterials(warpMask)

/** Plain (not vertex-coloured) materials for the stretchy couplings and piston rods. */
export const trainPlainMaterials = (() => {
  const iron = new THREE.MeshStandardNodeMaterial({ color: '#4a4644', roughness: 0.45, metalness: 0.5 })
  const bellows = new THREE.MeshStandardNodeMaterial({ color: '#3a3230', roughness: 0.9 })
  const steel = new THREE.MeshStandardNodeMaterial({ color: '#b8bec6', roughness: 0.3, metalness: 0.8 })
  for (const m of [iron, bellows, steel]) m.maskNode = warpMask as never
  return { iron, bellows, steel }
})()

const C = {
  red: '#b8382e',
  redDark: '#8f2a23',
  black: '#2e2826',
  iron: '#4a4644',
  gold: '#e0b252',
  cream: '#f2e3c6',
  glass: '#2b3640',
  lamp: '#fff1c4',
  fire: '#ff8a3d',
  coal: '#26211f',
}

const COACH_COLOURS = [
  { body: '#2f8f83', dark: '#226b62', roof: '#5d5450' },
  { body: '#e2a93b', dark: '#b9852a', roof: '#5d5450' },
  { body: '#8c2f39', dark: '#6b232c', roof: '#5d5450' },
]

const PI = Math.PI

function buffers(kit: Kit, z: number, dir: 1 | -1, beam = C.redDark) {
  kit.box([2.0, 0.4, 0.16], beam, [0, 0.88, z])
  for (const x of [-0.62, 0.62]) {
    kit.cyl(0.1, 0.1, 0.16, C.iron, [x, 0.88, z + dir * 0.16], [PI / 2, 0, 0], 8, 'metal')
    kit.cyl(0.17, 0.17, 0.04, C.iron, [x, 0.88, z + dir * 0.25], [PI / 2, 0, 0], 10, 'metal')
  }
  kit.box([0.14, 0.14, 0.2], C.iron, [0, 0.88, z + dir * 0.15], undefined, 'metal')
}

function buildEngine() {
  const kit = new Kit(301)
  // frame, footplate and pilot
  kit.box([1.4, 0.34, 5.0], C.black, [0, 0.86, 0])
  kit.box([2.1, 0.08, 4.0], C.black, [0, 1.12, 0.45])
  kit.box([2.12, 0.07, 4.0], C.red, [0, 1.05, 0.45])
  buffers(kit, 2.62, 1)
  for (let i = -2; i <= 2; i++) kit.box([0.1, 0.12, 0.75], C.iron, [i * 0.34, 0.5, 2.95], [-0.62, 0, 0], 'metal')
  kit.box([1.75, 0.1, 0.12], C.iron, [0, 0.72, 3.15], undefined, 'metal')
  // cylinders with steam chests
  for (const x of [-1, 1]) {
    kit.cyl(0.3, 0.3, 0.8, '#3f4a48', [x * CYLINDER.x, CYLINDER.y, CYLINDER.z], [PI / 2, 0, 0], 12)
    kit.cyl(0.32, 0.32, 0.06, C.gold, [x * CYLINDER.x, CYLINDER.y, CYLINDER.z + 0.42], [PI / 2, 0, 0], 12, 'metal')
    kit.cyl(0.32, 0.32, 0.06, C.gold, [x * CYLINDER.x, CYLINDER.y, CYLINDER.z - 0.42], [PI / 2, 0, 0], 12, 'metal')
    kit.box([0.36, 0.3, 0.7], '#3f4a48', [x * (CYLINDER.x - 0.05), CYLINDER.y + 0.38, CYLINDER.z])
    // slide bars the crosshead runs along
    kit.box([0.05, 0.05, 0.62], C.iron, [x * (CYLINDER.x - 0.12), CYLINDER.y + 0.1, CYLINDER.z - 0.7], undefined, 'metal')
    kit.box([0.05, 0.05, 0.62], C.iron, [x * (CYLINDER.x - 0.12), CYLINDER.y - 0.1, CYLINDER.z - 0.7], undefined, 'metal')
    // splashers over the drivers
    kit.add(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 14, 1, true, -PI / 2, PI), C.red, { position: [x * 0.68, 0.24 + DRIVER_RADIUS, 0.42], rotation: [0, 0, PI / 2] })
    kit.add(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 14, 1, true, -PI / 2, PI), C.red, { position: [x * 0.68, 0.24 + DRIVER_RADIUS, -0.95], rotation: [0, 0, PI / 2] })
  }
  // boiler, bands and smokebox
  kit.cyl(0.72, 0.72, 3.2, C.red, [0, 1.78, 0.5], [PI / 2, 0, 0], 16)
  for (const z of [-0.95, -0.05, 0.85, 1.75]) kit.cyl(0.735, 0.735, 0.07, C.gold, [0, 1.78, z], [PI / 2, 0, 0], 16, 'metal')
  kit.cyl(0.77, 0.77, 0.66, C.black, [0, 1.78, 2.3], [PI / 2, 0, 0], 16)
  kit.cyl(0.64, 0.66, 0.08, '#3b3433', [0, 1.78, 2.66], [PI / 2, 0, 0], 16)
  kit.box([0.9, 0.05, 0.05], C.iron, [0, 1.95, 2.71], undefined, 'metal')
  kit.box([0.9, 0.05, 0.05], C.iron, [0, 1.6, 2.71], undefined, 'metal')
  kit.cyl(0.06, 0.06, 0.08, C.gold, [0, 1.78, 2.74], [PI / 2, 0, 0], 8, 'metal')
  kit.box([0.5, 0.18, 0.04], C.gold, [0, 1.28, 2.66], undefined, 'metal')
  // chimney
  kit.cyl(0.25, 0.27, 0.5, C.black, [0, 2.68, 2.2], undefined, 12)
  kit.cyl(0.34, 0.22, 0.55, C.black, [0, 3.18, 2.2], undefined, 12)
  kit.cyl(0.37, 0.37, 0.09, C.iron, [0, 3.48, 2.2], undefined, 12, 'metal')
  // head lamp
  kit.box([0.34, 0.34, 0.3], C.black, [0, 2.75, 2.62])
  kit.cyl(0.13, 0.13, 0.04, C.lamp, [0, 2.75, 2.78], [PI / 2, 0, 0], 10, 'glow')
  kit.cone(0.12, 0.12, C.black, [0, 2.92, 2.62], 6)
  // domes, valves, whistle
  kit.cyl(0.32, 0.36, 0.34, C.gold, [0, 2.62, 0.75], undefined, 12, 'metal')
  kit.sphere(0.32, C.gold, [0, 2.78, 0.75], [1, 0.55, 1], 1, 'metal')
  kit.cyl(0.25, 0.28, 0.28, C.red, [0, 2.58, -0.2], undefined, 12)
  kit.sphere(0.25, C.red, [0, 2.72, -0.2], [1, 0.55, 1], 1)
  kit.cyl(0.05, 0.05, 0.4, C.gold, [0.12, 2.7, -0.75], undefined, 6, 'metal')
  kit.cyl(0.05, 0.05, 0.4, C.gold, [-0.12, 2.7, -0.75], undefined, 6, 'metal')
  kit.cyl(0.05, 0.08, 0.28, C.gold, [0.35, 3.22, -0.85], undefined, 6, 'metal')
  // hand rails
  for (const x of [-1, 1]) {
    kit.cyl(0.025, 0.025, 3.0, C.gold, [x * 0.8, 2.08, 0.6], [PI / 2, 0, 0], 5, 'metal')
    for (const z of [-0.6, 0.6, 1.8]) kit.cyl(0.02, 0.02, 0.12, C.gold, [x * 0.76, 2.06, z], [0, 0, PI / 2], 4, 'metal')
  }
  // firebox and cab
  kit.box([1.25, 0.6, 1.3], C.black, [0, 1.25, -1.15])
  const cabZ = -1.72
  kit.box([2.0, 2.0, 0.1], C.red, [0, 2.1, cabZ + 0.85])
  for (const x of [-0.5, 0.5]) {
    kit.cyl(0.19, 0.19, 0.04, C.glass, [x, 2.55, cabZ + 0.91], [PI / 2, 0, 0], 12, 'glow')
    kit.cyl(0.23, 0.23, 0.03, C.gold, [x, 2.55, cabZ + 0.9], [PI / 2, 0, 0], 12, 'metal')
  }
  for (const x of [-1, 1]) {
    kit.box([0.1, 1.05, 1.8], C.red, [x * 0.95, 1.62, cabZ])
    kit.box([0.1, 0.95, 0.25], C.red, [x * 0.95, 2.6, cabZ + 0.78])
    kit.box([0.1, 0.95, 0.22], C.red, [x * 0.95, 2.6, cabZ - 0.79])
    kit.box([0.12, 0.05, 1.82], C.gold, [x * 0.95, 2.13, cabZ], undefined, 'metal')
  }
  kit.add(archRoofGeometry(2.35, 2.15, 0.32, 6), C.black, { position: [0, 3.08, cabZ - 0.05] })
  kit.box([2.35, 0.06, 2.15], C.black, [0, 3.08, cabZ - 0.05])
  kit.box([1.3, 0.9, 0.06], '#3b3433', [0, 1.85, cabZ + 0.78])
  kit.box([0.5, 0.26, 0.04], C.fire, [0, 1.58, cabZ + 0.74], undefined, 'glow')
  kit.box([1.8, 0.08, 1.8], '#5a4136', [0, 1.14, cabZ])
  // rear drawbar beam
  kit.box([1.9, 0.38, 0.14], C.redDark, [0, 0.88, -2.62])
  return kit.build()
}

function buildTender() {
  const kit = new Kit(302)
  kit.box([1.45, 0.3, 3.0], C.black, [0, 0.82, 0])
  kit.box([1.95, 1.15, 2.9], C.red, [0, 1.58, -0.02])
  kit.box([1.99, 0.06, 2.92], C.gold, [0, 2.12, -0.02], undefined, 'metal')
  kit.box([1.99, 0.05, 2.92], C.gold, [0, 1.06, -0.02], undefined, 'metal')
  for (const x of [-1, 1]) {
    kit.box([0.04, 0.9, 0.04], C.gold, [x * 0.99, 1.58, 1.3], undefined, 'metal')
    kit.box([0.04, 0.9, 0.04], C.gold, [x * 0.99, 1.58, -1.34], undefined, 'metal')
    kit.box([0.12, 0.3, 2.2], C.black, [x * 0.82, 0.68, 0])
    for (const z of [-0.85, 0.85]) kit.box([0.16, 0.22, 0.3], C.iron, [x * 0.82, 0.64, z], undefined, 'metal')
  }
  // coal rails and the coal heap
  kit.box([1.95, 0.25, 0.08], C.redDark, [0, 2.26, 1.42])
  kit.box([0.08, 0.25, 1.7], C.redDark, [0.95, 2.26, 0.6])
  kit.box([0.08, 0.25, 1.7], C.redDark, [-0.95, 2.26, 0.6])
  kit.add(lumpy(new THREE.DodecahedronGeometry(0.9, 1), 0.18, 9), C.coal, { position: [0, 2.15, 0.5], scale: [1.0, 0.42, 1.0] }, 'base', 0.2)
  // water filler and tool box at the back
  kit.cyl(0.24, 0.24, 0.16, C.black, [0, 2.24, -0.85], undefined, 10)
  kit.box([1.3, 0.28, 0.4], C.black, [0, 2.3, -1.2])
  buffers(kit, -1.62, -1)
  kit.box([1.9, 0.38, 0.14], C.redDark, [0, 0.88, 1.6])
  // steps
  for (const x of [-1, 1]) kit.box([0.3, 0.05, 0.3], C.iron, [x * 1.0, 0.55, 1.35], undefined, 'metal')
  return kit.build()
}

function buildCoach(variant: number) {
  const col = COACH_COLOURS[variant % COACH_COLOURS.length]
  const kit = new Kit(310 + variant)
  const L = 4.6
  // underframe, truss rods and bogies
  kit.box([1.5, 0.22, L - 0.3], C.black, [0, 0.86, 0])
  for (const x of [-0.55, 0.55]) {
    kit.box([0.04, 0.04, 1.5], C.iron, [x, 0.6, 0], undefined, 'metal')
    kit.box([0.04, 0.04, 0.6], C.iron, [x, 0.68, 0.98], [0.3, 0, 0], 'metal')
    kit.box([0.04, 0.04, 0.6], C.iron, [x, 0.68, -0.98], [-0.3, 0, 0], 'metal')
  }
  kit.box([0.9, 0.3, 0.6], C.black, [0, 0.62, 0])
  for (const z of [-1.5, 1.5]) {
    kit.box([1.75, 0.2, 1.5], C.black, [0, 0.62, z])
    for (const x of [-1, 1]) kit.box([0.12, 0.28, 1.4], C.iron, [x * 0.82, 0.6, z], undefined, 'metal')
  }
  // body: lower panels, window band, cream upper strip
  kit.box([2.0, 0.72, L - 0.2], col.body, [0, 1.36, 0])
  kit.box([2.03, 0.05, L - 0.2], C.gold, [0, 1.73, 0], undefined, 'metal')
  kit.box([1.96, 0.62, L - 1.2], C.glass, [0, 2.06, 0], undefined, 'glow')
  const panes = 5
  for (let i = 0; i <= panes; i++) {
    const z = -(L - 1.2) / 2 + (i * (L - 1.2)) / panes
    kit.box([2.04, 0.64, 0.14], C.cream, [0, 2.06, z])
  }
  kit.box([2.04, 0.22, L - 0.2], C.cream, [0, 2.46, 0])
  // end vestibules with doors
  for (const dir of [-1, 1]) {
    const z = dir * (L / 2 - 0.35)
    kit.box([2.02, 1.38, 0.5], col.dark, [0, 1.7, z])
    kit.box([2.06, 0.34, 0.28], C.glass, [0, 2.1, z], undefined, 'glow')
    kit.box([0.06, 0.5, 0.04], C.gold, [1.04, 1.6, z], undefined, 'metal')
    kit.box([0.06, 0.5, 0.04], C.gold, [-1.04, 1.6, z], undefined, 'metal')
    // gangway bellows and buffers
    kit.box([1.15, 1.7, 0.16], '#3a3230', [0, 1.75, dir * (L / 2 + 0.02)])
    buffers(kit, dir * (L / 2 - 0.05), dir as 1 | -1, C.black)
    kit.box([0.3, 0.05, 0.28], C.iron, [0.95, 0.6, dir * (L / 2 - 0.3)], undefined, 'metal')
    kit.box([0.3, 0.05, 0.28], C.iron, [-0.95, 0.6, dir * (L / 2 - 0.3)], undefined, 'metal')
  }
  // roof with vents and a lamp top at each end
  kit.add(archRoofGeometry(2.25, L + 0.05, 0.36, 7), col.roof, { position: [0, 2.56, 0] })
  kit.box([2.25, 0.06, L + 0.05], col.roof, [0, 2.56, 0])
  for (const z of [-1.4, 0, 1.4]) {
    kit.cyl(0.1, 0.12, 0.18, C.iron, [0, 2.98, z], undefined, 8, 'metal')
    kit.cyl(0.16, 0.16, 0.05, C.iron, [0, 3.08, z], undefined, 8, 'metal')
  }
  return kit.build()
}

/** One axle: two wheels on the rails plus the axle bar, merged into one mesh that spins about x. */
function buildAxleMerged(radius: number, spoked: boolean) {
  const kit = new Kit(320)
  kit.cyl(0.05, 0.05, WHEEL_X * 2, C.iron, [0, 0, 0], [0, 0, PI / 2], 6)
  for (const side of [-1, 1]) {
    const x = side * WHEEL_X
    kit.cyl(radius, radius, 0.12, '#3d3634', [x, 0, 0], [0, 0, PI / 2], 16)
    kit.cyl(radius * 1.08, radius * 1.08, 0.04, '#3d3634', [x - side * 0.07, 0, 0], [0, 0, PI / 2], 16)
    const face = x + side * 0.065
    if (spoked) {
      kit.cyl(radius * 0.86, radius * 0.86, 0.02, C.redDark, [face, 0, 0], [0, 0, PI / 2], 16)
      const spokes = radius > 0.5 ? 12 : 8
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * PI * 2
        kit.box([0.04, radius * 0.8, 0.07], C.red, [face + side * 0.015, Math.cos(a) * radius * 0.42, Math.sin(a) * radius * 0.42], [a, 0, 0])
      }
      // counterweight opposite this side's crank pin (the right side leads by 90 degrees)
      if (radius > 0.5) kit.group({ rotation: [side > 0 ? PI / 2 : 0, 0, 0] }, () => kit.box([0.05, radius * 0.38, radius * 0.7], C.black, [face + side * 0.02, -radius * 0.55, 0]))
    } else {
      kit.cyl(radius * 0.8, radius * 0.8, 0.02, C.black, [face, 0, 0], [0, 0, PI / 2], 12)
    }
    kit.cyl(radius * 0.2, radius * 0.2, 0.08, C.gold, [face + side * 0.03, 0, 0], [0, 0, PI / 2], 8)
  }
  return kit.build().base!
}

function buildRod(length: number, thickness: number) {
  const kit = new Kit(330)
  kit.box([0.06, thickness, length], '#9aa0a8', [0, 0, 0])
  kit.cyl(thickness * 0.75, thickness * 0.75, 0.08, '#9aa0a8', [0, 0, length / 2], [0, 0, PI / 2], 8)
  kit.cyl(thickness * 0.75, thickness * 0.75, 0.08, '#9aa0a8', [0, 0, -length / 2], [0, 0, PI / 2], 8)
  return kit.build().base!
}

let cache: {
  engine: ReturnType<Kit['build']>
  tender: ReturnType<Kit['build']>
  coaches: ReturnType<Kit['build']>[]
  axles: Map<string, THREE.BufferGeometry>
  couplingRod: THREE.BufferGeometry
  connectingRod: THREE.BufferGeometry
  pistonRod: THREE.BufferGeometry
} | null = null

/** Built once and shared. */
export function getTrainGeometry() {
  if (!cache) {
    cache = {
      engine: buildEngine(),
      tender: buildTender(),
      coaches: [0, 1, 2].map(buildCoach),
      axles: new Map(),
      couplingRod: buildRod(ENGINE.axles[1].z - ENGINE.axles[2].z + 0.2, 0.1),
      connectingRod: buildRod(CYLINDER.rodLength, 0.09),
      pistonRod: new THREE.CylinderGeometry(0.035, 0.035, 1, 6).rotateX(PI / 2).translate(0, 0, 0.5),
    }
  }
  return cache
}

export function getAxleGeometry(radius: number, spoked: boolean) {
  const g = getTrainGeometry()
  const key = `${radius}:${spoked}`
  let geo = g.axles.get(key)
  if (!geo) g.axles.set(key, (geo = buildAxleMerged(radius, spoked)))
  return geo
}

export const axleHeight = (radius: number) => RAIL_TOP + radius
