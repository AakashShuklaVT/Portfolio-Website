import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { atan, color, cos, float, hash, instanceIndex, length, mix, positionLocal, sin, smoothstep, time, uniform, uv, vec3 } from 'three/tsl'
import { useWorldStore } from '../store/useWorldStore'
import { Kit } from '../lib/kit'
import { kitMaterials } from '../materials/kitMaterials'
import { frameAt } from './trackGeometry'
import { warpRuntime, warpUniforms } from './warp'

const RING = 3.55
const DISC = 3.18
/** Gate centre above the rail. */
export const GATE_HEIGHT = 2.35
const SPARKS = 40

const flash = uniform(0)

function buildGateKit() {
  const kit = new Kit(55)
  const blocks = 18
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2
    const x = Math.cos(a) * RING
    const y = Math.sin(a) * RING
    if (y < -GATE_HEIGHT + 0.2) continue // buried below the rail bed
    kit.box([0.95, 0.72, 0.9], i % 2 ? '#d8cbb6' : '#c7b79e', [x, y, 0], [0, 0, a + Math.PI / 2])
    if (i % 3 === 0) kit.box([0.34, 0.34, 0.06], '#59f0e2', [x * 1.0, y * 1.0, 0.47], [0, 0, a], 'glow')
    if (i % 3 === 0) kit.box([0.34, 0.34, 0.06], '#59f0e2', [x * 1.0, y * 1.0, -0.47], [0, 0, a], 'glow')
  }
  // gold inner rim
  kit.add(new THREE.TorusGeometry(DISC + 0.06, 0.09, 6, 48), '#e0b252', {}, 'metal')
  // keystone with a little crown
  kit.box([1.2, 1.0, 1.1], '#e8dcc6', [0, RING + 0.1, 0])
  kit.add(new THREE.OctahedronGeometry(0.32, 0), '#59f0e2', { position: [0, RING + 0.95, 0], scale: [1, 1.4, 1] }, 'glow')
  // stepped plinths either side
  for (const sx of [-1, 1]) {
    kit.box([1.6, 0.7, 1.7], '#b5a38b', [sx * 3.55, -GATE_HEIGHT + 0.2, 0])
    kit.box([1.2, 0.5, 1.35], '#c7b79e', [sx * 3.55, -GATE_HEIGHT + 0.75, 0])
  }
  return kit.build()
}

function createDiscMaterial() {
  const c = uv().sub(0.5).mul(2)
  const r = length(c)
  const ang = atan(c.y, c.x)
  const s1 = sin(ang.mul(3).add(r.mul(9)).sub(time.mul(2.4))).mul(0.5).add(0.5)
  const s2 = sin(ang.mul(5).sub(r.mul(15)).add(time.mul(1.7))).mul(0.5).add(0.5)
  const swirl = s1.mul(0.65).add(s2.mul(0.35))
  const deep = color('#251150')
  const mid = color('#37c9c4')
  const violet = color('#8b5cf6')
  const hot = color('#fff4d6')
  let col = mix(deep, mix(violet, mid, s2), swirl.mul(smoothstep(0.05, 0.95, r)))
  col = mix(col, hot, smoothstep(0.45, 0.0, r).mul(0.85))
  col = mix(col, mid.mul(1.4), smoothstep(0.82, 1.0, r))
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
  m.colorNode = col.mul(float(1).add(flash.mul(1.6)))
  return m
}

function createHaloMaterial() {
  const c = uv().sub(0.5).mul(2)
  const r = length(c)
  const ring = smoothstep(1.0, 0.62, r).mul(smoothstep(0.5, 0.6, r))
  const pulse = sin(time.mul(2.2)).mul(0.15).add(0.85)
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  m.colorNode = color('#53e0d6')
  m.opacityNode = ring.mul(pulse).mul(float(0.55).add(flash.mul(1.2)))
  return m
}

/** Sparks orbiting the ring, positioned entirely on the GPU from the instance index. */
function createSparkMaterial() {
  const i = float(instanceIndex)
  const seed = hash(i)
  const speed = hash(i.add(7)).mul(0.6).add(0.25)
  const a = seed.mul(Math.PI * 2).add(time.mul(speed))
  const radius = float(RING).add(sin(time.mul(1.3).add(i)).mul(0.35))
  const z = sin(time.mul(0.9).add(seed.mul(20))).mul(0.6)
  const m = new THREE.MeshBasicNodeMaterial()
  m.positionNode = positionLocal.add(vec3(cos(a).mul(radius), sin(a).mul(radius), z))
  m.colorNode = mix(color('#fff4d6'), color('#59f0e2'), hash(i.add(3)))
  return m
}

const discGeometry = new THREE.CircleGeometry(DISC, 48)
const haloGeometry = new THREE.PlaneGeometry(DISC * 3.2, DISC * 3.2)
const sparkGeometry = new THREE.OctahedronGeometry(0.07, 0)

/** The two portal gates: the train leaves the summit through one and comes back out of the other. */
export function WarpGates() {
  const track = useWorldStore((s) => s.derived?.track)
  const kit = useMemo(buildGateKit, [])
  const disc = useMemo(createDiscMaterial, [])
  const halo = useMemo(createHaloMaterial, [])
  const sparks = useMemo(() => {
    const material = createSparkMaterial()
    return [0, 1].map(() => {
      const mesh = new THREE.Mesh(sparkGeometry, material)
      mesh.count = SPARKS
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
          <primitive object={sparks[i]} />
        </group>
      ))}
    </group>
  )
}
