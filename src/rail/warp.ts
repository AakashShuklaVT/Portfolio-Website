import * as THREE from 'three/webgpu'
import { dot, length, positionWorld, uniform } from 'three/tsl'

/**
 * The two portal gates. Train materials discard whatever has already gone
 * through the exit gate, or has not yet come out of the entry gate, so cars
 * slide in and out of the swirling disc instead of popping.
 */
export const warpUniforms = {
  exitPos: uniform(new THREE.Vector3(1e5, 0, 0)),
  /** Direction of travel through the exit gate. */
  exitDir: uniform(new THREE.Vector3(0, 0, 1)),
  entryPos: uniform(new THREE.Vector3(1e5, 0, 0)),
  entryDir: uniform(new THREE.Vector3(0, 0, 1)),
  radius: uniform(7.5),
}

const u = warpUniforms
const toExit = positionWorld.sub(u.exitPos)
const toEntry = positionWorld.sub(u.entryPos)
const pastExit = dot(toExit, u.exitDir).greaterThan(0).and(length(toExit).lessThan(u.radius))
const beforeEntry = dot(toEntry, u.entryDir).lessThan(0).and(length(toEntry).lessThan(u.radius))

/** True where a train fragment should be drawn. */
export const warpMask = pastExit.or(beforeEntry).not()

/** Per-frame portal state shared by the gates, the camera and the sound. */
export const warpRuntime = {
  /** 0..1 flash on each gate as the train passes; decays over time. */
  exitFlash: 0,
  entryFlash: 0,
}
