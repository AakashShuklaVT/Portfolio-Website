import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { abs, float, length, mix, pass, screenUV, smoothstep, uniform, vec4 } from 'three/tsl'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { useAppStore } from '../store/useAppStore'
import { useWorldStore } from '../store/useWorldStore'
import { flags } from './flags'

export const postUniforms = {
  /** 0..1 strength of the miniature (tilt-shift) blur. */
  tiltShift: uniform(0.6),
  /** Screen-space height (0 bottom, 1 top) that stays sharp. */
  focusY: uniform(0.45),
  focusBand: uniform(0.16),
  vignette: uniform(0.22),
}

/**
 * Node-based post-processing: tilt-shift blur for the diorama look and a soft
 * vignette. Runs on both backends; skipped entirely on low tiers.
 */
export function PostFX() {
  const quality = useAppStore((s) => s.quality)
  const tilt = useWorldStore((s) => s.world?.atmosphere.tiltShift)
  useEffect(() => {
    if (tilt !== undefined) postUniforms.tiltShift.value = tilt
  }, [tilt])
  if (!quality?.postProcessing || flags.edit) return null
  return <Pipeline tiltShift={quality.tiltShift} />
}

function Pipeline({ tiltShift }: { tiltShift: boolean }) {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const pipeline = useMemo(() => {
    const u = postUniforms
    const scenePass = pass(scene, camera)
    const color = scenePass.getTextureNode('output')
    let out = color.rgb
    if (tiltShift) {
      const blurred = gaussianBlur(color, null, 3, { resolutionScale: 0.5 })
      const away = abs(screenUV.y.sub(u.focusY))
      const amount = smoothstep(u.focusBand, u.focusBand.add(0.3), away).mul(u.tiltShift)
      out = mix(color.rgb, blurred.rgb, amount)
    }
    const d = length(screenUV.sub(0.5))
    out = out.mul(float(1).sub(smoothstep(0.38, 0.9, d).mul(u.vignette)))
    const p = new THREE.RenderPipeline(gl)
    p.outputNode = vec4(out, 1)
    return p
  }, [gl, scene, camera, tiltShift])

  useEffect(() => () => pipeline.dispose(), [pipeline])

  // A positive priority takes over rendering from R3F.
  useFrame(() => pipeline.render(), 1)
  return null
}
