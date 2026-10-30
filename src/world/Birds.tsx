import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { abs, float, hash, instanceIndex, max, mix, positionGeometry, positionLocal, sin, smoothstep, time, vec3 } from 'three/tsl'
import { Kit } from '../lib/kit'
import { useSettingsStore } from '../store/useSettingsStore'

// Seagulls. Flight paths are integrated on the CPU (a couple of dozen
// matrices); the wing beat runs in the vertex shader, so it never stalls.

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
  { count: 5, centre: [8, 0, 52], radius: [20, 13], height: 15, speed: 0.22, phase: 0, eight: 0.25 },
  { count: 6, centre: [0, 0, 0], radius: [58, 50], height: 40, speed: 0.09, phase: 2.4, eight: 0.4 },
  { count: 3, centre: [0, 0, 0], radius: [15, 13], height: 39, speed: -0.3, phase: 1.1, eight: 0 },
  { count: 4, centre: [-40, 0, -30], radius: [22, 16], height: 24, speed: 0.16, phase: 4.2, eight: 0.6 },
]
const TOTAL = FLOCKS.reduce((n, f) => n + f.count, 0)
const SCALE = 1.5

function buildGull() {
  const kit = new Kit(9)
  kit.sphere(1, '#f7f4ef', [0, 0, 0], [0.17, 0.16, 0.5], 1)
  kit.sphere(0.13, '#f7f4ef', [0, 0.07, 0.42], 1, 1)
  kit.cone(0.04, 0.18, '#f2b43c', [0, 0.05, 0.52], 4, [Math.PI / 2, 0, 0])
  kit.add(new THREE.ConeGeometry(0.16, 0.38, 3).rotateX(-Math.PI / 2).scale(1, 0.15, 1), '#d9dadb', { position: [0, 0.02, -0.55] })
  for (const sx of [-1, 1]) {
    // inner wing (grey) and dark outer primaries; flat triangles, drawn double-sided
    const inner = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0.05 * sx, 0.04, 0.18, 0.62 * sx, 0.03, 0.08, 0.05 * sx, 0.04, -0.18, 0.62 * sx, 0.03, 0.08, 0.62 * sx, 0.03, -0.16, 0.05 * sx, 0.04, -0.18], 3),
    )
    const outer = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0.62 * sx, 0.03, 0.08, 1.25 * sx, 0.02, -0.1, 0.62 * sx, 0.03, -0.16], 3),
    )
    kit.add(inner, '#c9ccd0')
    kit.add(outer, '#3f4246')
  }
  return kit.build().base!
}

function createGullMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide })
  const seed = hash(float(instanceIndex))
  // Bursts of flapping between long glides.
  const glide = smoothstep(-0.2, 0.4, sin(time.mul(0.45).add(seed.mul(40))))
  const amp = mix(float(0.12), float(0.75), glide)
  const beat = time.mul(mix(float(7), float(9), seed)).add(seed.mul(30))
  const span = abs(positionGeometry.x)
  const outerSpan = max(span.sub(0.62), 0)
  const lift = span.mul(sin(beat)).mul(amp).add(outerSpan.mul(sin(beat.sub(0.7))).mul(amp).mul(0.8))
  m.positionNode = positionLocal.add(vec3(0, lift.mul(SCALE), 0))
  return m
}

const m4 = new THREE.Matrix4()
const pos = new THREE.Vector3()
const next = new THREE.Vector3()
const vel = new THREE.Vector3()
const q = new THREE.Quaternion()
const e = new THREE.Euler(0, 0, 0, 'YXZ')
const scale = new THREE.Vector3(SCALE, SCALE, SCALE)

function pathAt(f: Flock, a: number, slot: number, out: THREE.Vector3) {
  const lane = slot * 1.7
  out.set(
    f.centre[0] + Math.cos(a) * (f.radius[0] + lane * 0.4),
    f.height + Math.sin(a * 2 + slot) * 2.2 + slot * 0.6,
    f.centre[2] + Math.sin(a) * (f.radius[1] - lane * 0.3) + Math.sin(a * 2) * f.radius[1] * f.eight,
  )
  return out
}

export function Birds() {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(buildGull(), createGullMaterial(), TOTAL)
    im.frustumCulled = false
    im.castShadow = true
    return im
  }, [])
  const clock = useMemo(() => ({ t: 0 }), [])

  useFrame((_, dt) => {
    clock.t += Math.min(dt, 0.1) * (useSettingsStore.getState().reducedMotion ? 0.4 : 1)
    let i = 0
    for (const f of FLOCKS) {
      for (let k = 0; k < f.count; k++) {
        const a = clock.t * f.speed + f.phase - k * 0.07 * Math.sign(f.speed)
        pathAt(f, a, k, pos)
        pathAt(f, a + 0.02 * Math.sign(f.speed || 1), k, next)
        vel.subVectors(next, pos)
        const yaw = Math.atan2(vel.x, vel.z)
        const pitch = -Math.atan2(vel.y, Math.hypot(vel.x, vel.z))
        // Bank into the turn: the path curves towards its centre.
        const turn = Math.sign(f.speed) * 0.35 + Math.sin(a * 2) * f.eight * 0.6
        q.setFromEuler(e.set(pitch, yaw, -turn))
        mesh.setMatrixAt(i++, m4.compose(pos, q, scale))
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
