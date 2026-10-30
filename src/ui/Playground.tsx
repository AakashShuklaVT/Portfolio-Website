import { useState } from 'react'
import { windUniforms } from '../materials/natureMaterials'
import { waterUniforms } from '../materials/waterMaterial'
import { useWorldStore } from '../store/useWorldStore'
import type { Vec3 } from '../world/types'

interface SliderProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

function Slider({ label, min, max, step, value, onChange, format }: SliderProps) {
  return (
    <label className="slider">
      <span>
        {label} <output>{format ? format(value) : value.toFixed(2)}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

/** Live controls bound straight to TSL uniforms and the sun direction. */
export function Playground() {
  const [wind, setWind] = useState(windUniforms.strength.value as number)
  const [gust, setGust] = useState(windUniforms.speed.value as number)
  const [waves, setWaves] = useState(waterUniforms.waveHeight.value as number)
  const [sun, setSun] = useState(() => {
    const d = useWorldStore.getState().world?.atmosphere.sunDirection ?? [0.55, 0.75, 0.38]
    return Math.round((Math.atan2(d[0], d[2]) * 180) / Math.PI)
  })

  const setSunAngle = (deg: number) => {
    setSun(deg)
    const { world, setWorld } = useWorldStore.getState()
    if (!world) return
    const [x, y, z] = world.atmosphere.sunDirection
    const flat = Math.hypot(x, z)
    const a = (deg * Math.PI) / 180
    const sunDirection: Vec3 = [+(Math.sin(a) * flat).toFixed(3), y, +(Math.cos(a) * flat).toFixed(3)]
    setWorld({ ...world, atmosphere: { ...world.atmosphere, sunDirection } })
  }

  return (
    <div className="playground">
      <Slider label="Wind strength" min={0} max={0.6} step={0.01} value={wind} onChange={(v) => (setWind(v), (windUniforms.strength.value = v))} />
      <Slider label="Gust speed" min={0.2} max={4} step={0.05} value={gust} onChange={(v) => (setGust(v), (windUniforms.speed.value = v))} />
      <Slider label="Wave height" min={0} max={0.7} step={0.01} value={waves} onChange={(v) => (setWaves(v), (waterUniforms.waveHeight.value = v))} />
      <Slider label="Sun angle" min={-180} max={180} step={1} value={sun} onChange={setSunAngle} format={(v) => `${v}°`} />
    </div>
  )
}
