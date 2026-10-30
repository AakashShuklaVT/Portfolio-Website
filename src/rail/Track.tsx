import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useWorldStore } from '../store/useWorldStore'
import { BRIDGE, TUNNEL, WARP, type TrackPath } from './TrackPath'
import { createPortalGeometry, frameAt, sweepProfile, PORTAL } from './trackGeometry'
import type { Heightfield } from '../world/terrainGen'
import { Kit } from '../lib/kit'
import { kitMaterials } from '../materials/kitMaterials'

const SLEEPER_SPACING = 0.8

// Flat-bottomed rail: foot, web and head.
const RAIL_PROFILE: [number, number][] = [
  [-0.1, 0.04],
  [0.1, 0.04],
  [0.1, 0.075],
  [0.025, 0.1],
  [0.025, 0.165],
  [0.065, 0.18],
  [0.065, 0.24],
  [-0.065, 0.24],
  [-0.065, 0.18],
  [-0.025, 0.165],
  [-0.025, 0.1],
  [-0.1, 0.075],
]
const offsetProfile = (p: [number, number][], ds: number) => p.map(([s, u]) => [s + ds, u] as [number, number])
const BALLAST_PROFILE: [number, number][] = [
  [-1.6, -0.5],
  [1.6, -0.5],
  [1.3, -0.05],
  [1.05, 0.03],
  [-1.05, 0.03],
  [-1.3, -0.05],
]
const DECK_PROFILE: [number, number][] = [
  [-1.65, -0.8],
  [1.65, -0.8],
  [1.65, -0.35],
  [1.8, -0.3],
  [1.8, 0.35],
  [1.65, 0.35],
  [1.65, -0.1],
  [-1.65, -0.1],
  [-1.65, 0.35],
  [-1.8, 0.35],
  [-1.8, -0.3],
  [-1.65, -0.35],
]

/** Inside of the tunnel vault: straight walls and a round arch (side, up). */
const VAULT_PROFILE: [number, number][] = (() => {
  const p: [number, number][] = [[PORTAL.halfWidth, -0.6]]
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI
    p.push([Math.cos(a) * PORTAL.halfWidth, PORTAL.spring + Math.sin(a) * PORTAL.halfWidth])
  }
  p.push([-PORTAL.halfWidth, -0.6])
  return p
})()

const materials = {
  rail: new THREE.MeshStandardNodeMaterial({ color: '#9aa0a8', roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
  ballast: new THREE.MeshStandardNodeMaterial({ color: '#a8957f', roughness: 1, side: THREE.DoubleSide }),
  sleeper: new THREE.MeshStandardNodeMaterial({ color: '#6f4a31', roughness: 1 }),
  deck: new THREE.MeshStandardNodeMaterial({ color: '#8a5b3a', roughness: 1, side: THREE.DoubleSide }),
  stone: new THREE.MeshStandardNodeMaterial({ color: '#c9b7a1', roughness: 1 }),
  vault: new THREE.MeshStandardNodeMaterial({ color: '#6d6158', roughness: 1, side: THREE.DoubleSide }),
}

/** Everything except the hidden stretch between the portal gates. */
function visibleRanges(track: TrackPath): [number, number][] {
  return track.runs.filter((r) => r.kind !== WARP).map((r) => [r.start, r.end])
}

/** Stone portal facades plus lamps inside each tunnel, merged into one kit. */
function buildPortals(track: TrackPath) {
  const kit = new Kit(77)
  const block = createPortalGeometry()
  const f = frameAt(track, 0)
  for (const run of track.runs) {
    if (run.kind !== TUNNEL) continue
    for (const [d, dir] of [
      [run.start - PORTAL.lead, -1],
      [run.end + PORTAL.lead, 1],
    ] as const) {
      frameAt(track, d, f)
      const facing = f.tangent.clone().multiplyScalar(dir).setY(0).normalize()
      kit.group({ position: [f.pos.x, f.pos.y, f.pos.z], rotation: [0, Math.atan2(facing.x, facing.z), 0] }, () => {
        // The block reads as part of the hillside: rock body, grassy cap, dressed-stone facade.
        kit.add(block, '#a8917b')
        kit.box([PORTAL.width + 0.3, 0.35, PORTAL.depth + 0.2], '#86b552', [0, PORTAL.height - 0.62, -PORTAL.depth / 2])
        kit.box([PORTAL.width - 0.6, 0.3, PORTAL.depth - 0.6], '#7fae4e', [0, PORTAL.height - 0.35, -PORTAL.depth / 2 - 0.1])
        // arch ring of lighter voussoirs with a keystone
        const ring = PORTAL.halfWidth + 0.32
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI
          const key = i === 4
          kit.box(
            [key ? 0.62 : 0.5, key ? 0.75 : 0.55, 0.28],
            key ? '#e3d4bd' : i % 2 ? '#d6c6ae' : '#cdbca3',
            [Math.cos(a) * ring, PORTAL.spring + Math.sin(a) * ring, 0.12],
            [0, 0, a - Math.PI / 2],
          )
        }
        // pilasters, cornice and parapet
        for (const x of [-1, 1]) {
          kit.box([0.7, PORTAL.height - 1.3, 0.36], '#cbb9a0', [x * (PORTAL.halfWidth + 0.75), (PORTAL.height - 1.3) / 2 - 0.8, 0.14])
          kit.box([0.9, 0.5, 0.5], '#b09c85', [x * (PORTAL.halfWidth + 0.75), -0.55, 0.2])
        }
        kit.box([PORTAL.width - 1.0, 0.32, 0.5], '#d9c9b0', [0, PORTAL.spring + PORTAL.halfWidth + 0.75, 0.12])
        // a lamp each side of the mouth
        for (const x of [-1, 1]) {
          kit.box([0.12, 0.5, 0.12], '#3a3230', [x * (PORTAL.halfWidth + 0.75), 2.6, 0.42], undefined, 'metal')
          kit.box([0.3, 0.38, 0.3], '#ffcf7a', [x * (PORTAL.halfWidth + 0.75), 3.05, 0.42], undefined, 'glow')
        }
      })
    }
    // Small lamps along the vault walls, so the inside reads as a lit passage.
    for (let d = run.start + 3; d < run.end - 2; d += 5) {
      frameAt(track, d, f)
      const side = Math.round((d - run.start) / 5) % 2 ? 1 : -1
      const p = f.pos.clone().addScaledVector(f.side, side * (PORTAL.halfWidth - 0.08)).addScaledVector(f.up, 2.3)
      kit.box([0.22, 0.3, 0.22], '#ffcf7a', [p.x, p.y, p.z], undefined, 'glow')
    }
  }
  block.dispose()
  return kit.build()
}

function buildTrack(track: TrackPath, hf: Heightfield) {
  const ranges = visibleRanges(track)
  const left = sweepProfile(track, ranges, offsetProfile(RAIL_PROFILE, -0.6))
  const right = sweepProfile(track, ranges, offsetProfile(RAIL_PROFILE, 0.6))
  const rails = mergeGeometries([left, right])!
  left.dispose()
  right.dispose()
  const ballast = sweepProfile(track, ranges, BALLAST_PROFILE, 1)

  const sleeperMatrices: THREE.Matrix4[] = []
  const f = frameAt(track, 0)
  const basis = new THREE.Matrix4()
  for (const [a, b] of ranges) {
    for (let d = a; d < b; d += SLEEPER_SPACING) {
      frameAt(track, d, f)
      basis.makeBasis(f.side, f.up, f.tangent).setPosition(f.pos)
      sleeperMatrices.push(basis.clone())
    }
  }

  // Tunnel vaults run a little past each mouth, inside the portal blocks.
  const tunnelRanges = track.runs.filter((r) => r.kind === TUNNEL).map((r) => [r.start - PORTAL.lead, r.end + PORTAL.lead] as [number, number])
  const vault = tunnelRanges.length ? sweepProfile(track, tunnelRanges, VAULT_PROFILE, 0.6) : null
  const portals = tunnelRanges.length ? buildPortals(track) : {}

  const bridgeRanges = track.runs.filter((r) => r.kind === BRIDGE).map((r) => [r.start - 1, r.end + 1] as [number, number])
  const deck = bridgeRanges.length ? sweepProfile(track, bridgeRanges, DECK_PROFILE, 1) : null
  const pillarMatrices: THREE.Matrix4[] = []
  for (const [a, b] of bridgeRanges) {
    for (let d = a + 2; d < b - 1; d += 4) {
      frameAt(track, d, f)
      const ground = hf.heightAt(f.pos.x, f.pos.z) - 1
      const top = f.pos.y - 0.6
      const h = Math.max(0.5, top - ground)
      const m = new THREE.Matrix4().makeBasis(f.side, new THREE.Vector3(0, 1, 0), f.tangent.clone().setY(0).normalize())
      m.scale(new THREE.Vector3(1, h, 1)).setPosition(f.pos.x, ground + h / 2, f.pos.z)
      pillarMatrices.push(m)
    }
  }

  return { rails, ballast, sleeperMatrices, vault, portals, deck, pillarMatrices }
}

function Instances({ geometry, material, matrices }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length))
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat))
    m.count = matrices.length
    m.instanceMatrix.needsUpdate = true
    m.castShadow = true
    m.receiveShadow = true
    m.computeBoundingSphere()
    return m
  }, [geometry, material, matrices])
  useEffect(() => () => mesh.dispose(), [mesh])
  return <primitive object={mesh} />
}

const sleeperGeometry = new THREE.BoxGeometry(1.9, 0.13, 0.3).translate(0, -0.02, 0)
const pillarGeometry = new THREE.BoxGeometry(1.3, 1, 1.3)

export function Track() {
  const derived = useWorldStore((s) => s.derived)
  const built = useMemo(() => (derived ? buildTrack(derived.track, derived.heightfield) : null), [derived])

  useEffect(
    () => () => {
      if (!built) return
      built.rails.dispose()
      built.ballast.dispose()
      built.vault?.dispose()
      built.deck?.dispose()
      Object.values(built.portals).forEach((g) => g?.dispose())
    },
    [built],
  )

  if (!built) return null
  const { base, metal, glow } = built.portals
  return (
    <group name="track">
      <mesh geometry={built.rails} material={materials.rail} castShadow />
      <mesh geometry={built.ballast} material={materials.ballast} receiveShadow />
      <Instances geometry={sleeperGeometry} material={materials.sleeper} matrices={built.sleeperMatrices} />
      {built.vault && <mesh geometry={built.vault} material={materials.vault} receiveShadow />}
      {base && <mesh geometry={base} material={kitMaterials.base} castShadow receiveShadow />}
      {metal && <mesh geometry={metal} material={kitMaterials.metal} />}
      {glow && <mesh geometry={glow} material={kitMaterials.glow} />}
      {built.deck && <mesh geometry={built.deck} material={materials.deck} castShadow receiveShadow />}
      {built.pillarMatrices.length > 0 && <Instances geometry={pillarGeometry} material={materials.stone} matrices={built.pillarMatrices} />}
    </group>
  )
}
