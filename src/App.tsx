import './core/three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { createRenderer } from './core/renderer'
import { flags } from './core/flags'
import { PlaceholderIsland } from './world/PlaceholderIsland'
import { DebugBadge } from './ui/DebugBadge'

export default function App() {
  return (
    <>
      <Canvas
        className="scene"
        gl={createRenderer}
        dpr={[1, 2]}
        camera={{ position: [70, 50, 70], fov: 35, near: 0.5, far: 600 }}
      >
        <color attach="background" args={['#f6dcb3']} />
        <hemisphereLight args={['#fff1d6', '#7a9a6a', 1.2]} />
        <directionalLight position={[40, 60, 25]} intensity={2.4} color="#fff0d8" castShadow />
        <PlaceholderIsland />
        <OrbitControls makeDefault target={[0, 8, 0]} />
      </Canvas>
      {flags.debug && <DebugBadge />}
    </>
  )
}
