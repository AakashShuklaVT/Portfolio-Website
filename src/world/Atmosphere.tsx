import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { fog, mix, positionWorldDirection, rangeFogFactor, smoothstep, uniform } from 'three/tsl'
import { useAppStore } from '../store/useAppStore'
import { useWorldStore } from '../store/useWorldStore'

export const atmosphereUniforms = {
  skyTop: uniform(new THREE.Color('#8cc6e8')),
  skyHorizon: uniform(new THREE.Color('#fbe3c4')),
  fogColor: uniform(new THREE.Color('#f3dcc0')),
  fogNear: uniform(120),
  fogFar: uniform(330),
}

/** Gradient sky, distance haze and the sun/ambient lights, all driven by world.atmosphere. */
export function Atmosphere() {
  const atmosphere = useWorldStore((s) => s.world?.atmosphere)
  const quality = useAppStore((s) => s.quality)
  const scene = useThree((s) => s.scene)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)

  useEffect(() => {
    const u = atmosphereUniforms
    const up = positionWorldDirection.y
    scene.backgroundNode = mix(u.skyHorizon, u.skyTop, smoothstep(0.0, 0.32, up))
    scene.fogNode = fog(u.fogColor, rangeFogFactor(u.fogNear, u.fogFar))
    return () => {
      scene.backgroundNode = null
      scene.fogNode = null
    }
  }, [scene])

  useEffect(() => {
    if (!atmosphere) return
    const u = atmosphereUniforms
    u.skyTop.value.set(atmosphere.skyTop)
    u.skyHorizon.value.set(atmosphere.skyHorizon)
    u.fogColor.value.set(atmosphere.fogColor)
    u.fogNear.value = atmosphere.fogNear
    u.fogFar.value = atmosphere.fogFar
    if (sun.current) {
      sun.current.position.fromArray(atmosphere.sunDirection).normalize().multiplyScalar(120)
      sun.current.color.set(atmosphere.sunColor)
      sun.current.intensity = atmosphere.sunIntensity
    }
    if (hemi.current) {
      hemi.current.color.set(atmosphere.ambientSky)
      hemi.current.groundColor.set(atmosphere.ambientGround)
      hemi.current.intensity = atmosphere.ambientIntensity
    }
  }, [atmosphere])

  const shadowSize = quality?.shadowMapSize ?? 1024
  return (
    <>
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
