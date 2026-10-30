import * as THREE from 'three/webgpu'

/**
 * Per-frame train state. Lives outside React so the render loop can
 * mutate it without causing re-renders.
 */
export const trainRuntime = {
  /** Distance of the engine's front bogie along the track. */
  distance: 0,
  /** Current speed in world units per second. */
  speed: 0,
  /** Seconds spent in the current ride state. */
  stateTime: 0,
  /** Accumulated wheel rotation in radians. */
  wheelAngle: 0,
  /** World position of the locomotive chimney top (steam emitter). */
  chimney: new THREE.Vector3(),
}
