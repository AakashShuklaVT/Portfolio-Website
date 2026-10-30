import './core/three'
import { Suspense, lazy, useEffect, useMemo } from 'react'
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
import { Loader } from './ui/Loader'
import { WarmUp } from './core/WarmUp'
import { Reveal } from './world/Reveal'
import { PostFX } from './core/PostFX'
import { Steam } from './rail/Steam'
import { Birds } from './world/Birds'
import { Stars } from './world/Stars'
import { useEditorMode } from './store/useEditorMode'

// The editor only exists in dev builds; DEV is false in production so these chunks are dropped.
const EditorScene = import.meta.env.DEV ? lazy(() => import('./editor/EditorScene')) : null
const EditorPanels = import.meta.env.DEV ? lazy(() => import('./editor/EditorPanels')) : null

export default function App() {
  const load = useWorldStore((s) => s.load)
  const liteOpen = useUiStore((s) => s.liteOpen)
  const editorMode = useEditorMode((s) => s.mode)
  const editing = flags.edit && editorMode === 'edit'
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
          <Stars />
          <Reveal mode="rise" duration={1.6}>
            <Terrain />
            <Track />
            <Scatter />
            <Props />
          </Reveal>
          <Water />
          <Reveal mode="drop" delay={1.2} duration={1}>
            <StationBuildings />
            <Train />
          </Reveal>
          <Steam />
          <Reveal mode="pop" delay={1.6} duration={1.2}>
            <Clouds />
            <Birds />
          </Reveal>
          <WarmUp />
          <PostFX />
          <RideController />
          {!editing && <CameraRig />}
          {flags.edit && EditorScene && <EditorScene />}
        </Suspense>
      </Canvas>
      <div className="ui" hidden={liteOpen || editing}>
        <Hud />
        <IntroCard />
        <StationPanel />
        <RideTicker />
      </div>
      <Loader />
      {liteOpen && <LiteSite canGoBack />}
      {flags.edit && EditorPanels && (
        <Suspense fallback={null}>
          <EditorPanels />
        </Suspense>
      )}
      {flags.debug && <DebugBadge />}
    </>
  )
}
