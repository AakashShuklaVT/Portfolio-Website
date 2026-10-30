import './core/three'
import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { createRenderer } from './core/renderer'
import { flags } from './core/flags'
import { canRender3D } from './core/quality'
import { useWorldStore } from './store/useWorldStore'
import { useUiStore } from './store/useUiStore'
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
import { Hud } from './ui/Hud'
import { IntroCard } from './ui/IntroCard'
import { StationPanel } from './ui/StationPanel'
import { RideTicker } from './ui/RideTicker'
import { LiteSite } from './ui/LiteSite'
import { DebugBadge } from './ui/DebugBadge'

export default function App() {
  const load = useWorldStore((s) => s.load)
  const liteOpen = useUiStore((s) => s.liteOpen)
  const can3D = useMemo(() => !flags.lite && canRender3D(), [])
  useEffect(() => void (can3D && load()), [load, can3D])

  if (!can3D) return <LiteSite canGoBack={false} />

  return (
    <>
      <Canvas
        className="scene"
        gl={createRenderer}
        dpr={[1, 2]}
        shadows="percentage"
        frameloop={liteOpen ? 'never' : 'always'}
        camera={{ position: [95, 85, 125], fov: 38, near: 0.5, far: 900 }}
        aria-hidden="true"
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
      <div className="ui" hidden={liteOpen}>
        <Hud />
        <IntroCard />
        <StationPanel />
        <RideTicker />
      </div>
      {liteOpen && <LiteSite canGoBack />}
      {flags.debug && <DebugBadge />}
    </>
  )
}
