import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'
import { trainRuntime } from './trainRuntime'
import { TUNNEL } from './TrackPath'
import { TRAIN_LENGTH } from './Train'
import { WHEEL_RADIUS } from './TrainModels'

export const RIDE = {
  cruise: 9,
  accel: 2.6,
  brake: 2.2,
  tunnelBoost: 2.2,
  fastCruise: 32,
  fastAccel: 9,
  fastBrake: 7,
  /** Remaining distance at which the camera starts framing the next station. */
  arrivingDistance: 26,
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

    const inTunnel = track.kindAt(rt.distance - TRAIN_LENGTH * 0.5) === TUNNEL && track.kindAt(rt.distance) === TUNNEL
    if (inTunnel !== ride.inTunnel) ride.setInTunnel(inTunnel)

    if (!MOVING.has(ride.state)) {
      rt.speed = 0
      return
    }
    const target = derived.stations.find((s) => s.def.id === ride.targetStation)
    if (!target) return

    const fast = ride.state === 'FAST_TRAVEL'
    const cruise = fast ? RIDE.fastCruise : RIDE.cruise * (inTunnel ? RIDE.tunnelBoost : 1)
    const accel = fast ? RIDE.fastAccel : RIDE.accel
    const brake = fast ? RIDE.fastBrake : RIDE.brake

    const remaining = track.ahead(rt.distance, target.distance)
    const desired = Math.min(cruise, Math.sqrt(2 * brake * remaining))
    if (rt.speed < desired) rt.speed = Math.min(desired, rt.speed + accel * dt)
    else rt.speed = Math.max(desired, rt.speed - brake * 3 * dt)
    if (remaining > 0.02) rt.speed = Math.max(rt.speed, 0.3)

    const step = rt.speed * dt
    if (step >= remaining) {
      rt.distance = target.distance
      rt.wheelAngle += remaining / WHEEL_RADIUS
      rt.speed = 0
      ride.arrive(target.def.id)
      return
    }
    rt.distance = track.wrap(rt.distance + step)
    rt.wheelAngle += step / WHEEL_RADIUS

    if (ride.state === 'DEPARTING' && rt.stateTime > RIDE.departSeconds) ride.setState('RIDING')
    else if ((ride.state === 'RIDING' || fast) && remaining < RIDE.arrivingDistance) ride.setState('ARRIVING')
  })

  return null
}
