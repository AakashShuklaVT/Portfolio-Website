import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three/webgpu'
import { useAppStore } from '../store/useAppStore'
import { useWorldStore } from '../store/useWorldStore'
import { revealRuntime } from '../world/Reveal'

/**
 * Compiles every pipeline in the scene before the island is shown, so the
 * first ride does not stutter on shader compilation, then starts the reveal.
 */
export function WarmUp() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const clock = useThree((s) => s.clock)
  const ready = useWorldStore((s) => !!s.derived)

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __gl: gl, __camera: camera })
  }, [scene, gl, camera])

  useEffect(() => {
    if (!ready || useAppStore.getState().loaded) return
    let cancelled = false
    // Let React commit the world's meshes first.
    const id = requestAnimationFrame(async () => {
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        // Compilation still happens lazily on first render if this fails.
      }
      if (cancelled) return
      revealRuntime.start = clock.elapsedTime + 0.15
      useAppStore.getState().setLoaded(true)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [ready, gl, scene, camera, clock])

  return null
}
