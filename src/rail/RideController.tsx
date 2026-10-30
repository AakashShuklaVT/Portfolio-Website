import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { trainRuntime } from './trainRuntime'
import { useEditorMode } from '../store/useEditorMode'
import { flags } from '../core/flags'
import { FRAME } from '../core/frameOrder'
import { warpRuntime } from './warp'

export const RIDE = {
  cruise: 9,
  accel: 2.6,
  brake: 2.2,
  fastCruise: 32,
  fastAccel: 9,
  fastBrake: 7,
  /** Seconds the hidden stretch between the portal gates takes. */
  warpSeconds: 5.5,
  /** Acceleration once the engine is through the exit gate (the gate pulls the train in). */
  warpAccel: 14,
  /** Remaining distance at which the camera starts framing the next station. */
  arrivingDistance: 30,
  departSeconds: 1.1,
}

const MOVING = new Set(['DEPARTING', 'RIDING', 'ARRIVING', 'FAST_TRAVEL'])

/** Drives the train along the track according to the ride state machine. */
export function RideController() {
  const stations = useWorldStore((s) => s.derived?.stations)

  // Park the train at the first station on load.
  useEffect(() => {
    if (stations?.length && useRideStore.getState().state === 'INTRO') trainRuntime.distance = stations[0].distance
  }, [stations])

  // Reset the per-state timer on every transition.
  useEffect(() => useRideStore.subscribe((s, prev) => s.state !== prev.state && (trainRuntime.stateTime = 0)), [])

  useFrame((_, rawDt) => {
    const derived = useWorldStore.getState().derived
    if (!derived) return
    const dt = Math.min(rawDt, 1 / 20)
    const rt = trainRuntime
    const ride = useRideStore.getState()
    const { track } = derived
    rt.stateTime += dt

    const inWarp = track.inWarp(rt.distance)
    if (inWarp !== ride.inWarp) {
      ride.setInWarp(inWarp)
      if (inWarp) warpRuntime.exitFlash = 1
      else if (rt.speed > 0) warpRuntime.entryFlash = 1
    }
    const warpCruise = track.warp ? track.warp.length / RIDE.warpSeconds : RIDE.cruise

    const advance = (step: number) => {
      rt.distance = track.wrap(rt.distance + step)
      rt.travelled += step
    }

    // Editor preview: loop the track at cruising speed, ignoring stations.
    if (flags.edit && useEditorMode.getState().mode === 'edit') {
      rt.speed = useEditorMode.getState().previewTrain ? (inWarp ? warpCruise : RIDE.cruise) : 0
      advance(rt.speed * dt)
      return
    }

    if (!MOVING.has(ride.state)) {
      rt.speed = 0
      // Waiting at the start: keep the train parked at the first station.
      if (ride.state === 'INTRO' && derived.stations.length) rt.distance = derived.stations[0].distance
      return
    }
    const target = derived.stations.find((s) => s.def.id === ride.targetStation)
    if (!target) return

    const fast = ride.state === 'FAST_TRAVEL'
    const cruise = inWarp ? Math.max(warpCruise, fast ? RIDE.fastCruise : 0) : fast ? RIDE.fastCruise : RIDE.cruise
    const accel = inWarp ? RIDE.warpAccel : fast ? RIDE.fastAccel : RIDE.accel
    const brake = fast ? RIDE.fastBrake : RIDE.brake

    const remaining = track.ahead(rt.distance, target.distance)
    const desired = Math.min(cruise, Math.sqrt(2 * brake * remaining))
    if (rt.speed < desired) rt.speed = Math.min(desired, rt.speed + accel * dt)
    else rt.speed = Math.max(desired, rt.speed - brake * 3 * dt)
    if (remaining > 0.02) rt.speed = Math.max(rt.speed, 0.3)

    const step = rt.speed * dt
    if (step >= remaining) {
      advance(remaining)
      rt.distance = target.distance
      rt.speed = 0
      ride.arrive(target.def.id)
      return
    }
    advance(step)

    if (ride.state === 'DEPARTING' && rt.stateTime > RIDE.departSeconds) ride.setState('RIDING')
    else if ((ride.state === 'RIDING' || fast) && !inWarp && remaining < RIDE.arrivingDistance) ride.setState('ARRIVING')
  }, FRAME.ride)

  return null
}
