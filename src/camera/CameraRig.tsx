import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { damp } from '../lib/math'
import { trainRuntime } from '../rail/trainRuntime'
import { TRAIN_LENGTH } from '../rail/Train'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { useSettingsStore } from '../store/useSettingsStore'

const UP = new THREE.Vector3(0, 1, 0)
const desiredPos = new THREE.Vector3()
const desiredTarget = new THREE.Vector3()
const trainPos = new THREE.Vector3()
const tangent = new THREE.Vector3()
const outward = new THREE.Vector3()
const side = new THREE.Vector3()

function applyViewOffset(camera: THREE.PerspectiveCamera, w: number, h: number, ox: number, oy: number) {
  const ax = Math.abs(ox)
  const ay = Math.abs(oy)
  const fw = w + 2 * ax
  const fh = h + 2 * ay
  camera.aspect = fw / fh
  camera.setViewOffset(fw, fh, ax - ox, ay - oy, w, h)
}

/**
 * Owns the visitor camera. Each frame it picks a shot for the current ride
 * state and eases towards it, so every cut is a smooth blend.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const target = useRef(new THREE.Vector3())
  const initialised = useRef(false)
  const swayTime = useRef(0)
  const offset = useRef({ x: 0, y: 0 })

  useFrame((state, rawDt) => {
    const world = useWorldStore.getState().world
    const derived = useWorldStore.getState().derived
    if (!world || !derived) return
    const dt = Math.min(rawDt, 1 / 20)
    const ride = useRideStore.getState()
    const reduced = useSettingsStore.getState().reducedMotion
    const { track, heightfield, stations } = derived
    let lambda = 2.5

    track.getPointAt(trainRuntime.distance - TRAIN_LENGTH * 0.35, trainPos)
    track.getTangentAt(trainRuntime.distance, tangent).setY(0).normalize()
    outward.set(trainPos.x, 0, trainPos.z).normalize()

    const station =
      ride.state === 'IDLE_AT_STATION'
        ? stations.find((s) => s.def.id === ride.currentStation)
        : ride.state === 'ARRIVING'
          ? stations.find((s) => s.def.id === ride.targetStation)
          : undefined

    if (ride.state === 'INTRO') {
      const angle = reduced ? 0 : state.clock.elapsedTime * 0.035
      desiredPos.fromArray(world.overview.position).applyAxisAngle(UP, angle)
      desiredTarget.fromArray(world.overview.target)
      lambda = 1.2
    } else if (station) {
      desiredPos.fromArray(station.camera.position)
      desiredTarget.fromArray(station.camera.target)
      // gentle parallax from the pointer
      side.crossVectors(UP, desiredTarget.clone().sub(desiredPos)).normalize()
      desiredPos.addScaledVector(side, -state.pointer.x * 1.6).addScaledVector(UP, state.pointer.y * 0.8)
      lambda = ride.state === 'ARRIVING' ? 1.4 : 1.8
    } else if (ride.inTunnel) {
      // Hold a wide shot of the mountain while the train is underground.
      desiredPos.copy(outward).multiplyScalar(85).addScaledVector(UP, 62)
      desiredTarget.set(trainPos.x * 0.35, 10, trainPos.z * 0.35)
      lambda = 0.9
    } else if (ride.state === 'FAST_TRAVEL') {
      desiredPos.copy(trainPos).addScaledVector(outward, 30).addScaledVector(UP, 24).addScaledVector(tangent, -10)
      desiredTarget.copy(trainPos)
      lambda = 1.6
    } else {
      swayTime.current += dt
      const sway = reduced ? 0 : Math.sin(swayTime.current * 0.4) * 2.5
      desiredPos
        .copy(trainPos)
        .addScaledVector(tangent, -15)
        .addScaledVector(outward, 7 + sway)
        .addScaledVector(UP, 7.5)
      desiredTarget.copy(trainPos).addScaledVector(tangent, 9).addScaledVector(UP, 1.2)
      lambda = 2.2
    }

    const ground = heightfield.heightAt(desiredPos.x, desiredPos.z)
    desiredPos.y = Math.max(desiredPos.y, ground + 3.5)

    if (!initialised.current) {
      camera.position.copy(desiredPos)
      target.current.copy(desiredTarget)
      initialised.current = true
    }
    const k = damp(reduced ? lambda * 2.5 : lambda, dt)
    camera.position.lerp(desiredPos, k)
    target.current.lerp(desiredTarget, k)
    camera.lookAt(target.current)

    // Shift the projection so the subject sits in the part of the screen not covered by UI.
    const { width: w, height: h } = state.size
    const desktop = w > 720
    let dx = 0
    let dy = 0
    if (ride.state === 'INTRO') {
      if (desktop) dx = Math.min(560, w * 0.45) / 2
      else dy = -h * 0.2
    } else if (ride.state === 'IDLE_AT_STATION' && ride.overlayOpen) {
      if (desktop) dx = -(Math.min(460, w - 32) + 16) / 2
      else dy = -h * 0.28
    }
    const ko = damp(3, dt)
    offset.current.x += (dx - offset.current.x) * ko
    offset.current.y += (dy - offset.current.y) * ko
    applyViewOffset(camera as THREE.PerspectiveCamera, w, h, offset.current.x, offset.current.y)
  })

  return null
}
