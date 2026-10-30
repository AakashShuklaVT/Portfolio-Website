import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { color, float, instancedDynamicBufferAttribute, length, mix, mx_noise_float, smoothstep, uniform, uv, vec3, vec4 } from 'three/tsl'
import { useAppStore } from '../store/useAppStore'
import { useRideStore } from '../store/useRideStore'
import { trainRuntime } from './trainRuntime'
import { nightRuntime } from '../world/timeOfDay'
import { DRIVER_RADIUS } from './TrainModels'

// Soft, noise-eroded billboard puffs, simulated on the CPU (a few hundred at
// most) and drawn in one instanced draw call, sorted back to front.
//   chimney: a chuff of smoke on every piston stroke, dark at first and
//            turning to white steam as it rises, drifts and spreads
//   drains:  white jets from the cylinder cocks when the engine pulls away

const STROKE = (Math.PI * 2 * DRIVER_RADIUS) / 4
const MAX_CHUFFS_PER_SECOND = 7
const WIND = new THREE.Vector3(0.55, 0, 0.25)

interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  age: number
  life: number
  size0: number
  size1: number
  seed: number
  alpha: number
  /** 0 = chimney smoke, 1 = white drain steam */
  kind: number
  depth: number
}

const night = uniform(0)
const tmp = new THREE.Vector3()
const left = new THREE.Vector3()
const byDepth = (a: Particle, b: Particle) => b.depth - a.depth

function createMaterial(posAttr: THREE.InstancedBufferAttribute, dataAttr: THREE.InstancedBufferAttribute) {
  // Typed as vec4 for TSL's swizzles (the typings only know the attribute as Node<string>).
  const a0 = instancedDynamicBufferAttribute(posAttr, 'vec4') as unknown as ReturnType<typeof vec4>
  const a1 = instancedDynamicBufferAttribute(dataAttr, 'vec4') as unknown as ReturnType<typeof vec4>
  const life = a1.x
  const seed = a1.y
  const alpha = a1.z
  const kind = a1.w

  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false })
  m.positionNode = a0.xyz
  m.scaleNode = a0.w
  m.rotationNode = seed.mul(6.283).add(life.mul(seed.sub(0.5)).mul(1.6))

  const p = uv().sub(0.5)
  const n = mx_noise_float(vec3(uv().mul(2.6).add(seed.mul(17)), life.mul(1.4).add(seed.mul(5))))
  const n2 = mx_noise_float(vec3(uv().mul(6).add(seed.mul(3)), life.mul(2.0)))
  const d = length(p).mul(2)
  const erosion = n.mul(0.32).add(n2.mul(0.12)).mul(float(0.5).add(life))
  const shape = smoothstep(1.0, 0.3, d.add(erosion))

  // Fake light from above: tops of puffs bright, undersides grey.
  const shade = mix(float(0.66), float(1.08), smoothstep(-0.45, 0.45, p.y.negate().add(n.mul(0.25))))
  const smoke = mix(color('#5d5652'), color('#f7f3ee'), smoothstep(0.02, 0.4, life))
  const base = mix(smoke, color('#ffffff'), kind)
  const lit = base.mul(shade).mul(mix(float(1), float(0.3), night))

  const fadeIn = smoothstep(0.0, 0.07, life)
  const fadeOut = float(1).sub(smoothstep(0.45, 1.0, life))
  m.colorNode = lit
  m.opacityNode = shape.mul(fadeIn).mul(fadeOut).mul(alpha)
  return m
}

/** Steam and smoke from the locomotive. */
export function Steam() {
  const scale = useAppStore((st) => st.quality?.particleScale ?? 1)
  const capacity = Math.max(60, Math.round(220 * scale))

  const { mesh, posAttr, dataAttr } = useMemo(() => {
    const posAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    const dataAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    dataAttr.setUsage(THREE.DynamicDrawUsage)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), createMaterial(posAttr, dataAttr))
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.renderOrder = 3
    return { mesh, posAttr, dataAttr }
  }, [capacity])

  const particles = useRef<Particle[]>([])
  const pool = useRef<Particle[]>([])
  const strokeAcc = useRef(0)
  const idleAcc = useRef(0)
  const drainAcc = useRef(0)
  const lastTravelled = useRef(trainRuntime.travelled)
  const chuffCooldown = useRef(0)
  const camPos = useRef(new THREE.Vector3())
  const sortBuffer = useRef<Particle[]>([])

  const spawn = (init: (p: Particle) => void) => {
    const list = particles.current
    if (list.length >= capacity) {
      const oldest = list.shift()!
      pool.current.push(oldest)
    }
    const p =
      pool.current.pop() ??
      ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size0: 1, size1: 1, seed: 0, alpha: 1, kind: 0, depth: 0 } as Particle)
    p.age = 0
    p.seed = Math.random()
    init(p)
    list.push(p)
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const rt = trainRuntime
    night.value = nightRuntime.factor
    const moved = Math.max(0, rt.travelled - lastTravelled.current)
    lastTravelled.current = rt.travelled
    const strength = Math.min(1, rt.speed / 9)
    chuffCooldown.current -= dt

    if (rt.chimneyVisible) {
      // One chuff per piston stroke, capped so fast running blends into a plume.
      strokeAcc.current += moved
      if (strokeAcc.current >= STROKE && chuffCooldown.current <= 0) {
        strokeAcc.current = 0
        chuffCooldown.current = 1 / MAX_CHUFFS_PER_SECOND
        const puffs = 2 + Math.round(strength * 2)
        for (let i = 0; i < puffs; i++) {
          spawn((p) => {
            p.pos.copy(rt.chimney).add(tmp.set((Math.random() - 0.5) * 0.25, Math.random() * 0.2, (Math.random() - 0.5) * 0.25))
            p.vel
              .set((Math.random() - 0.5) * 0.9, 3.4 + strength * 2.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.9)
              .addScaledVector(rt.forward, rt.speed * 0.35)
            p.life = 2.4 + Math.random() * 1.4
            p.size0 = 0.42 + Math.random() * 0.2
            p.size1 = 1.8 + Math.random() * 1.0 + strength * 0.6
            p.alpha = 0.82
            p.kind = 0
          })
        }
      }
      // A standing engine still breathes a lazy wisp.
      idleAcc.current += dt * (rt.speed < 0.5 ? 2.2 : 0)
      while (idleAcc.current >= 1) {
        idleAcc.current -= 1
        spawn((p) => {
          p.pos.copy(rt.chimney)
          p.vel.set((Math.random() - 0.5) * 0.3, 1.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3)
          p.life = 2.6 + Math.random()
          p.size0 = 0.3
          p.size1 = 1.5 + Math.random() * 0.5
          p.alpha = 0.55
          p.kind = 0
        })
      }
      // Drain cocks open while the engine gets going.
      const ride = useRideStore.getState()
      const pulling = ride.state === 'DEPARTING' || (ride.state === 'FAST_TRAVEL' && rt.stateTime < 1.5)
      drainAcc.current += dt * (pulling ? 26 : 0)
      // cross(forward, up) points to the engine's left (local -x), where cylinder 0 is
      const side = left.crossVectors(rt.forward, THREE.Object3D.DEFAULT_UP).normalize()
      while (drainAcc.current >= 1) {
        drainAcc.current -= 1
        const i = Math.random() < 0.5 ? 0 : 1
        const out = i === 0 ? 1 : -1
        spawn((p) => {
          p.pos.copy(rt.cylinders[i])
          p.vel
            .copy(side)
            .multiplyScalar(out * (3 + Math.random() * 1.5))
            .addScaledVector(rt.forward, 0.8 + rt.speed * 0.5)
            .add(tmp.set(0, -0.2 + Math.random() * 0.6, 0))
          p.life = 0.8 + Math.random() * 0.5
          p.size0 = 0.22
          p.size1 = 1.1 + Math.random() * 0.4
          p.alpha = 0.75
          p.kind = 1
        })
      }
    }

    // Integrate: drag towards the breeze, buoyancy for smoke, ease-out growth.
    const list = particles.current
    const drag = Math.exp(-1.9 * dt)
    camPos.current.copy(state.camera.position)
    let write = 0
    for (let i = 0; i < list.length; i++) {
      const p = list[i]
      p.age += dt
      if (p.age >= p.life) {
        pool.current.push(p)
        continue
      }
      p.vel.x = (p.vel.x - WIND.x) * drag + WIND.x
      p.vel.z = (p.vel.z - WIND.z) * drag + WIND.z
      p.vel.y = p.vel.y * Math.exp(-(p.kind ? 2.5 : 1.1) * dt) + (p.kind ? 0.5 : 0.25) * dt
      p.pos.addScaledVector(p.vel, dt)
      p.depth = p.pos.distanceToSquared(camPos.current)
      list[write++] = p
    }
    list.length = write
    // Back to front, so soft edges blend over the puffs behind them.
    const sorted = sortBuffer.current
    sorted.length = 0
    for (const p of list) sorted.push(p)
    sorted.sort(byDepth)
    const pa = posAttr.array as Float32Array
    const da = dataAttr.array as Float32Array
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]
      const t = p.age / p.life
      const grow = 1 - (1 - t) * (1 - t)
      pa[i * 4] = p.pos.x
      pa[i * 4 + 1] = p.pos.y
      pa[i * 4 + 2] = p.pos.z
      pa[i * 4 + 3] = p.size0 + (p.size1 - p.size0) * grow
      da[i * 4] = t
      da[i * 4 + 1] = p.seed
      da[i * 4 + 2] = p.alpha
      da[i * 4 + 3] = p.kind
    }
    mesh.count = sorted.length
    posAttr.needsUpdate = true
    dataAttr.needsUpdate = true
  })

  return <primitive object={mesh} />
}
