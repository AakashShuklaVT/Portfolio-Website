import * as THREE from 'three/webgpu'
import { Kit, gableEndGeometry, lumpy } from '../lib/kit'
import { mulberry32 } from '../lib/noise'
import type { StationBuilding } from '../world/types'

// Station architecture, one kit per station type. Local space: origin on the
// ground at the building plot, +z faces the railway (the platform edge is
// about 2 units in front), x runs along the line.

type V3 = [number, number, number]
const PI = Math.PI

export const PALETTE = {
  plaster: '#f3e7d0',
  plasterWarm: '#efd6ae',
  brick: '#b4553f',
  brickDark: '#94432f',
  stone: '#c9b7a1',
  stoneDark: '#a8957f',
  wood: '#9a6a45',
  woodDark: '#6e4a33',
  woodLight: '#c08a5a',
  log: '#8b5a3a',
  timber: '#4e3426',
  roofRed: '#c9573f',
  roofTeal: '#3f8c84',
  roofMoss: '#5f8f4e',
  roofSlate: '#5d6670',
  iron: '#3d3a39',
  copper: '#c7773f',
  gold: '#e0b252',
  white: '#f7f2ea',
  red: '#cf4a3c',
  cream: '#f2e3c6',
  glass: '#ffd38a',
  leaf: '#6f9f48',
  leafDark: '#4f8445',
  crystal: '#5ff2e4',
  crystal2: '#b48cff',
}

// ---------------------------------------------------------------- helpers

function windowAt(kit: Kit, pos: V3, w = 0.6, h = 0.7, rotY = 0, arched = false) {
  kit.group({ position: pos, rotation: [0, rotY, 0] }, () => {
    kit.box([w + 0.16, h + 0.16, 0.08], PALETTE.white, [0, 0, 0])
    kit.box([w, h, 0.1], PALETTE.glass, [0, 0, 0.01], undefined, 'glow')
    kit.box([0.05, h, 0.12], PALETTE.white, [0, 0, 0.02])
    kit.box([w, 0.05, 0.12], PALETTE.white, [0, h * 0.1, 0.02])
    kit.box([w + 0.26, 0.08, 0.16], PALETTE.white, [0, -h / 2 - 0.1, 0.05])
    if (arched) kit.add(new THREE.CylinderGeometry(w / 2 + 0.08, w / 2 + 0.08, 0.08, 10, 1, false, -PI / 2, PI), PALETTE.white, { position: [0, h / 2, 0], rotation: [PI / 2, 0, 0] })
  })
}

function door(kit: Kit, pos: V3, w = 0.8, h = 1.4, color = PALETTE.woodDark, rotY = 0) {
  kit.group({ position: pos, rotation: [0, rotY, 0] }, () => {
    kit.box([w + 0.18, h + 0.12, 0.08], PALETTE.white, [0, h / 2, 0])
    kit.box([w, h, 0.12], color, [0, h / 2, 0.02])
    kit.box([w * 0.7, 0.3, 0.13], PALETTE.glass, [0, h - 0.3, 0.03], undefined, 'glow')
    kit.box([0.08, 0.08, 0.1], PALETTE.gold, [w * 0.32, h * 0.48, 0.1], undefined, 'metal')
    kit.box([w + 0.4, 0.12, 0.5], PALETTE.stoneDark, [0, 0.06, 0.25])
  })
}

/** Walls plus a gable roof with overhang; ridge along x. */
function house(kit: Kit, o: { pos: V3; rotY?: number; w: number; d: number; h: number; wall: string; roof: string; pitch?: number; plinth?: string }) {
  const pitch = o.pitch ?? 0.7
  kit.group({ position: o.pos, rotation: [0, o.rotY ?? 0, 0] }, () => {
    kit.box([o.w, o.h, o.d], o.wall, [0, o.h / 2, 0])
    if (o.plinth) kit.box([o.w + 0.08, 0.45, o.d + 0.08], o.plinth, [0, 0.22, 0])
    const rh = (o.d / 2) * pitch * 1.4
    for (const sx of [-1, 1]) kit.add(gableEndGeometry(o.d, rh, 0.1), o.wall, { position: [sx * (o.w / 2 - 0.05), o.h, 0], rotation: [0, PI / 2, 0] })
    kit.gable(o.w + 0.6, o.d + 0.9, rh + 0.25, o.roof, [0, o.h - 0.12, 0], undefined, 0.16)
    kit.box([o.w + 0.62, 0.14, 0.16], o.roof, [0, o.h + rh + 0.1, 0])
  })
}

function lampPost(kit: Kit, pos: V3, h = 2.6) {
  kit.cyl(0.07, 0.09, h, PALETTE.iron, [pos[0], pos[1] + h / 2, pos[2]], undefined, 6, 'metal')
  kit.cyl(0.16, 0.2, 0.2, PALETTE.iron, [pos[0], pos[1] + 0.1, pos[2]], undefined, 6, 'metal')
  kit.box([0.32, 0.4, 0.32], PALETTE.glass, [pos[0], pos[1] + h + 0.2, pos[2]], undefined, 'glow')
  kit.cone(0.3, 0.25, PALETTE.iron, [pos[0], pos[1] + h + 0.4, pos[2]], 4, [0, PI / 4, 0], 'metal')
}

function barrel(kit: Kit, pos: V3, color = PALETTE.wood) {
  kit.cyl(0.3, 0.3, 0.75, color, [pos[0], pos[1] + 0.375, pos[2]], undefined, 9)
  kit.cyl(0.32, 0.32, 0.06, PALETTE.iron, [pos[0], pos[1] + 0.15, pos[2]], undefined, 9, 'metal')
  kit.cyl(0.32, 0.32, 0.06, PALETTE.iron, [pos[0], pos[1] + 0.6, pos[2]], undefined, 9, 'metal')
}

function crate(kit: Kit, pos: V3, s = 0.7, rotY = 0) {
  kit.group({ position: pos, rotation: [0, rotY, 0] }, () => {
    kit.box([s, s, s], PALETTE.woodLight, [0, s / 2, 0])
    kit.box([s + 0.04, 0.08, s + 0.04], PALETTE.wood, [0, s - 0.06, 0])
    kit.box([s + 0.04, 0.08, s + 0.04], PALETTE.wood, [0, 0.06, 0])
    kit.box([0.08, s * 1.3, s + 0.03], PALETTE.wood, [0, s / 2, 0], [0, 0, 0.78])
  })
}

function bench(kit: Kit, pos: V3, rotY = 0) {
  kit.group({ position: pos, rotation: [0, rotY, 0] }, () => {
    kit.box([1.5, 0.08, 0.42], PALETTE.woodLight, [0, 0.45, 0])
    kit.box([1.5, 0.3, 0.06], PALETTE.woodLight, [0, 0.72, -0.2])
    for (const x of [-0.62, 0.62]) kit.box([0.08, 0.45, 0.4], PALETTE.iron, [x, 0.22, 0], undefined, 'metal')
  })
}

function bush(kit: Kit, pos: V3, s = 1, seed = 1) {
  kit.add(lumpy(new THREE.IcosahedronGeometry(0.55 * s, 1), 0.2 * s, seed), seed % 2 ? PALETTE.leaf : PALETTE.leafDark, { position: [pos[0], pos[1] + 0.35 * s, pos[2]], scale: [1, 0.75, 1] }, 'base', 0.15)
}

function flowerBox(kit: Kit, pos: V3, w: number, rotY = 0, seed = 3) {
  const rand = mulberry32(seed)
  const colors = ['#f2c14e', '#ef6f6c', '#f7f2ea', '#c98bd6', '#ff9f43']
  kit.group({ position: pos, rotation: [0, rotY, 0] }, () => {
    kit.box([w, 0.2, 0.25], PALETTE.woodDark, [0, 0, 0])
    for (let i = 0; i < Math.round(w * 6); i++) {
      kit.add(new THREE.OctahedronGeometry(0.07, 0), colors[Math.floor(rand() * colors.length)], { position: [-w / 2 + 0.08 + rand() * (w - 0.16), 0.16, (rand() - 0.5) * 0.15] })
    }
    kit.box([w - 0.05, 0.08, 0.2], PALETTE.leafDark, [0, 0.1, 0])
  })
}

function fence(kit: Kit, from: V3, to: V3, color = PALETTE.white) {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const len = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  kit.group({ position: from, rotation: [0, yaw, 0] }, () => {
    const n = Math.max(2, Math.round(len / 0.3))
    for (let i = 0; i <= n; i++) {
      kit.box([0.08, 0.7, 0.05], color, [0, 0.35, (i / n) * len])
      kit.cone(0.06, 0.1, color, [0, 0.7, (i / n) * len], 4)
    }
    kit.box([0.04, 0.07, len], color, [0, 0.5, len / 2])
    kit.box([0.04, 0.07, len], color, [0, 0.22, len / 2])
  })
}

function stoneChimney(kit: Kit, pos: V3, h: number) {
  kit.box([0.55, h, 0.55], PALETTE.stoneDark, [pos[0], pos[1] + h / 2, pos[2]])
  kit.box([0.66, 0.14, 0.66], PALETTE.stone, [pos[0], pos[1] + h, pos[2]])
}

// ---------------------------------------------------------------- stations

function harbor(kit: Kit) {
  // Main hall: cream walls on a brick plinth, teal roof, arched windows.
  house(kit, { pos: [0.3, 0, -0.6], w: 6.2, d: 3.6, h: 3.1, wall: PALETTE.plaster, roof: PALETTE.roofTeal, plinth: PALETTE.brick, pitch: 0.55 })
  for (const x of [-2.1, 2.3]) windowAt(kit, [x + 0.3, 1.9, 1.24], 0.7, 0.95, 0, true)
  door(kit, [0.4, 0, 1.24], 1.1, 1.8, PALETTE.roofTeal)
  kit.box([2.2, 0.12, 1.1], PALETTE.roofTeal, [0.4, 2.35, 1.7], [0.18, 0, 0])
  for (const x of [-0.55, 1.35]) kit.box([0.08, 0.6, 0.08], PALETTE.iron, [x, 2.05, 2.15], [0.4, 0, 0], 'metal')
  // life ring on the wall
  kit.add(new THREE.TorusGeometry(0.32, 0.09, 6, 14), PALETTE.red, { position: [-1.1, 1.9, 1.26] })
  kit.add(new THREE.TorusGeometry(0.32, 0.095, 6, 14, PI / 2), PALETTE.white, { position: [-1.1, 1.9, 1.27] })
  kit.add(new THREE.TorusGeometry(0.32, 0.095, 6, 14, PI / 2), PALETTE.white, { position: [-1.1, 1.9, 1.27], rotation: [0, 0, PI] })

  // Clock tower
  kit.group({ position: [-3.9, 0, -0.4] }, () => {
    kit.box([1.8, 5.6, 1.8], PALETTE.plasterWarm, [0, 2.8, 0])
    kit.box([1.9, 0.5, 1.9], PALETTE.brick, [0, 0.25, 0])
    kit.box([2.0, 0.2, 2.0], PALETTE.white, [0, 4.1, 0])
    kit.box([2.0, 0.24, 2.0], PALETTE.white, [0, 5.6, 0])
    for (const [rx, z, x] of [
      [0, 0.92, 0],
      [PI / 2, 0, 0.92],
    ] as const) {
      kit.group({ position: [x, 4.85, z], rotation: [0, rx, 0] }, () => {
        kit.cyl(0.55, 0.55, 0.08, PALETTE.white, [0, 0, 0], [PI / 2, 0, 0], 16)
        kit.cyl(0.6, 0.6, 0.05, PALETTE.gold, [0, 0, -0.02], [PI / 2, 0, 0], 16, 'metal')
        kit.box([0.06, 0.4, 0.04], PALETTE.iron, [0, 0.16, 0.06], undefined, 'metal')
        kit.box([0.3, 0.06, 0.04], PALETTE.iron, [0.12, 0, 0.06], undefined, 'metal')
      })
    }
    windowAt(kit, [0, 2.6, 0.92], 0.45, 0.8, 0, true)
    kit.cone(1.45, 1.9, PALETTE.roofTeal, [0, 5.72, 0], 4, [0, PI / 4, 0])
    kit.cyl(0.04, 0.04, 1.3, PALETTE.iron, [0, 8.1, 0], undefined, 4, 'metal')
    kit.add(new THREE.ConeGeometry(0.28, 0.8, 3).rotateZ(-PI / 2).scale(1, 1, 0.2), PALETTE.red, { position: [0.42, 8.5, 0] })
  })

  // Dock crane reaching over the line towards the sea.
  kit.group({ position: [4.6, 0, -1.6], rotation: [0, -0.35, 0] }, () => {
    kit.box([1.6, 0.5, 1.6], PALETTE.stoneDark, [0, 0.25, 0])
    kit.cyl(0.32, 0.4, 4.8, PALETTE.red, [0, 2.9, 0], undefined, 8)
    kit.box([1.3, 1.1, 1.5], PALETTE.red, [0, 5.6, 0.1])
    kit.box([1.36, 0.2, 1.56], PALETTE.white, [0, 6.2, 0.1])
    windowAt(kit, [0, 5.7, 0.86], 0.5, 0.45)
    // lattice boom
    kit.group({ position: [0, 5.3, 0.7], rotation: [-0.42, 0, 0] }, () => {
      for (const x of [-0.25, 0.25]) kit.box([0.1, 0.1, 8.2], PALETTE.red, [x, 0, 4.1])
      for (let z = 0.6; z < 8; z += 0.8) kit.box([0.5, 0.06, 0.06], PALETTE.red, [0, 0, z])
      for (let z = 0.6; z < 7.6; z += 1.6) kit.box([0.05, 0.05, 0.9], PALETTE.red, [0, 0, z + 0.4], [0, 0.6, 0])
    })
    kit.box([0.04, 2.6, 0.04], PALETTE.iron, [0, 6.9, 7.4], undefined, 'metal')
    kit.add(new THREE.TorusGeometry(0.16, 0.05, 5, 8, PI * 1.4), PALETTE.iron, { position: [0, 5.55, 7.4], rotation: [0, PI / 2, PI] }, 'metal')
    kit.box([1.2, 0.5, 0.4], PALETTE.iron, [0, 4.9, -0.65], undefined, 'metal')
  })

  // Water tower for the locomotives
  kit.group({ position: [-6.9, 0, -2.2] }, () => {
    for (const [x, z] of [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ])
      kit.box([0.2, 3.2, 0.2], PALETTE.woodDark, [x, 1.6, z])
    kit.box([2.0, 0.12, 0.12], PALETTE.woodDark, [0, 1.7, 0.8], [0, 0, 0.9])
    kit.box([2.0, 0.12, 0.12], PALETTE.woodDark, [0, 1.7, -0.8], [0, 0, -0.9])
    kit.cyl(1.25, 1.25, 1.8, PALETTE.wood, [0, 4.1, 0], undefined, 12)
    for (const y of [3.5, 4.1, 4.7]) kit.cyl(1.28, 1.28, 0.07, PALETTE.iron, [0, y, 0], undefined, 12, 'metal')
    kit.cone(1.4, 0.8, PALETTE.roofTeal, [0, 5.0, 0], 12)
    kit.cyl(0.12, 0.12, 1.4, PALETTE.iron, [0.9, 3.4, 1.0], [0.9, 0, 0], 6, 'metal')
  })

  // Quay clutter
  barrel(kit, [3.0, 0, 1.2])
  barrel(kit, [3.55, 0, 0.8], PALETTE.woodDark)
  crate(kit, [2.6, 0, 0.3], 0.7, 0.3)
  crate(kit, [2.62, 0.7, 0.32], 0.5, 0.8)
  kit.add(new THREE.TorusGeometry(0.3, 0.1, 5, 12), '#d8c08a', { position: [-2.4, 0.1, 1.6], rotation: [PI / 2, 0, 0] })
  kit.add(new THREE.TorusGeometry(0.18, 0.1, 5, 10), '#d8c08a', { position: [-2.4, 0.22, 1.6], rotation: [PI / 2, 0, 0] })
  // anchor
  kit.group({ position: [1.9, 0, 1.8], rotation: [0, 0.4, 0] }, () => {
    kit.box([0.12, 1.3, 0.12], PALETTE.iron, [0, 0.75, 0], undefined, 'metal')
    kit.box([0.7, 0.1, 0.1], PALETTE.iron, [0, 1.25, 0], undefined, 'metal')
    kit.add(new THREE.TorusGeometry(0.42, 0.07, 5, 12, PI), PALETTE.iron, { position: [0, 0.5, 0], rotation: [0, 0, PI] }, 'metal')
    kit.add(new THREE.TorusGeometry(0.12, 0.04, 5, 8), PALETTE.iron, { position: [0, 1.48, 0] }, 'metal')
  })
  lampPost(kit, [-1.8, 0, 1.7])
  bush(kit, [-5.4, 0, 1.0], 1, 2)
}

function woodland(kit: Kit) {
  // Log cabin: stacked logs with crossed corners.
  kit.group({ position: [-0.6, 0, -0.6] }, () => {
    const w = 4.8
    const d = 3.4
    const r = 0.17
    for (let i = 0; i < 7; i++) {
      const y = 0.2 + i * r * 2
      const c = i % 2 ? PALETTE.log : '#7b4f33'
      kit.cyl(r, r, w + 0.5, c, [0, y, d / 2], [0, 0, PI / 2], 7)
      kit.cyl(r, r, w + 0.5, c, [0, y, -d / 2], [0, 0, PI / 2], 7)
      kit.cyl(r, r, d + 0.5, c, [w / 2, y + r, 0], [PI / 2, 0, 0], 7)
      kit.cyl(r, r, d + 0.5, c, [-w / 2, y + r, 0], [PI / 2, 0, 0], 7)
    }
    kit.box([w - 0.1, 2.4, d - 0.1], '#6b4530', [0, 1.3, 0])
    const top = 0.2 + 7 * r * 2
    for (const sx of [-1, 1]) kit.add(gableEndGeometry(d + 0.2, 1.7, 0.2), '#7b4f33', { position: [sx * (w / 2), top, 0], rotation: [0, PI / 2, 0] })
    // mossy shingle roof
    kit.gable(w + 1.0, d + 1.3, 2.0, PALETTE.roofMoss, [0, top - 0.15, 0], undefined, 0.22)
    for (let i = 0; i < 3; i++) kit.box([w + 1.0, 0.06, 0.1], '#4f7a40', [0, top + 0.35 + i * 0.5, (d + 1.3) / 2 - 0.45 - i * 0.62], [0.95, 0, 0])
    kit.add(lumpy(new THREE.IcosahedronGeometry(0.5, 0), 0.2, 4), '#7da85a', { position: [1.2, top + 1.1, 0.7], scale: [1.4, 0.35, 1] })
    stoneChimney(kit, [-1.5, 0, -0.9], top + 2.4)
    windowAt(kit, [-1.3, 1.45, d / 2 + 0.17], 0.65, 0.7)
    windowAt(kit, [1.5, 1.45, d / 2 + 0.17], 0.65, 0.7)
    door(kit, [0.1, 0, d / 2 + 0.17], 0.85, 1.6, PALETTE.woodDark)
    // porch
    kit.box([w + 0.4, 0.18, 1.3], PALETTE.woodLight, [0, 0.12, d / 2 + 0.75])
    for (const x of [-w / 2, -0.6, 0.8, w / 2]) kit.box([0.14, 2.2, 0.14], PALETTE.log, [x, 1.2, d / 2 + 1.3])
    kit.box([w + 0.6, 0.12, 1.6], PALETTE.roofMoss, [0, 2.35, d / 2 + 0.8], [0.22, 0, 0])
    kit.box([1.4, 0.08, 0.08], PALETTE.log, [-1.6, 0.85, d / 2 + 1.3])
    kit.box([1.3, 0.08, 0.08], PALETTE.log, [1.85, 0.85, d / 2 + 1.3])
    kit.box([0.4, 0.5, 0.3], PALETTE.glass, [0.95, 1.7, d / 2 + 1.3], undefined, 'glow')
  })
  // Lean-to wood shed with a log pile and a saw.
  kit.group({ position: [4.4, 0, -1.0] }, () => {
    for (const [x, z, h] of [
      [-1.1, 0.9, 2.4],
      [1.1, 0.9, 2.4],
      [-1.1, -0.9, 1.9],
      [1.1, -0.9, 1.9],
    ])
      kit.box([0.16, h, 0.16], PALETTE.log, [x, h / 2, z])
    kit.box([2.8, 0.12, 2.4], PALETTE.roofSlate, [0, 2.2, 0], [0.25, 0, 0])
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 5 - row; i++) kit.cyl(0.2, 0.2, 1.6, i % 2 ? '#a0714a' : '#8b5a3a', [-0.8 + i * 0.4 + row * 0.2, 0.2 + row * 0.36, -0.2], [PI / 2, 0, 0], 7)
    kit.cyl(0.42, 0.42, 0.04, '#c7ccd2', [0.9, 0.95, 1.4], [0, 0, PI / 2], 14, 'metal')
    kit.box([0.5, 0.5, 1.2], PALETTE.woodDark, [1.1, 0.45, 1.4])
  })
  // Stump with an axe, signpost, mushrooms
  kit.cyl(0.38, 0.45, 0.5, PALETTE.log, [2.5, 0.25, 1.5], undefined, 9)
  kit.cyl(0.34, 0.34, 0.02, '#d9b48a', [2.5, 0.51, 1.5], undefined, 9)
  kit.box([0.06, 0.8, 0.06], PALETTE.woodLight, [2.55, 0.85, 1.5], [0, 0, 0.5])
  kit.box([0.04, 0.22, 0.3], '#c7ccd2', [2.75, 1.18, 1.5], [0, 0, 0.5], 'metal')
  kit.group({ position: [-4.6, 0, 1.2] }, () => {
    kit.box([0.14, 2.1, 0.14], PALETTE.woodDark, [0, 1.05, 0])
    kit.box([1.1, 0.26, 0.06], PALETTE.woodLight, [0.4, 1.8, 0], [0, 0.2, 0])
    kit.box([0.9, 0.26, 0.06], PALETTE.woodLight, [-0.3, 1.4, 0], [0, -0.4, 0])
  })
  const rand = mulberry32(12)
  for (let i = 0; i < 6; i++) {
    const x = -5 + rand() * 2.5
    const z = -2 + rand() * 2
    kit.cyl(0.05, 0.06, 0.25, PALETTE.cream, [x, 0.12, z], undefined, 5)
    kit.sphere(0.16, '#d6493a', [x, 0.28, z], [1, 0.55, 1], 0)
  }
  bush(kit, [-3.2, 0, -2.6], 1.1, 5)
  bush(kit, [3.0, 0, -3.0], 1.2, 6)
  lampPost(kit, [-3.4, 0, 1.8], 2.3)
}

function mine(kit: Kit) {
  // Rocky hillock with a timbered adit and glowing crystals: the lab.
  kit.add(lumpy(new THREE.DodecahedronGeometry(3.2, 1), 0.7, 21), '#9d8a78', { position: [-2.4, 0.3, -3.2], scale: [1.4, 0.9, 1.0] }, 'base', 0.12)
  kit.add(lumpy(new THREE.DodecahedronGeometry(1.8, 0), 0.5, 22), '#8f7c6b', { position: [-5.2, 0.2, -1.8], scale: [1, 0.8, 1] }, 'base', 0.12)
  kit.group({ position: [-2.2, 0, -0.8] }, () => {
    kit.box([2.0, 2.4, 1.0], '#1c1715', [0, 1.2, -0.2])
    for (const x of [-1.15, 1.15]) kit.box([0.32, 2.7, 0.32], PALETTE.timber, [x, 1.35, 0.35])
    kit.box([2.8, 0.36, 0.42], PALETTE.timber, [0, 2.82, 0.35])
    kit.box([1.7, 0.42, 0.08], PALETTE.woodLight, [0, 3.25, 0.52])
    for (const x of [-1.6, 1.6]) kit.box([0.28, 0.44, 0.28], PALETTE.glass, [x, 2.3, 0.6], undefined, 'glow')
    // rails out of the adit
    for (const x of [-0.42, 0.42]) kit.box([0.08, 0.08, 3.6], '#8b8f96', [x, 0.06, 1.4], undefined, 'metal')
    for (let z = -0.2; z < 3.2; z += 0.45) kit.box([1.2, 0.06, 0.2], PALETTE.woodDark, [0, 0.02, z])
    // mine cart full of glowing ore
    kit.group({ position: [0, 0.1, 2.2] }, () => {
      kit.cyl(0.62, 0.48, 0.65, '#6b625b', [0, 0.6, 0], [0, PI / 4, 0], 4, 'metal')
      for (const [x, z] of [
        [-0.36, -0.36],
        [0.36, -0.36],
        [-0.36, 0.36],
        [0.36, 0.36],
      ])
        kit.cyl(0.15, 0.15, 0.08, PALETTE.iron, [x * 1.3, 0.16, z], [0, 0, PI / 2], 8, 'metal')
      for (let i = 0; i < 5; i++) kit.add(new THREE.OctahedronGeometry(0.16, 0), i % 2 ? PALETTE.crystal : PALETTE.crystal2, { position: [(i - 2) * 0.16, 1.0, (i % 2) * 0.15 - 0.07] }, 'glow')
    })
  })
  // Headframe: A-frame tower with the winding wheel (the wheel itself spins separately).
  kit.group({ position: [2.8, 0, -1.6] }, () => {
    for (const x of [-1, 1]) {
      kit.box([0.26, 7.4, 0.26], PALETTE.timber, [x * 0.9, 3.7, 0.6], [0, 0, x * 0.08])
      kit.box([0.26, 7.4, 0.26], PALETTE.timber, [x * 0.9, 3.7, -0.6], [0, 0, x * 0.08])
      kit.box([0.22, 7.6, 0.22], PALETTE.timber, [x * 0.6, 3.6, -2.2], [0.42, 0, 0])
    }
    for (const y of [1.6, 3.4, 5.2]) {
      kit.box([2.0, 0.16, 0.16], PALETTE.timber, [0, y, 0.6])
      kit.box([2.0, 0.16, 0.16], PALETTE.timber, [0, y, -0.6])
      kit.box([0.16, 0.16, 1.3], PALETTE.timber, [0.85, y, 0])
      kit.box([0.16, 0.16, 1.3], PALETTE.timber, [-0.85, y, 0])
    }
    kit.box([2.2, 0.3, 1.6], PALETTE.timber, [0, 7.3, 0])
    kit.box([1.6, 1.1, 1.3], PALETTE.roofSlate, [0, 0.55, 0])
    kit.box([0.06, 6.5, 0.06], '#2b2826', [0.55, 3.8, 0.3], undefined, 'metal')
  })
  // Copper "experiment" coil: a Tesla tower with a glowing orb.
  kit.group({ position: [0.9, 0, 1.3] }, () => {
    kit.cyl(0.45, 0.55, 0.4, PALETTE.iron, [0, 0.2, 0], undefined, 8, 'metal')
    kit.cyl(0.22, 0.26, 1.8, PALETTE.copper, [0, 1.3, 0], undefined, 8, 'metal')
    for (let y = 0.6; y < 2.2; y += 0.22) kit.cyl(0.28, 0.28, 0.05, '#e39a5f', [0, y, 0], undefined, 8, 'metal')
    kit.add(new THREE.TorusGeometry(0.42, 0.12, 6, 14), PALETTE.copper, { position: [0, 2.35, 0], rotation: [PI / 2, 0, 0] }, 'metal')
    kit.sphere(0.3, PALETTE.crystal, [0, 2.75, 0], 1, 1, 'glow')
  })
  // Crystal clusters
  const rand = mulberry32(31)
  for (const [cx, cz, n] of [
    [-4.2, 0.4, 5],
    [-0.4, -2.6, 4],
    [4.8, 0.8, 4],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const h = 0.5 + rand() * 0.9
      kit.add(new THREE.OctahedronGeometry(0.22, 0).scale(1, h * 3, 1), rand() < 0.5 ? PALETTE.crystal : PALETTE.crystal2, {
        position: [cx + (rand() - 0.5) * 0.9, h * 0.45, cz + (rand() - 0.5) * 0.9],
        rotation: [(rand() - 0.5) * 0.7, rand() * PI, (rand() - 0.5) * 0.7],
      }, 'glow')
    }
  }
  // Ore hopper on stilts
  kit.group({ position: [5.4, 0, -2.4] }, () => {
    for (const [x, z] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ])
      kit.box([0.18, 2.4, 0.18], PALETTE.timber, [x, 1.2, z])
    kit.cyl(1.2, 0.5, 1.4, PALETTE.wood, [0, 3.0, 0], undefined, 4)
    kit.box([0.5, 0.12, 1.8], PALETTE.wood, [0, 2.2, 1.2], [-0.5, 0, 0])
  })
  crate(kit, [3.2, 0, 1.4], 0.6, 0.4)
  barrel(kit, [4.0, 0, 1.6], PALETTE.woodDark)
}

function village(kit: Kit) {
  // Half-timbered cottage
  kit.group({ position: [-0.4, 0, -0.8] }, () => {
    house(kit, { pos: [0, 0, 0], w: 4.4, d: 3.2, h: 2.8, wall: PALETTE.plaster, roof: PALETTE.roofRed, plinth: PALETTE.stoneDark, pitch: 0.95 })
    for (const x of [-2.15, -0.75, 0.75, 2.15]) kit.box([0.14, 2.8, 0.06], PALETTE.timber, [x, 1.4, 1.62])
    kit.box([4.4, 0.14, 0.06], PALETTE.timber, [0, 1.5, 1.62])
    kit.box([4.4, 0.14, 0.06], PALETTE.timber, [0, 2.75, 1.62])
    kit.box([0.1, 1.6, 0.06], PALETTE.timber, [-1.45, 2.1, 1.63], [0, 0, 0.75])
    kit.box([0.1, 1.6, 0.06], PALETTE.timber, [1.45, 2.1, 1.63], [0, 0, -0.75])
    windowAt(kit, [-1.45, 2.15, 1.66], 0.55, 0.55)
    windowAt(kit, [1.45, 2.15, 1.66], 0.55, 0.55)
    windowAt(kit, [-1.45, 0.95, 1.66], 0.55, 0.6)
    door(kit, [0.05, 0, 1.64], 0.8, 1.45, '#8c2f39')
    flowerBox(kit, [-1.45, 0.55, 1.8], 0.8, 0, 4)
    flowerBox(kit, [-1.45, 1.75, 1.8], 0.7, 0, 5)
    flowerBox(kit, [1.45, 1.75, 1.8], 0.7, 0, 6)
    // dormer
    kit.box([1.1, 0.9, 1.2], PALETTE.plaster, [0.9, 3.4, 0.6])
    kit.gable(1.3, 1.5, 0.6, PALETTE.roofRed, [0.9, 3.85, 0.6], [0, PI / 2, 0], 0.12)
    windowAt(kit, [0.9, 3.4, 1.22], 0.45, 0.45)
    stoneChimney(kit, [-1.4, 2.6, -0.6], 2.5)
  })
  // Bell tower
  kit.group({ position: [-4.8, 0, -1.4] }, () => {
    kit.box([1.7, 4.2, 1.7], PALETTE.stone, [0, 2.1, 0])
    kit.box([1.85, 0.3, 1.85], PALETTE.stoneDark, [0, 0.15, 0])
    for (const [x, z] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ])
      kit.box([0.26, 1.5, 0.26], PALETTE.stone, [x, 4.95, z])
    kit.box([1.9, 0.22, 1.9], PALETTE.white, [0, 4.25, 0])
    kit.box([1.9, 0.22, 1.9], PALETTE.white, [0, 5.75, 0])
    kit.add(new THREE.CylinderGeometry(0.22, 0.45, 0.6, 10, 1, true), PALETTE.gold, { position: [0, 5.05, 0] }, 'metal')
    kit.cone(1.35, 1.9, PALETTE.roofSlate, [0, 5.85, 0], 4, [0, PI / 4, 0])
    kit.cone(0.08, 0.5, PALETTE.gold, [0, 7.7, 0], 4, undefined, 'metal')
    windowAt(kit, [0, 2.7, 0.86], 0.4, 0.75, 0, true)
    door(kit, [0, 0, 0.86], 0.75, 1.4, PALETTE.woodDark)
  })
  // Market stall with a striped awning
  kit.group({ position: [3.8, 0, 0.3], rotation: [0, -0.25, 0] }, () => {
    for (const [x, z] of [
      [-1.1, 0.6],
      [1.1, 0.6],
      [-1.1, -0.6],
      [1.1, -0.6],
    ])
      kit.box([0.1, 2.2, 0.1], PALETTE.woodDark, [x, 1.1, z])
    kit.box([2.4, 0.7, 1.1], PALETTE.wood, [0, 0.45, 0.1])
    for (let i = 0; i < 6; i++) kit.box([0.42, 0.06, 1.7], i % 2 ? PALETTE.white : PALETTE.red, [-1.05 + i * 0.42, 2.3, 0.15], [0.25, 0, 0])
    const fruit = ['#ef6f6c', '#f2c14e', '#8fbb57', '#ff9f43']
    for (let i = 0; i < 12; i++) kit.sphere(0.11, fruit[i % 4], [-0.9 + (i % 6) * 0.36, 0.88, -0.1 + Math.floor(i / 6) * 0.3], 1, 0)
  })
  // Well
  kit.group({ position: [2.8, 0, -2.9] }, () => {
    kit.cyl(0.75, 0.8, 0.8, PALETTE.stone, [0, 0.4, 0], undefined, 10)
    kit.cyl(0.6, 0.6, 0.05, '#3d6f86', [0, 0.72, 0], undefined, 10)
    for (const x of [-0.7, 0.7]) kit.box([0.12, 1.8, 0.12], PALETTE.woodDark, [x, 1.3, 0])
    kit.gable(1.0, 1.6, 0.55, PALETTE.roofRed, [0, 2.15, 0], [0, PI / 2, 0], 0.1)
    kit.cyl(0.08, 0.08, 1.4, PALETTE.wood, [0, 1.85, 0], [0, 0, PI / 2], 6)
    kit.cyl(0.18, 0.15, 0.3, PALETTE.wood, [0, 1.25, 0], undefined, 8)
  })
  // Bunting strung from the tower to the cottage
  const flags = ['#ef6f6c', '#f2c14e', '#3f8c84', '#f7f2ea', '#c98bd6']
  for (let i = 0; i < 11; i++) {
    const t = i / 10
    const x = -4.0 + t * 5.6
    const y = 4.6 - Math.sin(t * PI) * 0.8 - t * 0.8
    kit.add(new THREE.ConeGeometry(0.16, 0.38, 3).rotateX(PI).scale(1, 1, 0.15), flags[i % flags.length], { position: [x, y - 0.2, 0.4] })
  }
  fence(kit, [-6.2, 0, 1.6], [-3.2, 0, 1.6])
  fence(kit, [5.6, 0, -1.2], [5.6, 0, 1.6])
  lampPost(kit, [-2.9, 0, 1.6])
  bench(kit, [1.6, 0, 1.6], PI)
  bush(kit, [-6.4, 0, -0.6], 1, 7)
  bush(kit, [6.0, 0, -2.4], 1.1, 8)
}

/** Origin is the tower centre (the tower itself is built separately); +z faces the line. */
function lighthouseStation(kit: Kit) {
  // keeper's cottage beside the tower
  kit.group({ position: [-5.0, 0, -0.6], rotation: [0, 0.5, 0] }, () => {
    house(kit, { pos: [0, 0, 0], w: 3.4, d: 2.6, h: 2.2, wall: PALETTE.white, roof: PALETTE.roofRed, plinth: PALETTE.stoneDark, pitch: 0.8 })
    windowAt(kit, [-0.8, 1.25, 1.36], 0.55, 0.6)
    door(kit, [0.7, 0, 1.34], 0.75, 1.45, PALETTE.roofTeal)
    stoneChimney(kit, [-0.9, 1.9, -0.7], 1.8)
  })
  // signal mast with nautical flags
  kit.group({ position: [4.2, 0, -0.6] }, () => {
    kit.cyl(0.07, 0.1, 6.0, PALETTE.white, [0, 3.0, 0], undefined, 6)
    kit.box([1.8, 0.07, 0.07], PALETTE.white, [0, 4.9, 0])
    const flagColors = ['#cf4a3c', '#f2c14e', '#2f5f9e', '#f7f2ea', '#3f8c84']
    for (let i = 0; i < 5; i++) {
      kit.box([0.02, 0.36, 0.42], flagColors[i], [0.75, 4.6 - i * 0.48, 0.25])
      kit.box([0.02, 0.36, 0.42], flagColors[(i + 2) % 5], [-0.75, 4.55 - i * 0.48, 0.25])
    }
    kit.sphere(0.12, PALETTE.gold, [0, 6.08, 0], 1, 0, 'metal')
  })
  // telescope on a tripod, looking out to sea
  kit.group({ position: [-3.0, 0, 2.6], rotation: [0, 0.6, 0] }, () => {
    for (let i = 0; i < 3; i++) kit.box([0.05, 1.3, 0.05], PALETTE.woodDark, [Math.cos((i * 2 * PI) / 3) * 0.25, 0.6, Math.sin((i * 2 * PI) / 3) * 0.25], [Math.sin((i * 2 * PI) / 3) * 0.3, 0, -Math.cos((i * 2 * PI) / 3) * 0.3])
    kit.cyl(0.09, 0.13, 1.0, PALETTE.gold, [0, 1.35, 0.2], [1.2, 0, 0], 8, 'metal')
  })
  // red post box: the contact station
  kit.group({ position: [2.4, 0, 2.9] }, () => {
    kit.cyl(0.3, 0.3, 1.1, PALETTE.red, [0, 0.55, 0], undefined, 10)
    kit.sphere(0.3, PALETTE.red, [0, 1.1, 0], [1, 0.55, 1], 1)
    kit.box([0.36, 0.06, 0.1], PALETTE.iron, [0, 0.85, 0.28], undefined, 'metal')
    kit.cyl(0.34, 0.34, 0.1, PALETTE.iron, [0, 0.05, 0], undefined, 10, 'metal')
  })
  bench(kit, [0.2, 0, 3.4], PI)
  lampPost(kit, [3.6, 0, 2.2], 2.3)
}

const BUILDERS: Record<StationBuilding, (kit: Kit) => void> = {
  harbor,
  woodland,
  mine,
  village,
  lighthouse: lighthouseStation,
}

/** Adds a station's architecture to a kit (in the kit's current group space). */
export function buildStation(kit: Kit, type: StationBuilding) {
  BUILDERS[type](kit)
}

/** Local position and radius of the mine headframe's winding wheel (animated separately). */
export const MINE_WHEEL = { position: [2.8, 7.95, -1.6] as V3, radius: 0.85 }

/** The winding wheel: rim, spokes and hub, spinning about its local x axis. */
export function buildWheelGeometry() {
  const kit = new Kit(5)
  const r = MINE_WHEEL.radius
  kit.add(new THREE.TorusGeometry(r, 0.07, 6, 20), PALETTE.iron, { rotation: [0, PI / 2, 0] }, 'metal')
  for (let i = 0; i < 6; i++) kit.box([0.06, r * 2, 0.06], PALETTE.iron, [0, 0, 0], [(i / 6) * PI, 0, 0], 'metal')
  kit.cyl(0.14, 0.14, 0.3, PALETTE.gold, [0, 0, 0], [0, 0, PI / 2], 8, 'metal')
  return kit.build().metal!
}

// ---------------------------------------------------------------- lighthouse tower

export const LIGHTHOUSE = {
  height: 11.5,
  /** Lamp height above the ground at the summit. */
  lamp: 12.9,
}

export function buildLighthouseGeometry() {
  const kit = new Kit(77)
  const H = LIGHTHOUSE.height
  // octagonal stone base with steps
  kit.cyl(3.0, 3.2, 0.6, PALETTE.stoneDark, [0, 0.3, 0], undefined, 8)
  kit.cyl(2.6, 2.8, 0.7, PALETTE.stone, [0, 0.9, 0], undefined, 8)
  // banded, tapering tower
  const bands = 6
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands
    const t1 = (i + 1) / bands
    const r0 = 1.9 - t0 * 0.7
    const r1 = 1.9 - t1 * 0.7
    const h = (H - 1.3) / bands
    kit.add(new THREE.CylinderGeometry(r1, r0, h, 16), i % 2 ? PALETTE.red : PALETTE.white, { position: [0, 1.25 + h * (i + 0.5), 0] })
  }
  // windows climbing in a spiral
  for (let i = 0; i < 4; i++) {
    const y = 2.6 + i * 2.1
    const a = i * 1.7
    const r = 1.9 - ((y - 1.25) / (H - 1.3)) * 0.7 + 0.02
    kit.group({ position: [Math.sin(a) * r, y, Math.cos(a) * r], rotation: [0, a, 0] }, () => {
      kit.box([0.42, 0.6, 0.1], PALETTE.iron, [0, 0, 0])
      kit.box([0.3, 0.46, 0.12], PALETTE.glass, [0, 0, 0.01], undefined, 'glow')
    })
  }
  kit.group({ position: [0, 0, 1.92] }, () => {
    kit.box([0.9, 1.6, 0.2], PALETTE.roofTeal, [0, 1.95, 0])
    kit.box([1.1, 0.14, 0.4], PALETTE.white, [0, 2.8, 0.1])
  })
  // gallery deck with railing
  kit.cyl(1.75, 1.45, 0.3, PALETTE.iron, [0, H + 0.1, 0], undefined, 16, 'metal')
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PI * 2
    kit.box([0.05, 0.7, 0.05], PALETTE.iron, [Math.sin(a) * 1.65, H + 0.6, Math.cos(a) * 1.65], undefined, 'metal')
  }
  kit.add(new THREE.TorusGeometry(1.65, 0.04, 4, 24), PALETTE.iron, { position: [0, H + 0.95, 0], rotation: [PI / 2, 0, 0] }, 'metal')
  // lantern room: glass with mullions
  kit.cyl(1.05, 1.05, 0.35, PALETTE.white, [0, H + 0.42, 0], undefined, 12)
  kit.cyl(0.98, 0.98, 1.5, '#fff6d8', [0, H + 1.35, 0], undefined, 12, 'glow')
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2
    kit.box([0.06, 1.5, 0.06], PALETTE.iron, [Math.sin(a) * 1.0, H + 1.35, Math.cos(a) * 1.0], undefined, 'metal')
  }
  // dome roof with a vent ball and finial
  kit.add(new THREE.SphereGeometry(1.15, 12, 6, 0, PI * 2, 0, PI / 2), PALETTE.red, { position: [0, H + 2.1, 0], scale: [1, 0.75, 1] })
  kit.cyl(1.2, 1.2, 0.12, PALETTE.iron, [0, H + 2.12, 0], undefined, 12, 'metal')
  kit.sphere(0.24, PALETTE.iron, [0, H + 3.05, 0], 1, 1, 'metal')
  kit.cyl(0.04, 0.04, 0.6, PALETTE.gold, [0, H + 3.5, 0], undefined, 4, 'metal')
  return kit.build()
}

