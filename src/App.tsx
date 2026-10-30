import './core/three'
import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { createRenderer } from './core/renderer'
import { flags } from './core/flags'
import { useWorldStore } from './store/useWorldStore'
import { Atmosphere } from './world/Atmosphere'
import { Terrain } from './world/Terrain'
import { Water } from './world/Water'
import { Scatter } from './world/Scatter'
import { Props } from './world/Props'
import { Clouds } from './world/Clouds'
import { Track } from './rail/Track'
import { Train } from './rail/Train'
import { RideController } from './rail/RideController'
import { StationBuildings } from './stations/StationBuildings'
import { CameraRig } from './camera/CameraRig'
import { RideUI } from './ui/RideUI'
import { DebugBadge } from './ui/DebugBadge'

export default function App() {
  const load = useWorldStore((s) => s.load)
  useEffect(() => void load(), [load])

  return (
    <>
      <Canvas
        className="scene"
        gl={createRenderer}
        dpr={[1, 2]}
        shadows="percentage"
        camera={{ position: [95, 85, 125], fov: 38, near: 0.5, far: 900 }}
      >
        <Suspense fallback={null}>
          <Atmosphere />
          <Terrain />
          <Water />
          <Scatter />
          <Props />
          <Clouds />
          <Track />
          <StationBuildings />
          <Train />
          <RideController />
          <CameraRig />
        </Suspense>
      </Canvas>
      <RideUI />
      {flags.debug && <DebugBadge />}
    </>
  )
}
