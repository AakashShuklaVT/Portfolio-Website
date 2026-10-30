import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useWorldStore } from '../store/useWorldStore'
import { trainRuntime } from './trainRuntime'
import { CAR_GAP, COACH_LENGTH, Coach, ENGINE_LENGTH, Locomotive, WHEEL_RADIUS, trainMaterials } from './TrainModels'
import { nightRuntime } from '../world/timeOfDay'

const COACHES = 3
/** Bogies sit this far in from each end of a car. */
const BOGIE_INSET = 0.9

export interface CarLayout {
  /** Distance of the car centre behind the engine front. */
  centreOffset: number
  length: number
}

export const CAR_LAYOUT: CarLayout[] = (() => {
  const cars: CarLayout[] = [{ centreOffset: ENGINE_LENGTH / 2, length: ENGINE_LENGTH }]
  let back = ENGINE_LENGTH
  for (let i = 0; i < COACHES; i++) {
    cars.push({ centreOffset: back + CAR_GAP + COACH_LENGTH / 2, length: COACH_LENGTH })
    back += CAR_GAP + COACH_LENGTH
  }
  return cars
})()

export const TRAIN_LENGTH = CAR_LAYOUT[CAR_LAYOUT.length - 1].centreOffset + COACH_LENGTH / 2

const front = new THREE.Vector3()
const rear = new THREE.Vector3()
const CHIMNEY_TOP = new THREE.Vector3(0, 3.3, 1.85)

export function Train() {
  const track = useWorldStore((s) => s.derived?.track)
  const carRefs = useRef<(THREE.Group | null)[]>([])
  const wheels = useRef(new Set<THREE.Mesh>())
  const wheelRef = useMemo(() => (m: THREE.Mesh | null) => m && wheels.current.add(m), [])

  useFrame(() => {
    if (!track) return
    const d = trainRuntime.distance
    CAR_LAYOUT.forEach((car, i) => {
      const group = carRefs.current[i]
      if (!group) return
      const half = car.length / 2 - BOGIE_INSET
      track.getPointAt(d - car.centreOffset + half, front)
      track.getPointAt(d - car.centreOffset - half, rear)
      group.position.addVectors(front, rear).multiplyScalar(0.5)
      group.lookAt(front)
    })
    const engine = carRefs.current[0]
    if (engine) {
      engine.updateMatrixWorld()
      trainRuntime.chimney.copy(CHIMNEY_TOP).applyMatrix4(engine.matrixWorld)
    }
    trainMaterials.window.emissiveIntensity = nightRuntime.factor * 1.4
    const angle = trainRuntime.wheelAngle
    wheels.current.forEach((w) => (w.rotation.x = (angle * WHEEL_RADIUS) / w.userData.radius))
  })

  if (!track) return null
  return (
    <group name="train">
      <Locomotive ref={(g) => void (carRefs.current[0] = g)} wheelRef={wheelRef} />
      {CAR_LAYOUT.slice(1).map((_, i) => (
        <Coach key={i} variant={i} ref={(g) => void (carRefs.current[i + 1] = g)} wheelRef={wheelRef} />
      ))}
    </group>
  )
}
