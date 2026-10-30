import * as THREE from 'three/webgpu'
import { MODELS, getModelGeometry } from '../world/models'

const SIZE = 112
let pending: Promise<Map<string, string>> | null = null

/**
 * Renders a thumbnail for every library model with a small throwaway
 * renderer (WebGL backend, so the canvas can be read back synchronously).
 */
export function getThumbnails(): Promise<Map<string, string>> {
  pending ??= (async () => {
    const out = new Map<string, string>()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL: true })
    await renderer.init()
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#fff4e0', '#86a46e', 1.6))
    const sun = new THREE.DirectionalLight('#fff1d9', 2.4)
    sun.position.set(3, 5, 4)
    scene.add(sun)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })

    for (const model of MODELS) {
      const geometry = getModelGeometry(model.id)
      geometry.computeBoundingSphere()
      const sphere = geometry.boundingSphere!
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.y = 0.6
      scene.add(mesh)
      const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05
      camera.position.set(sphere.center.x + dist * 0.6, sphere.center.y + dist * 0.45, sphere.center.z + dist * 0.65)
      camera.lookAt(sphere.center)
      renderer.render(scene, camera)
      out.set(model.id, canvas.toDataURL('image/png'))
      scene.remove(mesh)
    }
    renderer.dispose()
    return out
  })()
  return pending
}
