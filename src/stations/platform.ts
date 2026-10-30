import { GROUND, type TrackPath } from '../rail/TrackPath'
import { frameAt, sweepProfile } from '../rail/trackGeometry'
import type { StationRuntime } from '../world/buildWorld'

/** Platform extent along the track, relative to the stop (the train stops with its nose at 0). */
const PLATFORM_BACK = 16
const PLATFORM_AHEAD = 2

/**
 * A platform that follows the curve of the line on the building side, so it
 * never cuts into the track. It is clipped to open ground (no platforms in tunnels).
 */
export function buildPlatform(track: TrackPath, station: StationRuntime) {
  const f = frameAt(track, station.distance)
  const sign = Math.sign(f.side.dot(station.side)) || 1
  const ranges: [number, number][] = []
  let start: number | null = null
  for (let d = -PLATFORM_BACK; d <= PLATFORM_AHEAD; d += 0.5) {
    const ok = track.kindAt(station.distance + d) === GROUND
    if (ok && start === null) start = d
    if ((!ok || d + 0.5 > PLATFORM_AHEAD) && start !== null) {
      ranges.push([station.distance + start, station.distance + (ok ? d : d - 0.5)])
      start = null
    }
  }
  const shape = (inner: number, outer: number, bottom: number, top: number) => {
    const p: [number, number][] = [
      [inner * sign, bottom],
      [outer * sign, bottom],
      [outer * sign, top],
      [inner * sign, top],
    ]
    return sign < 0 ? p.reverse() : p
  }
  return {
    body: sweepProfile(track, ranges, shape(1.42, 3.9, -0.8, 0.7), 0.5),
    edge: sweepProfile(track, ranges, shape(1.38, 1.75, 0.69, 0.75), 0.5),
  }
}
