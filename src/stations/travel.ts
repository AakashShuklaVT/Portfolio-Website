import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'

/** Single entry point for "take me to station X", from any ride state. */
export function travelTo(stationId: string, fast = true) {
  const ride = useRideStore.getState()
  const stations = useWorldStore.getState().derived?.stations
  if (!stations?.length) return
  if (ride.state === 'INTRO') {
    const first = stations[0].def.id
    if (stationId === first) ride.board(first)
    else useRideStore.setState({ state: 'FAST_TRAVEL', currentStation: first, targetStation: stationId, overlayOpen: false })
    return
  }
  if (stationId === ride.currentStation && ride.state === 'IDLE_AT_STATION') {
    ride.setOverlayOpen(true)
    return
  }
  ride.depart(stationId, fast)
}

export function nextStationId(currentId: string | null) {
  const stations = useWorldStore.getState().derived?.stations ?? []
  const current = stations.find((s) => s.def.id === currentId)
  return current ? stations[(current.index + 1) % stations.length].def.id : stations[0]?.def.id
}
