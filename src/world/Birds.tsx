import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { abs, attribute, cos, cross, float, instancedBufferAttribute, instancedDynamicBufferAttribute, max, mix, positionGeometry, sign, sin, smoothstep, time, vec3, vec4 } from 'three/tsl'
import { Kit } from '../lib/kit'
import { useSettingsStore } from '../store/useSettingsStore'

// Herring gulls. A hand-shaped body (tapered torso, head, hooked yellow
// beak, fanned tail) and two-part wings: a broad grey arm and a swept,
// black-tipped hand. In the vertex shader each wing hinges at the shoulder
// and folds at the elbow, with the hand lagging the arm, so the beat reads
// as a real downstroke and upstroke; birds alternate flapping and gliding.
// Flight paths are integrated on the CPU and fed in as per-bird attributes.

interface Flock {
  count: number
  centre: [number, number, number]
  radius: [number, number]
  height: number
  speed: number
  phase: number
  /** Figure-of-eight amount (0 = plain loop). */
  eight: number
}

const FLOCKS: Flock[] = [
  { count: 5, centre: [8, 0, 52], radius: [20, 13], height: 15, speed: 0.2, phase: 0, eight: 0.25 },
  { count: 6, centre: [0, 0, 0], radius: [58, 50], height: 40, speed: 0.085, phase: 2.4, eight: 0.4 },
  { count: 3, centre: [0, 0, 0], radius: [15, 13], height: 39, speed: -0.26, phase: 1.1, eight: 0 },
  { count: 4, centre: [-40, 0, -30], radius: [22, 16], height: 24, speed: 0.15, phase: 4.2, eight: 0.6 },
]
const TOTAL = FLOCKS.reduce((n, f) => n + f.count, 0)
const SCALE = 1.15

/** Wing joints in model space (x across the span). */
const SHOULDER = 0.09
const ELBOW = 0.62

const GREY = '#b4bcc6'
const WHITE = '#f5f5f2'
const BLACK = '#26272a'

/** One wing (right side, x > 0) as a thin slab, top grey, underside white, black hand tip. */
function buildWing(points: [number, number][], tip: boolean) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }).rotateX(-Math.PI / 2)
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const under = nor.getY(i) < -0.5
    if (tip && x > 1.12) c.set(x > 1.3 && x < 1.37 && z > -0.2 && !under ? WHITE : BLACK)
    else c.set(under ? WHITE : GREY)
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

function buildGull() {
  const kit = new Kit(9)
  // torso: a stretched sphere tapered towards the tail
  const torso = new THREE.SphereGeometry(1, 12, 8)
  const p = torso.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    const taper = z < 0 ? 1 + z * 0.55 : 1
    p.setXYZ(i, p.getX(i) * 0.15 * taper, p.getY(i) * 0.14 * taper + (z < 0 ? -z * 0.03 : 0), z * 0.48)
  }
  kit.add(torso, WHITE)
  kit.add(new THREE.SphereGeometry(1, 8, 6).scale(0.12, 0.1, 0.32), GREY, { position: [0, 0.07, -0.05] })
  kit.sphere(0.115, WHITE, [0, 0.08, 0.44], [1, 0.95, 1.15], 1)
  // beak with the red gonys spot, and eyes
  kit.add(new THREE.ConeGeometry(0.035, 0.2, 5).rotateX(Math.PI / 2), '#f2b43c', { position: [0, 0.05, 0.62] })
  kit.sphere(0.018, '#d6493a', [0, 0.03, 0.6], 1, 0)
  for (const x of [-1, 1]) kit.sphere(0.018, '#1c1b1a', [x * 0.072, 0.11, 0.5], 1, 0)
  // fanned tail
  kit.add(new THREE.CircleGeometry(0.2, 7, Math.PI * 1.15, Math.PI * 0.7).rotateX(-Math.PI / 2).scale(1.1, 1, 1), WHITE, { position: [0, 0.01, -0.36] })
  // tucked feet
  for (const x of [-0.05, 0.05]) kit.box([0.03, 0.03, 0.14], '#e8a07a', [x, -0.11, -0.22])
  const body = kit.build().base!

  const inner: [number, number][] = [
    [SHOULDER, 0.15],
    [0.42, 0.19],
    [ELBOW, 0.19],
    [ELBOW, -0.24],
    [0.38, -0.26],
    [SHOULDER, -0.2],
  ]
  const outer: [number, number][] = [
    [ELBOW, 0.19],
    [0.82, 0.17],
    [1.06, 0.08],
    [1.32, -0.06],
    [1.52, -0.24],
    [1.3, -0.29],
    [1.02, -0.3],
    [0.78, -0.27],
    [ELBOW, -0.24],
  ]
  const right = mergeGeometries([buildWing(inner, false), buildWing(outer, true)])!
  const leftWing = right.clone().scale(-1, 1, 1)

  // aWing marks vertices that hinge (1) versus the rigid body (0).
  const flag = (g: THREE.BufferGeometry, v: number) => g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1))
  flag(body, 0)
  flag(right, 1)
  flag(leftWing, 1)
  const merged = mergeGeometries([body, right, leftWing])!
  merged.computeBoundingSphere()
  return merged
}

function createGullMaterial(offset: THREE.InstancedBufferAttribute, quat: THREE.InstancedBufferAttribute, seeds: THREE.InstancedBufferAttribute) {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide })
  const o = instancedDynamicBufferAttribute(offset, 'vec4') as unknown as ReturnType<typeof vec4>
  const q = instancedDynamicBufferAttribute(quat, 'vec4') as unknown as ReturnType<typeof vec4>
  const seed = instancedBufferAttribute(seeds, 'float') as unknown as ReturnType<typeof float>
  const isWing = attribute('aWing', 'float')

  // Bursts of flapping between long glides.
  const glide = smoothstep(-0.25, 0.35, sin(time.mul(0.42).add(seed.mul(40))))
  const amp = mix(float(0.1), float(0.95), glide)
  const beat = time.mul(mix(float(6.5), float(8.5), seed)).add(seed.mul(30))
  const p = positionGeometry
  const side = sign(p.x)
  const ax = abs(p.x)

  // Elbow: the hand folds relative to the arm, lagging the beat.
  const elbow = sin(beat.sub(0.9)).mul(amp).mul(0.42).add(0.04)
  const r2 = max(ax.sub(ELBOW), 0)
  const xe = ax.sub(r2).add(r2.mul(cos(elbow)))
  const ye = p.y.add(r2.mul(sin(elbow)))
  // Shoulder: the whole wing swings up and down, with a little dihedral.
  const shoulder = sin(beat).mul(amp).mul(0.52).add(0.08)
  const rx = xe.sub(SHOULDER)
  const xs = float(SHOULDER).add(rx.mul(cos(shoulder))).sub(ye.mul(sin(shoulder)))
  const ys = rx.mul(sin(shoulder)).add(ye.mul(cos(shoulder)))
  const wing = vec3(side.mul(xs), ys, p.z)
  // The body rises a touch on each downstroke.
  const bob = vec3(0, sin(beat).mul(-0.035).mul(amp), 0)
  const local = mix(p, wing, isWing).add(bob)

  // Rotate by the bird's quaternion, scale, and move it into place.
  const t = cross(q.xyz, local).mul(2)
  const rotated = local.add(t.mul(q.w)).add(cross(q.xyz, t))
  m.positionNode = rotated.mul(o.w).add(o.xyz)
  return m
}

const pos = new THREE.Vector3()
const next = new THREE.Vector3()
const vel = new THREE.Vector3()
const q = new THREE.Quaternion()
const e = new THREE.Euler(0, 0, 0, 'YXZ')

function pathAt(f: Flock, a: number, slot: number, out: THREE.Vector3) {
  const lane = slot * 1.7
  out.set(
    f.centre[0] + Math.cos(a) * (f.radius[0] + lane * 0.4),
    f.height + Math.sin(a * 2 + slot) * 2.2 + slot * 0.6,
    f.centre[2] + Math.sin(a) * (f.radius[1] - lane * 0.3) + Math.sin(a * 2) * f.radius[1] * f.eight,
  )
  return out
}

const yawAt = (f: Flock, a: number, slot: number) => {
  pathAt(f, a, slot, pos)
  pathAt(f, a + 0.01 * Math.sign(f.speed || 1), slot, next)
  return Math.atan2(next.x - pos.x, next.z - pos.z)
}

export function Birds() {
  const { mesh, offset, quat } = useMemo(() => {
    const offset = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4)
    const quat = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4)
    offset.setUsage(THREE.DynamicDrawUsage)
    quat.setUsage(THREE.DynamicDrawUsage)
    const seeds = new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: TOTAL }, (_, i) => (i * 0.618) % 1)), 1)
    const mesh = new THREE.Mesh(buildGull(), createGullMaterial(offset, quat, seeds))
    mesh.count = TOTAL
    mesh.frustumCulled = false
    mesh.castShadow = true
    return { mesh, offset, quat }
  }, [])
  const clock = useMemo(() => ({ t: 0 }), [])

  useFrame((_, dt) => {
    clock.t += Math.min(dt, 0.1) * (useSettingsStore.getState().reducedMotion ? 0.4 : 1)
    const oa = offset.array as Float32Array
    const qa = quat.array as Float32Array
    let i = 0
    for (const f of FLOCKS) {
      for (let k = 0; k < f.count; k++) {
        const a = clock.t * f.speed + f.phase - k * 0.07 * Math.sign(f.speed)
        // Bank into the turn by how fast the heading is changing.
        const da = 0.03 * Math.sign(f.speed || 1)
        let turn = yawAt(f, a + da, k) - yawAt(f, a, k)
        turn = Math.atan2(Math.sin(turn), Math.cos(turn))
        pathAt(f, a, k, pos)
        pathAt(f, a + 0.01 * Math.sign(f.speed || 1), k, next)
        vel.subVectors(next, pos)
        const yaw = Math.atan2(vel.x, vel.z)
        const pitch = -Math.atan2(vel.y, Math.hypot(vel.x, vel.z))
        const bank = Math.max(-0.7, Math.min(0.7, -turn * 9))
        q.setFromEuler(e.set(pitch, yaw, bank))
        oa.set([pos.x, pos.y, pos.z, SCALE], i * 4)
        qa.set([q.x, q.y, q.z, q.w], i * 4)
        i++
      }
    }
    offset.needsUpdate = true
    quat.needsUpdate = true
    // Dev only: lets the camera follow the first gull (window.__follow = window.__birdPos).
    if (import.meta.env.DEV) ((window as unknown as { __birdPos?: THREE.Vector3 }).__birdPos ??= new THREE.Vector3()).fromArray(oa, 0)
  })

  return <primitive object={mesh} />
}
