import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'

/** Shared clock for the intro: set when shaders are warm and the island may assemble. */
export const revealRuntime = { start: -1 }

const easeOutBack = (t: number) => {
  const c = 1.6
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface RevealProps {
  children: ReactNode
  /** Seconds after the reveal starts. */
  delay?: number
  duration?: number
  /** rise: grows up from the ground; pop: scales in with a little overshoot; drop: falls into place. */
  mode?: 'rise' | 'pop' | 'drop'
}

/** Animates its children in once, as part of the island "assembling" on load. */
export function Reveal({ children, delay = 0, duration = 1, mode = 'pop' }: RevealProps) {
  const group = useRef<THREE.Group>(null)
  const done = useRef(false)

  useFrame((state) => {
    const g = group.current
    if (!g || done.current) return
    const loaded = useAppStore.getState().loaded
    if (!loaded || revealRuntime.start < 0) {
      g.visible = false
      return
    }
    g.visible = true
    const reduced = useSettingsStore.getState().reducedMotion
    const raw = reduced ? 1 : (state.clock.elapsedTime - revealRuntime.start - delay) / duration
    const t = Math.min(1, Math.max(0, raw))
    if (mode === 'rise') g.scale.set(1, Math.max(0.001, easeOutCubic(t)), 1)
    else if (mode === 'drop') g.position.y = (1 - easeOutCubic(t)) * 30
    else g.scale.setScalar(Math.max(0.001, easeOutBack(t)))
    if (t >= 1) {
      g.scale.set(1, 1, 1)
      g.position.y = 0
      done.current = true
    }
  })

  return <group ref={group}>{children}</group>
}
