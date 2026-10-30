import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three/webgpu'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useEditorMode } from '../store/useEditorMode'
import { useWorldStore } from '../store/useWorldStore'
import { getModelGeometry } from '../world/models'
import type { Vec3 } from '../world/types'
import { eraseScatter, rayTerrain, stampScatter } from './brush'
import { commitWorld, uid, useEditorStore } from './useEditorStore'
import { editorCamera } from './editorCamera'

const CLICK_SLOP = 5
/** Which gizmo handle is hovered; clicks on a handle must not change the selection. */
const gizmoState = { axis: null as string | null }
const round = (v: number, d = 2) => +v.toFixed(d)
const v3 = (v: THREE.Vector3): Vec3 => [round(v.x), round(v.y), round(v.z)]

const markerMaterials = {
  point: new THREE.MeshBasicNodeMaterial({ color: '#ffffff', depthTest: false, transparent: true }),
  pointSelected: new THREE.MeshBasicNodeMaterial({ color: '#d9643a', depthTest: false, transparent: true }),
  station: new THREE.MeshStandardNodeMaterial({ color: '#2f8f83', emissive: '#2f8f83', emissiveIntensity: 0.4 }),
  stationSelected: new THREE.MeshStandardNodeMaterial({ color: '#d9643a', emissive: '#d9643a', emissiveIntensity: 0.5 }),
  brush: new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }),
  erase: new THREE.MeshBasicNodeMaterial({ color: '#ff6b5a', transparent: true, opacity: 0.85, depthTest: false }),
  ghost: new THREE.MeshStandardNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.55, flatShading: true }),
  line: new THREE.LineBasicNodeMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.8 }),
}
const sphereGeo = new THREE.SphereGeometry(0.7, 12, 8)
const ringGeo = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2)
const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 6).translate(0, 3, 0)
const flagGeo = new THREE.BoxGeometry(1.6, 1, 0.1).translate(0.8, 5.4, 0)

/** Editor camera, gizmos and pointer tools. Mounted only with ?edit in dev builds. */
export default function EditorScene() {
  const mode = useEditorMode((s) => s.mode)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)

  // The visitor camera rig shifts the projection; the editor needs it centred.
  useEffect(() => {
    if (mode !== 'edit') return
    camera.clearViewOffset()
    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
  }, [mode, camera, size])

  if (mode !== 'edit') return null
  return <EditorTools />
}

function EditorTools() {
  const tool = useEditorStore((s) => s.tool)
  const stationSelected = useEditorStore((s) => s.selection?.kind === 'station')
  const controls = useRef<OrbitControlsImpl>(null)
  const brushTool = tool === 'scatter' || tool === 'erase' || tool === 'place'
  const camera = useThree((s) => s.camera)
  const orbit = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => editorCamera.attach(camera, orbit), [camera, orbit])

  return (
    <>
      <OrbitControls
        ref={controls as never}
        makeDefault
        target={[0, 8, 0]}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={4}
        maxDistance={420}
        enableDamping
        mouseButtons={brushTool ? { LEFT: undefined as never, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE } : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      />
      <gridHelper args={[200, 50, '#ffffff', '#ffffff']} position-y={0.06} material-transparent material-opacity={0.15} />
      <PointerTools />
      {tool === 'track' && <TrackHandles />}
      {(tool === 'station' || stationSelected) && <StationHandles />}
      <SelectionGizmo />
    </>
  )
}

/** Shared pointer handling: brush strokes, placing, and click-to-select. */
function PointerTools() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const tool = useEditorStore((s) => s.tool)
  const brush = useEditorStore((s) => s.brush)
  const placeModel = useEditorStore((s) => s.placeModel)
  const cursor = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
  const hit = useRef<THREE.Vector3 | null>(null)
  const ghostRot = useRef(Math.random() * Math.PI * 2)

  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let down: { x: number; y: number; button: number } | null = null
    let stroking = false
    let lastStamp: THREE.Vector3 | null = null

    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
    }
    const terrainHit = () => {
      const hf = useWorldStore.getState().derived?.heightfield
      return hf ? rayTerrain(raycaster.ray, hf) : null
    }
    const applyBrush = (p: THREE.Vector3) => {
      const { tool: t, brush: b } = useEditorStore.getState()
      const hf = useWorldStore.getState().derived?.heightfield
      if (!hf) return
      if (t === 'scatter') commitWorld((w) => stampScatter(w, hf, p, b), false)
      else if (t === 'erase') commitWorld((w) => eraseScatter(w, p, b.radius), false)
    }

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, button: e.button }
      const t = useEditorStore.getState().tool
      if (e.button !== 0 || (t !== 'scatter' && t !== 'erase')) return
      toNdc(e)
      const p = terrainHit()
      if (!p) return
      stroking = true
      useEditorStore.getState().checkpoint()
      applyBrush(p)
      lastStamp = p.clone()
    }
    const onMove = (e: PointerEvent) => {
      toNdc(e)
      hit.current = terrainHit()
      if (stroking && hit.current && lastStamp) {
        const r = useEditorStore.getState().brush.radius
        if (hit.current.distanceTo(lastStamp) > r * 0.3) {
          applyBrush(hit.current)
          lastStamp.copy(hit.current)
        }
      }
    }
    const onUp = (e: PointerEvent) => {
      const wasStroke = stroking
      stroking = false
      lastStamp = null
      if (!down || e.button !== 0 || wasStroke || gizmoState.axis) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > CLICK_SLOP) return
      toNdc(e)
      const store = useEditorStore.getState()
      if (store.tool === 'place') {
        const p = terrainHit()
        if (!p) return
        const { place, placeModel: model } = store
        const scale = round(place.scaleMin + Math.random() * (place.scaleMax - place.scaleMin))
        const id = uid(model)
        commitWorld((w) => ({
          ...w,
          props: [...w.props, { id, model, position: v3(p), rotation: [0, round(place.randomRotation ? ghostRot.current : 0, 3), 0], scale }],
        }))
        ghostRot.current = Math.random() * Math.PI * 2
        store.setStatus(`Placed ${model}`)
        return
      }
      if (store.tool === 'select' || store.tool === 'station' || store.tool === 'track') {
        const pickables: THREE.Object3D[] = []
        scene.traverse((o) => {
          if (o.userData.propId || o.userData.stationId || o.userData.trackPoint !== undefined) pickables.push(o)
        })
        const hits = raycaster.intersectObjects(pickables, false)
        const first = hits[0]?.object
        if (!first) return store.select(null)
        if (first.userData.trackPoint !== undefined) store.select({ kind: 'trackPoint', index: first.userData.trackPoint })
        else if (first.userData.stationId) store.select({ kind: 'station', id: first.userData.stationId })
        else store.select({ kind: 'prop', id: first.userData.propId })
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera, scene])

  useFrame(() => {
    const p = hit.current
    if (cursor.current) {
      cursor.current.visible = !!p && (tool === 'scatter' || tool === 'erase')
      if (p) {
        cursor.current.position.set(p.x, p.y + 0.15, p.z)
        cursor.current.scale.setScalar(brush.radius)
      }
    }
    if (ghost.current) {
      ghost.current.visible = !!p && tool === 'place'
      if (p) {
        ghost.current.position.copy(p)
        ghost.current.rotation.y = ghostRot.current
      }
    }
  })

  return (
    <>
      <mesh ref={cursor} geometry={ringGeo} material={tool === 'erase' ? markerMaterials.erase : markerMaterials.brush} renderOrder={10} visible={false} />
      <mesh ref={ghost} geometry={getModelGeometry(placeModel)} material={markerMaterials.ghost} visible={false} />
    </>
  )
}

/** Draggable spheres for every control point plus a preview of the curve. */
function TrackHandles() {
  const points = useWorldStore((s) => s.world?.track.points)
  const track = useWorldStore((s) => s.derived?.track)
  const selection = useEditorStore((s) => s.selection)
  const line = useMemo(() => {
    if (!track) return null
    const geometry = new THREE.BufferGeometry().setFromPoints(track.curve.getSpacedPoints(600))
    return new THREE.Line(geometry, markerMaterials.line)
  }, [track])
  if (!points) return null
  return (
    <group name="editor-track">
      {line && <primitive object={line} renderOrder={9} />}
      {points.map((pt, i) => {
        const selected = selection?.kind === 'trackPoint' && selection.index === i
        return (
          <mesh
            key={i}
            name={`track-point-${i}`}
            geometry={sphereGeo}
            material={selected ? markerMaterials.pointSelected : markerMaterials.point}
            position={pt.p}
            renderOrder={11}
            userData={{ trackPoint: i }}
          />
        )
      })}
    </group>
  )
}

function StationHandles() {
  const stations = useWorldStore((s) => s.world?.stations)
  const selection = useEditorStore((s) => s.selection)
  if (!stations) return null
  return (
    <group name="editor-stations">
      {stations.map((s) => {
        const selected = selection?.kind === 'station' && selection.id === s.id
        const mat = selected ? markerMaterials.stationSelected : markerMaterials.station
        return (
          <group key={s.id} name={`station-marker-${s.id}`} position={s.anchor} userData={{ stationMarker: s.id }}>
            <mesh geometry={poleGeo} material={mat} userData={{ stationId: s.id }} />
            <mesh geometry={flagGeo} material={mat} userData={{ stationId: s.id }} />
          </group>
        )
      })}
    </group>
  )
}

/** Transform gizmo for the current selection; commits on release. */
function SelectionGizmo() {
  const scene = useThree((s) => s.scene)
  const selection = useEditorStore((s) => s.selection)
  const gizmo = useEditorStore((s) => s.gizmo)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const world = useWorldStore((s) => s.world)
  const [object, setObject] = useState<THREE.Object3D | null>(null)
  const tc = useRef<{ axis: string | null } | null>(null)

  useEffect(() => {
    if (!selection) return setObject(null)
    let found: THREE.Object3D | null = null
    scene.traverse((o) => {
      if (found) return
      if (selection.kind === 'prop' && o.userData.propId === selection.id) found = o
      if (selection.kind === 'station' && o.userData.stationMarker === selection.id) found = o
      if (selection.kind === 'trackPoint' && o.userData.trackPoint === selection.index) found = o
    })
    setObject(found)
  }, [selection, scene, world])

  useFrame(() => {
    gizmoState.axis = tc.current?.axis ?? null
  })

  if (!object || !selection) return null
  const mode = selection.kind === 'prop' ? gizmo : 'translate'

  const onMouseUp = () => {
    const hf = useWorldStore.getState().derived?.heightfield
    const { snapToTerrain } = useEditorStore.getState()
    const pos = object.position.clone()
    if (selection.kind === 'prop') {
      if (snapToTerrain && hf && gizmo === 'translate') pos.y = hf.heightAt(pos.x, pos.z) - 0.02
      commitWorld((w) => ({
        ...w,
        props: w.props.map((p) =>
          p.id === selection.id
            ? { ...p, position: v3(pos), rotation: [round(object.rotation.x, 3), round(object.rotation.y, 3), round(object.rotation.z, 3)], scale: round(object.scale.x) }
            : p,
        ),
      }))
    } else if (selection.kind === 'station') {
      commitWorld((w) => ({ ...w, stations: w.stations.map((s) => (s.id === selection.id ? { ...s, anchor: v3(pos) } : s)) }))
    } else if (selection.kind === 'trackPoint') {
      commitWorld((w) => ({
        ...w,
        track: { ...w.track, points: w.track.points.map((p, i) => (i === selection.index ? { p: v3(pos) } : p)) },
      }))
    }
  }

  return (
    <TransformControls
      ref={tc as never}
      object={object}
      mode={mode}
      size={0.8}
      translationSnap={snapToGrid ? 1 : null}
      rotationSnap={snapToGrid ? Math.PI / 12 : null}
      showY={selection.kind !== 'station'}
      onMouseUp={onMouseUp}
    />
  )
}
