import * as THREE from 'three/webgpu'
import type { CameraShot, Vec3 } from '../world/types'

interface OrbitLike {
  target: THREE.Vector3
  update: () => void
}

let camera: THREE.Camera | null = null
let controls: OrbitLike | null = null

const r = (v: THREE.Vector3): Vec3 => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]

/** Lets DOM panels read and drive the editor's orbit camera. */
export const editorCamera = {
  attach(c: THREE.Camera, ctl: OrbitLike | null) {
    camera = c
    controls = ctl
  },
  capture(): CameraShot | null {
    if (!camera || !controls) return null
    return { position: r(camera.position), target: r(controls.target) }
  },
  target(): Vec3 | null {
    return controls ? r(controls.target) : null
  },
  goTo(shot: CameraShot) {
    if (!camera || !controls) return
    camera.position.fromArray(shot.position)
    controls.target.fromArray(shot.target)
    controls.update()
  },
}
