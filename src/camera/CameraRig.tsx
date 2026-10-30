import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { clamp, damp, easeInOutCubic, lerp, smoothstep } from '../lib/math'
import { trainRuntime } from '../rail/trainRuntime'
import { TRAIN_LENGTH } from '../rail/Train'
import { RIDE } from '../rail/RideController'
import { GATE_HEIGHT } from '../rail/WarpGates'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { FRAME } from '../core/frameOrder'

const UP = new THREE.Vector3(0, 1, 0)
const desiredPos = new THREE.Vector3()
const desiredTarget = new THREE.Vector3()
const trainPos = new THREE.Vector3()
const tangent = new THREE.Vector3()
const outward = new THREE.Vector3()
const side = new THREE.Vector3()
const chasePos = new THREE.Vector3()
const chaseTarget = new THREE.Vector3()
const stationPos = new THREE.Vector3()
const stationTarget = new THREE.Vector3()
const gatePos = new THREE.Vector3()

function applyViewOffset(camera: THREE.PerspectiveCamera, w: number, h: number, ox: number, oy: number) {
  const ax = Math.abs(ox)
  const ay = Math.abs(oy)
  const fw = w + 2 * ax
  const fh = h + 2 * ay
  camera.aspect = fw / fh
  camera.setViewOffset(fw, fh, ax - ox, ay - oy, w, h)
}

/** Portrait screens get a wider lens and pull every shot back, so the train stays in frame. */
function lensFor(aspect: number) {
  const t = smoothstep(1.1, 0.45, aspect)
  return { fov: lerp(38, 58, t), pullBack: lerp(1, 1.35, t) }
}

/** Chase shot behind and beside the train. */
function chase(out: THREE.Vector3, outTarget: THREE.Vector3, sway: number, pullBack: number) {
  out
    .copy(trainPos)
    .addScaledVector(tangent, -15 * pullBack)
    .addScaledVector(outward, (7 + sway) * pullBack)
    .addScaledVector(UP, 7.5 * pullBack)
  outTarget.copy(trainPos).addScaledVector(tangent, 6).addScaledVector(UP, 1.2)
}

/**
 * Owns the visitor camera. Each frame it picks a shot for the current ride
 * state and eases towards it, so every cut is a smooth blend.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const target = useRef(new THREE.Vector3())
  const initialised = useRef(false)
  const swayTime = useRef(0)
  const offset = useRef({ x: 0, y: 0 })
  const warpStart = useRef<number | null>(null)

  useFrame((state, rawDt) => {
    const world = useWorldStore.getState().world
    const derived = useWorldStore.getState().derived
    if (!world || !derived) return
    const dt = Math.min(rawDt, 1 / 20)
    const ride = useRideStore.getState()
    const reduced = useSettingsStore.getState().reducedMotion
    const { track, heightfield, stations } = derived
    const { width: w, height: h } = state.size
    const lens = lensFor(w / h)
    let lambda = 2.5

    track.getPointAt(trainRuntime.distance - TRAIN_LENGTH * 0.35, trainPos)
    track.getTangentAt(trainRuntime.distance, tangent).setY(0).normalize()
    outward.set(trainPos.x, 0, trainPos.z).normalize()
    swayTime.current += dt
    const sway = reduced ? 0 : Math.sin(swayTime.current * 0.4) * 2.5

    const moving = ride.state === 'DEPARTING' || ride.state === 'RIDING' || ride.state === 'ARRIVING' || ride.state === 'FAST_TRAVEL'
    const warp = track.warp
    const sinceEntry = warp ? track.ahead(warp.end, trainRuntime.distance) : Infinity
    const emerging = !!warp && moving && !ride.inWarp && sinceEntry < TRAIN_LENGTH + 10

    if (!ride.inWarp) warpStart.current = null

    const stationShot = (id: string | null) => {
      const s = stations.find((st) => st.def.id === id)
      if (!s) return null
      stationTarget.fromArray(s.camera.target)
      stationPos.fromArray(s.camera.position).sub(stationTarget).multiplyScalar(lens.pullBack).add(stationTarget)
      return s
    }

    if (ride.state === 'INTRO') {
      const angle = reduced ? 0 : state.clock.elapsedTime * 0.035
      desiredTarget.fromArray(world.overview.target)
      desiredPos.fromArray(world.overview.position).sub(desiredTarget).multiplyScalar(lens.pullBack).add(desiredTarget).applyAxisAngle(UP, angle)
      lambda = 1.2
    } else if (ride.inWarp && warp && moving) {
      // Through the gates: pull out, sweep around the island, settle beside the entry gate.
      track.getPointAt(warp.end, gatePos).addScaledVector(UP, GATE_HEIGHT)
      const thetaEnd = Math.atan2(gatePos.x, gatePos.z) - 0.4
      if (warpStart.current === null) warpStart.current = Math.atan2(camera.position.x, camera.position.z)
      let delta = (((thetaEnd - warpStart.current) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (delta < Math.PI * 0.8) delta += Math.PI * 2
      const p = clamp(track.ahead(warp.start, trainRuntime.distance) / warp.length)
      const theta = warpStart.current + delta * easeInOutCubic(p)
      const out = smoothstep(0, 0.22, p) * (1 - smoothstep(0.62, 1, p))
      const radius = lerp(80, 165, out) * lens.pullBack
      const height = lerp(30, 100, out) * lens.pullBack
      desiredPos.set(Math.sin(theta) * radius, height, Math.cos(theta) * radius)
      desiredTarget.set(0, 8, 0).lerp(gatePos, smoothstep(0.55, 1, p))
      lambda = 2.2
    } else if (emerging) {
      // Hold beside the entry gate and watch the train come out.
      track.getPointAt(warp!.end, gatePos).addScaledVector(UP, GATE_HEIGHT)
      const theta = Math.atan2(gatePos.x, gatePos.z) - 0.4
      desiredPos.set(Math.sin(theta) * 80 * lens.pullBack, 30 * lens.pullBack, Math.cos(theta) * 80 * lens.pullBack)
      desiredTarget.copy(trainPos).lerp(gatePos, 0.3)
      lambda = 2
    } else if (ride.state === 'IDLE_AT_STATION' && stationShot(ride.currentStation)) {
      desiredPos.copy(stationPos)
      desiredTarget.copy(stationTarget)
      // gentle parallax from the pointer
      side.crossVectors(UP, desiredTarget.clone().sub(desiredPos)).normalize()
      desiredPos.addScaledVector(side, -state.pointer.x * 1.6).addScaledVector(UP, state.pointer.y * 0.8)
      lambda = 1.8
    } else if (ride.state === 'ARRIVING' && stationShot(ride.targetStation)) {
      // Follow the train in, easing into the station shot only as it comes to rest.
      const target = stations.find((s) => s.def.id === ride.targetStation)!
      const remaining = track.ahead(trainRuntime.distance, target.distance)
      const k = easeInOutCubic(smoothstep(RIDE.arrivingDistance, 2, remaining))
      chase(chasePos, chaseTarget, sway, lens.pullBack)
      desiredPos.copy(chasePos).lerp(stationPos, k)
      desiredTarget.copy(chaseTarget).lerp(stationTarget, k)
      lambda = 2.4
    } else if (ride.state === 'FAST_TRAVEL') {
      desiredPos
        .copy(trainPos)
        .addScaledVector(outward, 30 * lens.pullBack)
        .addScaledVector(UP, 24 * lens.pullBack)
        .addScaledVector(tangent, -10)
      desiredTarget.copy(trainPos)
      lambda = 1.6
    } else {
      chase(desiredPos, desiredTarget, sway, lens.pullBack)
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

    if (Math.abs(camera.fov - lens.fov) > 0.01) {
      camera.fov += (lens.fov - camera.fov) * damp(4, dt)
    }

    // Shift the projection so the subject sits in the part of the screen not covered by UI.
    const desktop = w > 720
    let dx = 0
    let dy = 0
    if (ride.state === 'INTRO') {
      if (desktop) dx = Math.min(620, w * 0.46) / 2
      else dy = -h * 0.16
    } else if (ride.state === 'IDLE_AT_STATION' && ride.overlayOpen) {
      if (desktop) dx = -(Math.min(480, w - 32) + 16) / 2
      else dy = -h * 0.26
    }
    const ko = damp(3, dt)
    offset.current.x += (dx - offset.current.x) * ko
    offset.current.y += (dy - offset.current.y) * ko
    applyViewOffset(camera, w, h, offset.current.x, offset.current.y)
  }, FRAME.camera)

  return null
}
