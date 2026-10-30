import { forwardRef, type Ref } from 'react'
import * as THREE from 'three/webgpu'

// Procedural low-poly rolling stock. Each car's origin sits on the rail at
// its centre, facing +z.

export const ENGINE_LENGTH = 5
export const COACH_LENGTH = 4.4
export const CAR_GAP = 0.55
export const WHEEL_RADIUS = 0.38

const mat = (color: string, extra: Partial<THREE.MeshStandardNodeMaterialParameters> = {}) =>
  new THREE.MeshStandardNodeMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...extra })

export const trainMaterials = {
  red: mat('#c9473a'),
  dark: mat('#3a3230', { roughness: 0.6, metalness: 0.3 }),
  gold: mat('#e6b54f', { roughness: 0.35, metalness: 0.6 }),
  cream: mat('#f2e3c6'),
  teal: mat('#2f8f83'),
  mustard: mat('#e2a93b'),
  window: mat('#2b3640', { roughness: 0.2, metalness: 0.2 }),
  lamp: new THREE.MeshBasicNodeMaterial({ color: '#fff3c4' }),
  wheel: mat('#5b3b33', { roughness: 0.5, metalness: 0.4 }),
}

const g = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.CylinderGeometry(1, 0.7, 1, 10),
  wheel: new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.16, 10).rotateZ(Math.PI / 2),
  bigWheel: new THREE.CylinderGeometry(0.5, 0.5, 0.16, 12).rotateZ(Math.PI / 2),
  sphere: new THREE.SphereGeometry(1, 8, 6),
}

interface WheelProps {
  /** Wheel meshes register here so the train can spin them. */
  wheelRef: (m: THREE.Mesh | null) => void
}

function WheelPair({ z, big = false, wheelRef }: WheelProps & { z: number; big?: boolean }) {
  const geometry = big ? g.bigWheel : g.wheel
  const y = big ? 0.5 : WHEEL_RADIUS
  return (
    <>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} ref={wheelRef} geometry={geometry} material={trainMaterials.wheel} position={[x, y + 0.2, z]} userData={{ radius: y }} castShadow />
      ))}
    </>
  )
}

export const Locomotive = forwardRef(function Locomotive({ wheelRef }: WheelProps, ref: Ref<THREE.Group>) {
  return (
    <group ref={ref}>
      {/* chassis */}
      <mesh geometry={g.box} material={trainMaterials.dark} position={[0, 0.85, 0]} scale={[1.7, 0.35, 5]} castShadow />
      {/* boiler */}
      <mesh geometry={g.cyl} material={trainMaterials.red} position={[0, 1.65, 0.55]} rotation-x={Math.PI / 2} scale={[0.72, 3, 0.72]} castShadow />
      <mesh geometry={g.cyl} material={trainMaterials.gold} position={[0, 1.65, 1.0]} rotation-x={Math.PI / 2} scale={[0.75, 0.12, 0.75]} />
      <mesh geometry={g.cyl} material={trainMaterials.gold} position={[0, 1.65, 0.0]} rotation-x={Math.PI / 2} scale={[0.75, 0.12, 0.75]} />
      {/* smokebox */}
      <mesh geometry={g.cyl} material={trainMaterials.dark} position={[0, 1.65, 2.15]} rotation-x={Math.PI / 2} scale={[0.76, 0.35, 0.76]} castShadow />
      {/* chimney */}
      <mesh geometry={g.cone} material={trainMaterials.dark} position={[0, 2.75, 1.85]} scale={[0.3, 0.9, 0.3]} castShadow />
      {/* dome */}
      <mesh geometry={g.sphere} material={trainMaterials.gold} position={[0, 2.35, 0.55]} scale={[0.32, 0.3, 0.32]} />
      {/* cab */}
      <mesh geometry={g.box} material={trainMaterials.red} position={[0, 1.95, -1.55]} scale={[1.8, 1.9, 1.7]} castShadow />
      <mesh geometry={g.box} material={trainMaterials.dark} position={[0, 2.98, -1.5]} scale={[2.05, 0.16, 2.0]} castShadow />
      <mesh geometry={g.box} material={trainMaterials.window} position={[0, 2.3, -1.55]} scale={[1.84, 0.6, 1.0]} />
      <mesh geometry={g.box} material={trainMaterials.cream} position={[0, 1.3, -1.55]} scale={[1.84, 0.14, 1.74]} />
      {/* cow catcher and lamp */}
      <mesh geometry={g.box} material={trainMaterials.mustard} position={[0, 0.6, 2.6]} rotation-x={-0.6} scale={[1.6, 0.18, 0.7]} castShadow />
      <mesh geometry={g.sphere} material={trainMaterials.lamp} position={[0, 2.05, 2.36]} scale={0.17} />
      <WheelPair z={1.6} wheelRef={wheelRef} />
      <WheelPair z={0.1} big wheelRef={wheelRef} />
      <WheelPair z={-1.3} big wheelRef={wheelRef} />
    </group>
  )
})

const COACH_COLORS = [trainMaterials.teal, trainMaterials.mustard, trainMaterials.teal]

export const Coach = forwardRef(function Coach({ wheelRef, variant = 0 }: WheelProps & { variant?: number }, ref: Ref<THREE.Group>) {
  const body = COACH_COLORS[variant % COACH_COLORS.length]
  return (
    <group ref={ref}>
      <mesh geometry={g.box} material={trainMaterials.dark} position={[0, 0.8, 0]} scale={[1.6, 0.3, 4.2]} castShadow />
      <mesh geometry={g.box} material={body} position={[0, 1.55, 0]} scale={[1.8, 1.25, 4.3]} castShadow />
      <mesh geometry={g.box} material={trainMaterials.cream} position={[0, 2.3, 0]} scale={[1.84, 0.28, 4.32]} />
      <mesh geometry={g.box} material={trainMaterials.window} position={[0, 2.2, 0]} scale={[1.86, 0.38, 3.6]} />
      <mesh geometry={g.box} material={trainMaterials.cream} position={[0, 2.62, 0]} scale={[1.95, 0.18, 4.5]} castShadow />
      <mesh geometry={g.box} material={trainMaterials.cream} position={[0, 2.78, 0]} scale={[1.4, 0.16, 4.3]} />
      <WheelPair z={1.4} wheelRef={wheelRef} />
      <WheelPair z={-1.4} wheelRef={wheelRef} />
    </group>
  )
})
