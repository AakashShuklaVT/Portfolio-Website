import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { trainRuntime } from '../rail/trainRuntime'
import { useRideStore } from '../store/useRideStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useUiStore } from '../store/useUiStore'
import { soundscape } from './soundscape'

/** Rail joints every few units produce the clickety-clack. */
const JOINT_SPACING = 7
/** Distance travelled per engine chuff (two per wheel revolution feels right). */
const CHUFF_SPACING = 2.4
const SUMMIT_HEIGHT = 30

/** Connects ride events and train motion to the procedural soundscape. */
export function SoundDriver() {
  const sound = useSettingsStore((s) => s.sound)
  const lastDistance = useRef(trainRuntime.distance)
  const jointAcc = useRef(0)
  const chuffAcc = useRef(0)

  useEffect(() => void soundscape.setEnabled(sound), [sound])

  useEffect(
    () =>
      useRideStore.subscribe((s, prev) => {
        if (s.state === prev.state) return
        if (s.state === 'DEPARTING' || s.state === 'FAST_TRAVEL') soundscape.whistle()
        if (s.state === 'ARRIVING') soundscape.brake()
        if (s.state === 'IDLE_AT_STATION') soundscape.chime()
      }),
    [],
  )

  useEffect(
    () =>
      useUiStore.subscribe((s, prev) => {
        if (s.signalAt !== prev.signalAt) soundscape.chime([79, 84, 88, 91])
      }),
    [],
  )

  useFrame(({ camera }) => {
    if (!sound) return
    soundscape.setAltitude(Math.min(1, Math.max(0, camera.position.y / (SUMMIT_HEIGHT * 2))))
    const travelled = Math.abs(trainRuntime.distance - lastDistance.current)
    lastDistance.current = trainRuntime.distance
    // Ignore wrap-around and teleports.
    if (travelled > 5 || trainRuntime.speed < 0.2) return
    const strength = Math.min(1, trainRuntime.speed / 10)
    jointAcc.current += travelled
    chuffAcc.current += travelled
    if (jointAcc.current >= JOINT_SPACING) {
      jointAcc.current = 0
      soundscape.clack(0.5 + strength * 0.5)
    }
    if (chuffAcc.current >= CHUFF_SPACING) {
      chuffAcc.current = 0
      soundscape.chuff(0.4 + strength * 0.6)
    }
  })

  return null
}
