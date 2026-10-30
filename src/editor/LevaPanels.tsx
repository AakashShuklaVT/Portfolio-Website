import { Leva, button, folder, useControls } from 'leva'
import { terrainUniforms } from '../materials/terrainMaterial'
import { waterUniforms } from '../materials/waterMaterial'
import { windUniforms } from '../materials/natureMaterials'
import { useWorldStore } from '../store/useWorldStore'
import { ATMOSPHERE_PRESETS } from '../world/atmospherePresets'
import type { AtmosphereData, Vec3, WorldData } from '../world/types'
import { commitWorld, useEditorStore } from './useEditorStore'

type Ctx = { initial: boolean }
const live = (update: (w: WorldData) => WorldData) => (_v: unknown, _p: string, ctx: Ctx) => !ctx.initial && commitWorld(update, false)

const sunAngles = (d: Vec3) => {
  const len = Math.hypot(...d)
  return {
    azimuth: Math.round((Math.atan2(d[0], d[2]) * 180) / Math.PI),
    elevation: Math.round((Math.asin(d[1] / len) * 180) / Math.PI),
  }
}
const sunVector = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  return [+(Math.sin(az) * Math.cos(el)).toFixed(3), +Math.sin(el).toFixed(3), +(Math.cos(az) * Math.cos(el)).toFixed(3)]
}
const setAtmosphere = (patch: Partial<AtmosphereData>) => (w: WorldData) => ({ ...w, atmosphere: { ...w.atmosphere, ...patch } })

/** Lighting, atmosphere, water, shader and generator settings (Leva). */
export function LevaPanels() {
  const world = useWorldStore.getState().world!
  const a = world.atmosphere
  const angles = sunAngles(a.sunDirection)

  const [, setAtmo] = useControls(
    'Lighting & atmosphere',
    () => ({
      presets: folder(
        Object.fromEntries(
          Object.entries(ATMOSPHERE_PRESETS).map(([name, preset]) => [
            name,
            button(() => {
              commitWorld(setAtmosphere(preset))
              const ang = sunAngles(preset.sunDirection)
              setAtmo({ ...preset, azimuth: ang.azimuth, elevation: ang.elevation } as never)
            }),
          ]),
        ),
      ),
      azimuth: {
        value: angles.azimuth,
        min: -180,
        max: 180,
        step: 1,
        onChange: (v: number, _p: string, ctx: Ctx) => {
          if (ctx.initial) return
          const w = useWorldStore.getState().world!
          commitWorld(setAtmosphere({ sunDirection: sunVector(v, sunAngles(w.atmosphere.sunDirection).elevation) }), false)
        },
      },
      elevation: {
        value: angles.elevation,
        min: 5,
        max: 89,
        step: 1,
        onChange: (v: number, _p: string, ctx: Ctx) => {
          if (ctx.initial) return
          const w = useWorldStore.getState().world!
          commitWorld(setAtmosphere({ sunDirection: sunVector(sunAngles(w.atmosphere.sunDirection).azimuth, v) }), false)
        },
      },
      sunColor: { value: a.sunColor, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ sunColor: v }))(v, p, c) },
      sunIntensity: { value: a.sunIntensity, min: 0, max: 6, step: 0.05, onChange: (v: number, p: string, c: Ctx) => live(setAtmosphere({ sunIntensity: v }))(v, p, c) },
      ambientSky: { value: a.ambientSky, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ ambientSky: v }))(v, p, c) },
      ambientGround: { value: a.ambientGround, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ ambientGround: v }))(v, p, c) },
      ambientIntensity: { value: a.ambientIntensity, min: 0, max: 4, step: 0.05, onChange: (v: number, p: string, c: Ctx) => live(setAtmosphere({ ambientIntensity: v }))(v, p, c) },
      skyTop: { value: a.skyTop, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ skyTop: v }))(v, p, c) },
      skyHorizon: { value: a.skyHorizon, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ skyHorizon: v }))(v, p, c) },
      fogColor: { value: a.fogColor, onChange: (v: string, p: string, c: Ctx) => live(setAtmosphere({ fogColor: v }))(v, p, c) },
      fogNear: { value: a.fogNear, min: 10, max: 400, step: 1, onChange: (v: number, p: string, c: Ctx) => live(setAtmosphere({ fogNear: v }))(v, p, c) },
      fogFar: { value: a.fogFar, min: 50, max: 900, step: 1, onChange: (v: number, p: string, c: Ctx) => live(setAtmosphere({ fogFar: v }))(v, p, c) },
    }),
    { collapsed: false },
  )

  useControls(
    'Water',
    {
      shallow: { value: world.water.shallow, onChange: (v: string, p: string, c: Ctx) => live((w) => ({ ...w, water: { ...w.water, shallow: v } }))(v, p, c) },
      deep: { value: world.water.deep, onChange: (v: string, p: string, c: Ctx) => live((w) => ({ ...w, water: { ...w.water, deep: v } }))(v, p, c) },
      foam: { value: world.water.foam, onChange: (v: string, p: string, c: Ctx) => live((w) => ({ ...w, water: { ...w.water, foam: v } }))(v, p, c) },
      waveHeight: { value: waterUniforms.waveHeight.value as number, min: 0, max: 0.8, step: 0.01, onChange: (v: number) => (waterUniforms.waveHeight.value = v) },
      waveSpeed: { value: waterUniforms.waveSpeed.value as number, min: 0, max: 3, step: 0.05, onChange: (v: number) => (waterUniforms.waveSpeed.value = v) },
    },
    { collapsed: true },
  )

  useControls(
    'Shaders (TSL uniforms)',
    {
      windStrength: { value: windUniforms.strength.value as number, min: 0, max: 0.8, step: 0.01, onChange: (v: number) => (windUniforms.strength.value = v) },
      windSpeed: { value: windUniforms.speed.value as number, min: 0, max: 5, step: 0.05, onChange: (v: number) => (windUniforms.speed.value = v) },
      gustScale: { value: windUniforms.gustScale.value as number, min: 0, max: 0.4, step: 0.005, onChange: (v: number) => (windUniforms.gustScale.value = v) },
      grassLow: { value: '#' + terrainUniforms.grassLow.value.getHexString(), onChange: (v: string) => terrainUniforms.grassLow.value.set(v) },
      grassHigh: { value: '#' + terrainUniforms.grassHigh.value.getHexString(), onChange: (v: string) => terrainUniforms.grassHigh.value.set(v) },
      rock: { value: '#' + terrainUniforms.rock.value.getHexString(), onChange: (v: string) => terrainUniforms.rock.value.set(v) },
      sand: { value: '#' + terrainUniforms.sand.value.getHexString(), onChange: (v: string) => terrainUniforms.sand.value.set(v) },
      gravel: { value: '#' + terrainUniforms.gravel.value.getHexString(), onChange: (v: string) => terrainUniforms.gravel.value.set(v) },
      cliffSlope: { value: terrainUniforms.cliffSlope.value as number, min: 0.3, max: 0.95, step: 0.01, onChange: (v: number) => (terrainUniforms.cliffSlope.value = v) },
      beachHeight: { value: terrainUniforms.beachHeight.value as number, min: 0, max: 5, step: 0.05, onChange: (v: number) => (terrainUniforms.beachHeight.value = v) },
    },
    { collapsed: true },
  )

  const t = world.terrain
  const terrain = useControls(
    'Terrain generator',
    {
      seed: { value: t.seed, step: 1 },
      radius: { value: t.radius, min: 30, max: 85, step: 1 },
      peakHeight: { value: t.peakHeight, min: 5, max: 60, step: 0.5 },
      profilePower: { value: t.profilePower, min: 0.5, max: 2.5, step: 0.05 },
      terraceStep: { value: t.terraceStep, min: 2, max: 15, step: 0.5 },
      terraceFlatness: { value: t.terraceFlatness, min: 0, max: 0.95, step: 0.01 },
      noiseScale: { value: t.noiseScale, min: 0.005, max: 0.1, step: 0.001 },
      noiseAmount: { value: t.noiseAmount, min: 0, max: 0.2, step: 0.005 },
      resolution: { value: t.resolution, min: 80, max: 320, step: 10 },
      tunnelDepth: { value: world.track.tunnelDepth, min: 1, max: 8, step: 0.1 },
      bridgeHeight: { value: world.track.bridgeHeight, min: 1, max: 8, step: 0.1 },
      regenerate: button((get) => {
        const keys = ['seed', 'radius', 'peakHeight', 'profilePower', 'terraceStep', 'terraceFlatness', 'noiseScale', 'noiseAmount', 'resolution'] as const
        const next = Object.fromEntries(keys.map((k) => [k, get(`Terrain generator.${k}`)]))
        commitWorld((w) => ({
          ...w,
          terrain: { ...w.terrain, ...next },
          track: { ...w.track, tunnelDepth: get('Terrain generator.tunnelDepth'), bridgeHeight: get('Terrain generator.bridgeHeight') },
        }))
        useEditorStore.getState().setStatus('Terrain regenerated. Use “Re-snap to terrain” to settle trees and props.')
      }),
    },
    { collapsed: true },
  )
  void terrain

  return <Leva titleBar={{ title: 'World settings' }} theme={{ sizes: { rootWidth: '300px' } }} />
}
