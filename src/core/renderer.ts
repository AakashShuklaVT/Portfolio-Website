import * as THREE from 'three/webgpu'
import { flags } from './flags'
import { qualityFor, type Backend } from './quality'
import { useAppStore } from '../store/useAppStore'

/**
 * Async renderer factory for R3F's <Canvas gl={...}>.
 * One WebGPURenderer: WebGPU when available, WebGL 2 backend otherwise
 * (or always, with ?backend=webgl).
 */
export async function createRenderer(props: { canvas: unknown }) {
  const renderer = new THREE.WebGPURenderer({
    canvas: props.canvas as HTMLCanvasElement,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    forceWebGL: flags.forceWebGL,
  })
  await renderer.init()

  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl'
  const quality = qualityFor(backend)

  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = quality.shadows
  renderer.shadowMap.type = THREE.PCFShadowMap

  useAppStore.getState().setRenderInfo(backend, quality)
  return renderer
}
