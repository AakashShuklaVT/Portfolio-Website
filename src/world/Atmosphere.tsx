import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mix, positionLocal, smoothstep, uniform } from 'three/tsl'
import { damp } from '../lib/math'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useWorldStore } from '../store/useWorldStore'
import { nightRuntime, resolveAtmosphere } from './timeOfDay'
import type { AtmosphereData } from './types'

export const atmosphereUniforms = {
  skyTop: uniform(new THREE.Color('#8cc6e8')),
  skyHorizon: uniform(new THREE.Color('#fbe3c4')),
  fogColor: uniform(new THREE.Color('#f3dcc0')),
  fogNear: uniform(120),
  fogFar: uniform(330),
}

/** Mutable copy of the atmosphere that eases towards the target (day/night blends). */
function createLive(a: AtmosphereData) {
  return {
    sunDir: new THREE.Vector3().fromArray(a.sunDirection).normalize(),
    sunColor: new THREE.Color(a.sunColor),
    sunIntensity: a.sunIntensity,
    ambientSky: new THREE.Color(a.ambientSky),
    ambientGround: new THREE.Color(a.ambientGround),
    ambientIntensity: a.ambientIntensity,
    fogNear: a.fogNear,
    fogFar: a.fogFar,
  }
}

const SKY_RADIUS = 800
const skyMaterial = (() => {
  const u = atmosphereUniforms
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false, depthWrite: false })
  m.colorNode = mix(u.skyHorizon, u.skyTop, smoothstep(0.0, 0.32, positionLocal.normalize().y))
  return m
})()
const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16)

/** Gradient sky dome that travels with the camera, so it always reads as infinitely far away. */
function SkyDome() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return <mesh ref={ref} geometry={skyGeometry} material={skyMaterial} renderOrder={-2} frustumCulled={false} />
}

const tmpColor = new THREE.Color()
const tmpDir = new THREE.Vector3()

/** Gradient sky, distance haze and the sun/ambient lights, eased towards world.atmosphere and the time of day. */
export function Atmosphere() {
  const worldAtmosphere = useWorldStore((s) => s.world?.atmosphere)
  const timeOfDay = useSettingsStore((s) => s.timeOfDay)
  const quality = useAppStore((s) => s.quality)
  const scene = useThree((s) => s.scene)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const live = useRef<ReturnType<typeof createLive> | null>(null)
  const snap = useRef(true)

  const target = useMemo(() => (worldAtmosphere ? resolveAtmosphere(timeOfDay, worldAtmosphere) : null), [worldAtmosphere, timeOfDay])

  // Built-in Fog object: materials read its properties through reference nodes,
  // so per-frame changes reach every material regardless of when it compiled.
  const sceneFog = useMemo(() => new THREE.Fog('#f3dcc0', 120, 330), [])
  useEffect(() => {
    scene.fog = sceneFog
    return () => {
      scene.fog = null
    }
  }, [scene, sceneFog])

  // Editor tweaks to the world atmosphere land immediately; time-of-day changes blend.
  useEffect(() => {
    snap.current = true
  }, [worldAtmosphere])

  useFrame((_, rawDt) => {
    if (!target) return
    const a = target.atmosphere
    live.current ??= createLive(a)
    const l = live.current
    const k = snap.current ? 1 : damp(1.6, Math.min(rawDt, 0.1))
    snap.current = false
    const u = atmosphereUniforms

    l.sunDir.lerp(tmpDir.fromArray(a.sunDirection).normalize(), k).normalize()
    l.sunColor.lerp(tmpColor.set(a.sunColor), k)
    l.sunIntensity += (a.sunIntensity - l.sunIntensity) * k
    l.ambientSky.lerp(tmpColor.set(a.ambientSky), k)
    l.ambientGround.lerp(tmpColor.set(a.ambientGround), k)
    l.ambientIntensity += (a.ambientIntensity - l.ambientIntensity) * k
    l.fogNear += (a.fogNear - l.fogNear) * k
    l.fogFar += (a.fogFar - l.fogFar) * k
    u.skyTop.value.lerp(tmpColor.set(a.skyTop), k)
    u.skyHorizon.value.lerp(tmpColor.set(a.skyHorizon), k)
    u.fogColor.value.lerp(tmpColor.set(a.fogColor), k)
    u.fogNear.value = l.fogNear
    u.fogFar.value = l.fogFar
    sceneFog.color.copy(u.fogColor.value)
    sceneFog.near = l.fogNear
    sceneFog.far = l.fogFar
    nightRuntime.factor += (target.night - nightRuntime.factor) * k

    if (sun.current) {
      sun.current.position.copy(l.sunDir).multiplyScalar(120)
      sun.current.color.copy(l.sunColor)
      sun.current.intensity = l.sunIntensity
    }
    if (hemi.current) {
      hemi.current.color.copy(l.ambientSky)
      hemi.current.groundColor.copy(l.ambientGround)
      hemi.current.intensity = l.ambientIntensity
    }
  })

  const shadowSize = quality?.shadowMapSize ?? 1024
  return (
    <>
      <SkyDome />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={quality?.shadows ?? false}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}
