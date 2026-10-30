import * as THREE from 'three/webgpu'

/**
 * Per-frame train state. Lives outside React so the render loop can
 * mutate it without causing re-renders.
 */
export const trainRuntime = {
  /** Distance of the front of the engine along the track. */
  distance: 0,
  /** Current speed in world units per second. */
  speed: 0,
  /** Seconds spent in the current ride state. */
  stateTime: 0,
  /** Total distance rolled; wheels and rods are driven from it. */
  travelled: 0,
  /** World position of the locomotive chimney top (steam emitter). */
  chimney: new THREE.Vector3(),
  /** Track distance of the chimney (to tell when it is inside a tunnel). */
  chimneyDistance: 0,
  /** False while the chimney is hidden behind a portal gate. */
  chimneyVisible: true,
  /** World positions of the two cylinder fronts (drain-cock steam). */
  cylinders: [new THREE.Vector3(), new THREE.Vector3()],
  /** Direction the engine faces. */
  forward: new THREE.Vector3(0, 0, 1),
}
