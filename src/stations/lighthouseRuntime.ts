import * as THREE from 'three/webgpu'

/** Where the lighthouse lamp is, so the camera can frame it when a signal is sent. */
export const lighthouseRuntime = {
  lamp: new THREE.Vector3(),
  ready: false,
}

/** Seconds the camera holds on the lamp after "flash the lighthouse". */
export const SIGNAL_SHOT_SECONDS = 4.5
