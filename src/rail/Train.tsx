import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useWorldStore } from '../store/useWorldStore'
import { trainRuntime } from './trainRuntime'
import {
  CAR_GAP,
  CHIMNEY_TOP,
  CRANK,
  CYLINDER,
  DRIVER_RADIUS,
  ENGINE,
  TENDER,
  axleHeight,
  coachSpec,
  getAxleGeometry,
  getTrainGeometry,
  trainMaterials,
  trainPlainMaterials,
  type CarSpec,
} from './TrainModels'
import { FRAME } from '../core/frameOrder'

const CARS: CarSpec[] = [ENGINE, TENDER, coachSpec(0), coachSpec(1), coachSpec(2)]

export interface CarLayout {
  spec: CarSpec
  /** Distance of the car centre behind the front of the engine. */
  centreOffset: number
  length: number
}

export const CAR_LAYOUT: CarLayout[] = (() => {
  let back = 0
  return CARS.map((spec) => {
    const car = { spec, centreOffset: back + spec.length / 2, length: spec.length }
    back += spec.length + CAR_GAP
    return car
  })
})()

export const TRAIN_LENGTH = CAR_LAYOUT[CAR_LAYOUT.length - 1].centreOffset + CAR_LAYOUT[CAR_LAYOUT.length - 1].length / 2

const BUFFER_Y = 0.88
const front = new THREE.Vector3()
const rear = new THREE.Vector3()
const a = new THREE.Vector3()
const b = new THREE.Vector3()
const dir = new THREE.Vector3()
const q = new THREE.Quaternion()
const m = new THREE.Matrix4()
const s = new THREE.Vector3()
const Z = new THREE.Vector3(0, 0, 1)
const CYL_LOCAL = [new THREE.Vector3(-CYLINDER.x, CYLINDER.y - 0.2, CYLINDER.z + 0.45), new THREE.Vector3(CYLINDER.x, CYLINDER.y - 0.2, CYLINDER.z + 0.45)]

const linkGeometry = new THREE.BoxGeometry(0.12, 0.12, 1)
const bellowsGeometry = new THREE.BoxGeometry(1.08, 1.6, 1)
const plateGeometry = new THREE.BoxGeometry(1.3, 0.05, 1)

function CarMeshes({ index }: { index: number }) {
  const geo = getTrainGeometry()
  const spec = CAR_LAYOUT[index].spec
  const layers = spec.kind === 'engine' ? geo.engine : spec.kind === 'tender' ? geo.tender : geo.coaches[spec.variant ?? 0]
  return (
    <>
      {layers.base && <mesh geometry={layers.base} material={trainMaterials.base} castShadow receiveShadow />}
      {layers.metal && <mesh geometry={layers.metal} material={trainMaterials.metal} />}
      {layers.glow && <mesh geometry={layers.glow} material={trainMaterials.glow} />}
    </>
  )
}

/** The engine's moving parts: coupling rods, connecting rods and piston rods on both sides. */
function Motion({ refs }: { refs: React.MutableRefObject<THREE.Object3D[]> }) {
  const geo = getTrainGeometry()
  const register = (i: number) => (o: THREE.Object3D | null) => void (o && (refs.current[i] = o))
  return (
    <>
      {[0, 1].map((side) => (
        <group key={side}>
          <mesh ref={register(side * 3)} geometry={geo.couplingRod} material={trainMaterials.base} />
          <mesh ref={register(side * 3 + 1)} geometry={geo.connectingRod} material={trainMaterials.base} />
          <mesh ref={register(side * 3 + 2)} geometry={geo.pistonRod} material={trainPlainMaterials.steel} />
        </group>
      ))}
    </>
  )
}

export function Train() {
  const track = useWorldStore((st) => st.derived?.track)
  const carRefs = useRef<(THREE.Group | null)[]>([])
  const axleRefs = useRef<{ mesh: THREE.Mesh; radius: number }[]>([])
  const motionRefs = useRef<THREE.Object3D[]>([])
  const gaps = CAR_LAYOUT.length - 1
  const links = useMemo(() => {
    const im = new THREE.InstancedMesh(linkGeometry, trainPlainMaterials.iron, gaps)
    im.frustumCulled = false
    return im
  }, [gaps])
  const bellowsGaps = useMemo(() => CAR_LAYOUT.slice(1).map((_, i) => i).filter((i) => CAR_LAYOUT[i].spec.kind === 'coach'), [])
  const bellows = useMemo(() => {
    const im = new THREE.InstancedMesh(bellowsGeometry, trainPlainMaterials.bellows, Math.max(1, bellowsGaps.length))
    im.frustumCulled = false
    return im
  }, [bellowsGaps])
  const plate = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!track) return
    const d = trainRuntime.distance
    CAR_LAYOUT.forEach((car, i) => {
      const group = carRefs.current[i]
      if (!group) return
      const dc = d - car.centreOffset
      const half = car.length / 2 - car.spec.bogieInset
      track.getPointAt(dc + half, front)
      track.getPointAt(dc - half, rear)
      group.position.addVectors(front, rear).multiplyScalar(0.5)
      group.lookAt(front)
      // Cars that are wholly between the gates are not drawn at all.
      group.visible = !(track.inWarp(dc + car.length / 2) && track.inWarp(dc - car.length / 2))
      group.updateMatrixWorld()
    })

    // Wheels: each axle turns by the distance rolled over its own radius.
    const rolled = trainRuntime.travelled
    for (const { mesh, radius } of axleRefs.current) mesh.rotation.x = rolled / radius

    // Rods: the right side leads the left by a quarter turn.
    const crank = rolled / DRIVER_RADIUS
    const [d1, d2] = [ENGINE.axles[1], ENGINE.axles[2]]
    const ay = axleHeight(DRIVER_RADIUS)
    for (let side = 0; side < 2; side++) {
      const sx = side ? 1 : -1
      const phase = crank + (side ? Math.PI / 2 : 0)
      const py = ay + Math.cos(phase) * CRANK
      const pz = Math.sin(phase) * CRANK
      const coupling = motionRefs.current[side * 3]
      const conn = motionRefs.current[side * 3 + 1]
      const piston = motionRefs.current[side * 3 + 2]
      coupling?.position.set(sx * 0.8, py, (d1.z + d2.z) / 2 + pz)
      // connecting rod from the front crank pin to the crosshead on the cylinder line
      const pinZ = d1.z + pz
      const dy = CYLINDER.y - py
      const crossZ = pinZ + Math.sqrt(Math.max(0, CYLINDER.rodLength ** 2 - dy * dy))
      if (conn) {
        conn.position.set(sx * 0.9, (py + CYLINDER.y) / 2, (pinZ + crossZ) / 2)
        conn.rotation.x = Math.atan2(-dy, crossZ - pinZ)
      }
      if (piston) {
        piston.position.set(sx * 0.9, CYLINDER.y, crossZ)
        piston.scale.z = Math.max(0.01, CYLINDER.z - 0.4 - crossZ)
      }
    }

    // Couplings stretch between the actual car ends, so they follow every curve.
    for (let i = 0; i < gaps; i++) {
      const ca = carRefs.current[i]
      const cb = carRefs.current[i + 1]
      if (!ca || !cb) continue
      ca.localToWorld(a.set(0, BUFFER_Y, -CAR_LAYOUT[i].length / 2 - 0.05))
      cb.localToWorld(b.set(0, BUFFER_Y, CAR_LAYOUT[i + 1].length / 2 + 0.05))
      const len = dir.subVectors(b, a).length()
      q.setFromUnitVectors(Z, dir.divideScalar(len || 1))
      const hidden = !ca.visible && !cb.visible
      links.setMatrixAt(i, m.compose(a.add(b).multiplyScalar(0.5), q, s.set(1, 1, hidden ? 0 : len)))
      if (i === 0 && plate.current) {
        plate.current.position.copy(a).y += 0.27
        plate.current.quaternion.copy(q)
        plate.current.scale.z = len + 0.4
        plate.current.visible = !hidden
      }
      const bi = bellowsGaps.indexOf(i)
      if (bi >= 0) {
        ca.localToWorld(a.set(0, 1.75, -CAR_LAYOUT[i].length / 2))
        cb.localToWorld(b.set(0, 1.75, CAR_LAYOUT[i + 1].length / 2))
        const bl = dir.subVectors(b, a).length()
        q.setFromUnitVectors(Z, dir.divideScalar(bl || 1))
        bellows.setMatrixAt(bi, m.compose(a.add(b).multiplyScalar(0.5), q, s.set(1, 1, hidden ? 0 : bl + 0.1)))
      }
    }
    links.instanceMatrix.needsUpdate = true
    bellows.instanceMatrix.needsUpdate = true

    const engine = carRefs.current[0]
    if (engine) {
      trainRuntime.chimney.copy(CHIMNEY_TOP).applyMatrix4(engine.matrixWorld)
      trainRuntime.chimneyVisible = !track.inWarp(d - CAR_LAYOUT[0].centreOffset + CHIMNEY_TOP.z)
      CYL_LOCAL.forEach((p, i) => trainRuntime.cylinders[i].copy(p).applyMatrix4(engine.matrixWorld))
      trainRuntime.forward.set(0, 0, 1).transformDirection(engine.matrixWorld)
    }
  }, FRAME.train)

  if (!track) return null
  return (
    <group name="train">
      {CAR_LAYOUT.map((car, i) => (
        <group key={i} ref={(g) => void (carRefs.current[i] = g)}>
          <CarMeshes index={i} />
          {car.spec.axles.map((axle, k) => (
            <mesh
              key={k}
              ref={(mesh) => {
                if (!mesh) return
                const list = axleRefs.current
                if (!list.some((e) => e.mesh === mesh)) list.push({ mesh, radius: axle.radius })
              }}
              geometry={getAxleGeometry(axle.radius, axle.spoked)}
              material={trainMaterials.base}
              position={[0, axleHeight(axle.radius), axle.z]}
            />
          ))}
          {i === 0 && <Motion refs={motionRefs} />}
        </group>
      ))}
      <primitive object={links} />
      <primitive object={bellows} />
      <mesh ref={plate} geometry={plateGeometry} material={trainPlainMaterials.iron} />
    </group>
  )
}
