export type Backend = 'pending' | 'webgpu' | 'webgl'
export type Tier = 'A' | 'B' | 'C'

export interface QualitySettings {
  tier: Tier
  maxPixelRatio: number
  shadows: boolean
  shadowMapSize: number
  postProcessing: boolean
  tiltShift: boolean
  particleScale: number
  computeExtras: boolean
}

const isLowPowerDevice = () => {
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return coarse && (cores <= 4 || mem <= 3)
}

export function qualityFor(backend: Backend): QualitySettings {
  const lowPower = isLowPowerDevice()
  if (backend === 'webgpu') {
    return {
      tier: 'A',
      maxPixelRatio: lowPower ? 1.5 : 2,
      shadows: true,
      shadowMapSize: lowPower ? 1024 : 2048,
      postProcessing: true,
      tiltShift: !lowPower,
      particleScale: lowPower ? 0.5 : 1,
      computeExtras: !lowPower,
    }
  }
  return {
    tier: 'B',
    maxPixelRatio: lowPower ? 1.25 : 1.5,
    shadows: !lowPower,
    shadowMapSize: 1024,
    postProcessing: !lowPower,
    tiltShift: false,
    particleScale: lowPower ? 0.35 : 0.6,
    computeExtras: false,
  }
}

/** True when the browser can create any WebGL 2 or WebGPU context at all (tier C otherwise). */
export function canRender3D(): boolean {
  if ('gpu' in navigator) return true
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}
