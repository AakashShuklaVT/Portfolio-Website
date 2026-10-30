// Registers the three/webgpu classes with R3F so JSX elements create node materials.
import * as THREE from 'three/webgpu'
import { extend, type ThreeToJSXElements } from '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)
