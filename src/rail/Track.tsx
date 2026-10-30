import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { useWorldStore } from '../store/useWorldStore'
import { BRIDGE, TUNNEL, type TrackPath } from './TrackPath'
import { createPortalGeometry, createPortalMouthGeometry, frameAt, sweepProfile } from './trackGeometry'
import type { Heightfield } from '../world/terrainGen'

/** How far rails continue into a tunnel past the portal. */
const TUNNEL_LEAD = 5
const SLEEPER_SPACING = 0.85

const RAIL_PROFILE: [number, number][] = [
  [-0.07, 0.05],
  [0.07, 0.05],
  [0.07, 0.2],
  [-0.07, 0.2],
]
const offsetProfile = (p: [number, number][], ds: number) => p.map(([s, u]) => [s + ds, u] as [number, number])
const BALLAST_PROFILE: [number, number][] = [
  [-1.45, -0.45],
  [1.45, -0.45],
  [1.0, 0.02],
  [-1.0, 0.02],
]
const DECK_PROFILE: [number, number][] = [
  [-1.6, -0.75],
  [1.6, -0.75],
  [1.6, -0.4],
  [-1.6, -0.4],
]

const materials = {
  rail: new THREE.MeshStandardNodeMaterial({ color: '#8b8f96', roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
  ballast: new THREE.MeshStandardNodeMaterial({ color: '#a89580', roughness: 1, side: THREE.DoubleSide }),
  sleeper: new THREE.MeshStandardNodeMaterial({ color: '#7a5236', roughness: 1 }),
  deck: new THREE.MeshStandardNodeMaterial({ color: '#8a5b3a', roughness: 1, side: THREE.DoubleSide }),
  stone: new THREE.MeshStandardNodeMaterial({ color: '#c9b7a1', roughness: 1 }),
  mouth: new THREE.MeshBasicNodeMaterial({ color: '#1e1814' }),
}

/** Visible ranges: everything except the inside of tunnels. */
function visibleRanges(track: TrackPath): [number, number][] {
  const ranges: [number, number][] = []
  for (const run of track.runs) {
    if (run.kind === TUNNEL) {
      const len = run.end - run.start
      if (len <= TUNNEL_LEAD * 2) ranges.push([run.start, run.end])
      else {
        ranges.push([run.start, run.start + TUNNEL_LEAD])
        ranges.push([run.end - TUNNEL_LEAD, run.end])
      }
    } else ranges.push([run.start, run.end])
  }
  return ranges
}

function buildTrack(track: TrackPath, hf: Heightfield) {
  const ranges = visibleRanges(track)
  const rails = sweepProfile(track, ranges, offsetProfile(RAIL_PROFILE, -0.55))
  const rails2 = sweepProfile(track, ranges, offsetProfile(RAIL_PROFILE, 0.55))
  const ballast = sweepProfile(track, ranges, BALLAST_PROFILE, 1)

  // Sleepers
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

  // Bridges: deck + pillars
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

  // Tunnel portals: face away from the tunnel at both ends.
  const portals: { position: THREE.Vector3; quaternion: THREE.Quaternion }[] = []
  const zAxis = new THREE.Vector3(0, 0, 1)
  for (const run of track.runs) {
    if (run.kind !== TUNNEL) continue
    for (const [d, dir] of [
      [run.start + 1.2, -1],
      [run.end - 1.2, 1],
    ] as const) {
      frameAt(track, d, f)
      const facing = f.tangent.clone().multiplyScalar(dir).setY(0).normalize()
      portals.push({
        position: f.pos.clone(),
        quaternion: new THREE.Quaternion().setFromUnitVectors(zAxis, facing),
      })
    }
  }

  return { rails, rails2, ballast, sleeperMatrices, deck, pillarMatrices, portals }
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

const sleeperGeometry = new THREE.BoxGeometry(1.75, 0.12, 0.32).translate(0, -0.01, 0)
const pillarGeometry = new THREE.BoxGeometry(1.2, 1, 1.2)
const portalGeometry = createPortalGeometry()
portalGeometry.computeVertexNormals()
const mouthGeometry = createPortalMouthGeometry()

export function Track() {
  const derived = useWorldStore((s) => s.derived)
  const built = useMemo(() => (derived ? buildTrack(derived.track, derived.heightfield) : null), [derived])

  useEffect(
    () => () => {
      if (!built) return
      built.rails.dispose()
      built.rails2.dispose()
      built.ballast.dispose()
      built.deck?.dispose()
    },
    [built],
  )

  if (!built) return null
  return (
    <group name="track">
      <mesh geometry={built.rails} material={materials.rail} castShadow />
      <mesh geometry={built.rails2} material={materials.rail} castShadow />
      <mesh geometry={built.ballast} material={materials.ballast} receiveShadow />
      <Instances geometry={sleeperGeometry} material={materials.sleeper} matrices={built.sleeperMatrices} />
      {built.deck && <mesh geometry={built.deck} material={materials.deck} castShadow receiveShadow />}
      {built.pillarMatrices.length > 0 && <Instances geometry={pillarGeometry} material={materials.stone} matrices={built.pillarMatrices} />}
      {built.portals.map((p, i) => (
        <group key={i} position={p.position} quaternion={p.quaternion}>
          <mesh geometry={portalGeometry} material={materials.stone} castShadow receiveShadow />
          <mesh geometry={mouthGeometry} material={materials.mouth} position-z={-0.9} />
        </group>
      ))}
    </group>
  )
}
