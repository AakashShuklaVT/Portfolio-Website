import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { atan, color, cos, float, fract, hash, instanceIndex, length, mix, positionLocal, sin, smoothstep, step, time, uniform, uv, vec3 } from 'three/tsl'
import { useWorldStore } from '../store/useWorldStore'
import { Kit, lumpy } from '../lib/kit'
import { kitMaterials } from '../materials/kitMaterials'
import { frameAt } from './trackGeometry'
import { warpRuntime, warpUniforms } from './warp'

const DISC = 3.18
/** Inner and outer radius of the stone ring. */
const RING_IN = DISC + 0.14
const RING_OUT = RING_IN + 0.9
/** Gate centre above the rail. */
export const GATE_HEIGHT = 2.35
const MOTES = 28
const PI = Math.PI

const flash = uniform(0)

/** One wedge-cut voussoir: an annular sector between angles a0 and a1, centred on z = 0. */
function voussoir(r0: number, r1: number, a0: number, a1: number, depth: number) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, r1, a0, a1, false)
  shape.absarc(0, 0, r0, a1, a0, true)
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 }).translate(0, 0, -depth / 2)
}

// Built in the same dressed stone as the tunnel portals and stations: a ring of
// wedge voussoirs on stepped plinths, a mossy crown and a lamp either side.
function buildGateKit() {
  const kit = new Kit(55)
  const blocks = 16
  const arc = (PI * 2) / blocks
  const gap = 0.035
  const mean = (RING_IN + RING_OUT) * 0.5
  // Stones run from the keystone down each side until they reach the rail bed.
  const lowMid = PI / 2 - arc * Math.floor((PI / 2 - Math.asin((-GATE_HEIGHT + 0.5) / mean)) / arc)
  const lowest = lowMid - arc / 2
  for (let i = 0; i < blocks; i++) {
    const mid = PI / 2 + i * arc
    if (Math.sin(mid) < Math.sin(lowMid) - 1e-6) continue
    const key = i === 0
    const out = key ? RING_OUT + 0.38 : RING_OUT
    const depth = key ? 1.15 : 0.95
    kit.add(voussoir(RING_IN, out, mid - arc / 2 + gap, mid + arc / 2 - gap, depth), key ? '#e3d4bd' : i % 2 ? '#d6c6ae' : '#cdbca3')
    // a proud brass stud on each face, every other stone
    if (i % 2 === 0 && !key) {
      const r = RING_IN + 0.45
      for (const z of [-1, 1]) kit.cyl(0.11, 0.11, 0.06, '#e0b252', [Math.cos(mid) * r, Math.sin(mid) * r, z * (depth / 2 + 0.02)], [PI / 2, 0, 0], 8, 'metal')
    }
  }
  // brass band lining the opening, only over the arc that stands above the rail
  kit.add(new THREE.TorusGeometry(DISC + 0.07, 0.085, 6, 40, PI - 2 * lowest), '#e0b252', { rotation: [0, 0, lowest] }, 'metal')
  // keystone crystal, like the ones in the mine
  kit.add(new THREE.OctahedronGeometry(0.3, 0), '#5ff2e4', { position: [0, RING_OUT + 0.75, 0], scale: [1, 1.5, 1] }, 'glow')
  kit.box([0.7, 0.18, 0.7], '#b09c85', [0, RING_OUT + 0.32, 0])
  // moss on the crown
  for (const [a, s] of [
    [PI * 0.62, 0.75],
    [PI * 0.7, 0.55],
    [PI * 0.38, 0.6],
    [PI * 0.86, 0.45],
  ] as const) {
    const r = RING_OUT - 0.05
    kit.add(lumpy(new THREE.DodecahedronGeometry(s, 0), 0.12, a * 10), a > PI / 2 ? '#86b552' : '#7fae4e', {
      position: [Math.cos(a) * r, Math.sin(a) * r, 0.05],
      scale: [1.2, 0.55, 1.15],
      rotation: [0, 0, a - PI / 2],
    })
  }
  // stepped plinths, each with a lamp post
  const px = mean * Math.cos(lowMid) + 0.15
  for (const sx of [-1, 1]) {
    kit.box([1.9, 0.8, 1.7], '#b09c85', [sx * px, -GATE_HEIGHT + 0.15, 0])
    kit.box([1.5, 0.35, 1.35], '#cbb9a0', [sx * px, -GATE_HEIGHT + 0.7, 0])
    kit.box([0.12, 1.3, 0.12], '#3a3230', [sx * (px + 0.55), -GATE_HEIGHT + 1.5, 0.5], undefined, 'metal')
    kit.box([0.34, 0.12, 0.34], '#3a3230', [sx * (px + 0.55), -GATE_HEIGHT + 2.18, 0.5], undefined, 'metal')
    kit.box([0.28, 0.36, 0.28], '#ffcf7a', [sx * (px + 0.55), -GATE_HEIGHT + 2.42, 0.5], undefined, 'glow')
    kit.cone(0.26, 0.22, '#3a3230', [sx * (px + 0.55), -GATE_HEIGHT + 2.6, 0.5], 4, undefined, 'metal')
  }
  return kit.build()
}

/**
 * Cel-shaded sea and sky: flat bands of the island's teals stepping in to a warm,
 * sunlit centre, with wavy foam rings drawn steadily inwards.
 */
function createDiscMaterial() {
  const c = uv().sub(0.5).mul(2)
  const r = length(c)
  const ang = atan(c.y, c.x)
  // the band edges wobble more towards the rim, so the sunlit core stays round
  const t = r.add(sin(ang.mul(5).add(time.mul(0.8)).sub(r.mul(8))).mul(r.mul(0.045)))
  let col = mix(color('#fff3d6'), color('#a8e6d6'), step(0.2, t))
  col = mix(col, color('#56b8ac'), step(0.42, t))
  col = mix(col, color('#2f8f83'), step(0.64, t))
  col = mix(col, color('#1f5f64'), step(0.84, t))
  const ripple = step(0.86, fract(r.mul(3.2).add(time.mul(0.32)).add(sin(ang.mul(3).sub(time.mul(0.6))).mul(0.06))))
  col = mix(col, color('#f7f2ea'), ripple.mul(smoothstep(0.15, 0.3, r)).mul(0.55))
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
  m.colorNode = col.mul(float(1).add(flash.mul(0.9)))
  return m
}

/** A soft glow just outside the stone, swelling as the train passes. */
function createHaloMaterial() {
  const c = uv().sub(0.5).mul(2)
  const r = length(c)
  const ring = smoothstep(1.0, 0.8, r).mul(smoothstep(0.62, 0.72, r))
  const pulse = sin(time.mul(1.6)).mul(0.1).add(0.9)
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  m.colorNode = color('#9ff0e0')
  m.opacityNode = ring.mul(pulse).mul(float(0.18).add(flash.mul(0.9)))
  return m
}

/** Motes drifting in from around the crown and drawn into the disc, placed on the GPU from the instance index. */
function createMoteMaterial() {
  const i = float(instanceIndex)
  const seed = hash(i)
  const phase = fract(time.mul(hash(i.add(7)).mul(0.12).add(0.1)).add(seed))
  const a = mix(float(-0.3), float(PI + 0.3), hash(i.add(11))).add(phase.mul(1.4))
  const radius = mix(float(RING_OUT + 1.2), float(0.3), phase.mul(phase))
  const z = float(1).sub(phase).mul(sin(seed.mul(40))).mul(1.2)
  const m = new THREE.MeshBasicNodeMaterial()
  m.positionNode = positionLocal.mul(sin(phase.mul(PI))).add(vec3(cos(a).mul(radius), sin(a).mul(radius), z))
  m.colorNode = mix(color('#fff1c4'), color('#bff5ea'), hash(i.add(3)))
  return m
}

const discGeometry = new THREE.CircleGeometry(DISC, 48)
const haloGeometry = new THREE.PlaneGeometry(RING_OUT * 3, RING_OUT * 3)
const moteGeometry = new THREE.OctahedronGeometry(0.075, 0)

/** The two portal gates: the train leaves the summit through one and comes back out of the other. */
export function WarpGates() {
  const track = useWorldStore((s) => s.derived?.track)
  const kit = useMemo(buildGateKit, [])
  const disc = useMemo(createDiscMaterial, [])
  const halo = useMemo(createHaloMaterial, [])
  const motes = useMemo(() => {
    const material = createMoteMaterial()
    return [0, 1].map(() => {
      const mesh = new THREE.Mesh(moteGeometry, material)
      mesh.count = MOTES
      mesh.frustumCulled = false
      return mesh
    })
  }, [])

  const gates = useMemo(() => {
    if (!track?.warp) return []
    return [track.warp.start, track.warp.end].map((d) => {
      const f = frameAt(track, d)
      const tangent = f.tangent.clone().setY(0).normalize()
      return {
        position: f.pos.clone().addScaledVector(f.up, GATE_HEIGHT),
        tangent,
        yaw: Math.atan2(tangent.x, tangent.z),
      }
    })
  }, [track])

  useEffect(() => {
    const [exit, entry] = gates
    if (!exit) {
      warpUniforms.exitPos.value.set(1e5, 0, 0)
      warpUniforms.entryPos.value.set(1e5, 0, 0)
      return
    }
    warpUniforms.exitPos.value.copy(exit.position)
    warpUniforms.exitDir.value.copy(exit.tangent)
    warpUniforms.entryPos.value.copy(entry.position)
    warpUniforms.entryDir.value.copy(entry.tangent)
  }, [gates])

  useFrame((_, dt) => {
    warpRuntime.exitFlash = Math.max(0, warpRuntime.exitFlash - dt * 0.8)
    warpRuntime.entryFlash = Math.max(0, warpRuntime.entryFlash - dt * 0.8)
    flash.value = Math.max(warpRuntime.exitFlash, warpRuntime.entryFlash)
  })

  if (!gates.length) return null
  return (
    <group name="warp-gates">
      {gates.map((g, i) => (
        <group key={i} position={g.position} rotation-y={g.yaw}>
          {kit.base && <mesh geometry={kit.base} material={kitMaterials.base} castShadow receiveShadow />}
          {kit.metal && <mesh geometry={kit.metal} material={kitMaterials.metal} />}
          {kit.glow && <mesh geometry={kit.glow} material={kitMaterials.glow} />}
          <mesh geometry={discGeometry} material={disc} />
          <mesh geometry={haloGeometry} material={halo} renderOrder={2} />
          <primitive object={motes[i]} />
        </group>
      ))}
    </group>
  )
}
