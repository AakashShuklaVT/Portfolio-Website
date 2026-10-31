import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAppStore } from '../store/useAppStore'
import { FRAME } from './frameOrder'

/** Seconds of frames averaged before each decision. */
const WINDOW = 1.5
const STEP = 0.25
const MIN_DPR = 0.75
/** Below this frame rate the resolution drops; above the upper one it may climb back. */
const SLOW_FPS = 50
const FAST_FPS = 58
const MAX_RAISES = 2

/**
 * Keeps the frame rate steady by trading resolution: the pixel ratio starts at
 * the tier's cap (never above the screen's) and steps down while frames run
 * slow, then cautiously back up when there is headroom. Resolution is the
 * cost that scales with every fragment, so this is the lever that matters most
 * on high-density phones and laptops.
 */
export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr)
  const cap = useAppStore((s) => s.quality?.maxPixelRatio ?? 1.5)
  const max = Math.min(window.devicePixelRatio || 1, cap)
  const state = useRef({ dpr: max, time: 0, frames: 0, good: 0, raises: 0 })

  useEffect(() => {
    state.current = { dpr: max, time: 0, frames: 0, good: 0, raises: 0 }
    setDpr(max)
  }, [max, setDpr])

  useFrame((_, dt) => {
    const s = state.current
    // Ignore the reveal (shader warm-up hitches) and background-tab gaps.
    if (!useAppStore.getState().loaded || dt > 0.25) return
    s.time += dt
    s.frames++
    if (s.time < WINDOW) return
    const fps = s.frames / s.time
    s.time = 0
    s.frames = 0
    if (fps < SLOW_FPS && s.dpr > MIN_DPR) {
      s.dpr = Math.max(MIN_DPR, s.dpr - STEP)
      s.good = 0
      setDpr(s.dpr)
    } else if (fps > FAST_FPS && s.dpr < max && s.raises < MAX_RAISES) {
      if (++s.good >= 4) {
        s.dpr = Math.min(max, s.dpr + STEP)
        s.good = 0
        s.raises++
        setDpr(s.dpr)
      }
    } else {
      s.good = 0
    }
  }, FRAME.quality)

  return null
}
