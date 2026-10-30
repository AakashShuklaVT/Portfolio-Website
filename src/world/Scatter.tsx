import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { getNatureMaterial } from '../materials/natureMaterials'
import { useWorldStore } from '../store/useWorldStore'
import { MODEL_MAP, getModelGeometry } from './models'
import type { ScatterLayer } from './types'

const STRIDE = 5
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const p = new THREE.Vector3()
const s = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export function writeInstanceMatrices(mesh: THREE.InstancedMesh, instances: number[]) {
  const count = instances.length / STRIDE
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE
    p.set(instances[o], instances[o + 1], instances[o + 2])
    q.setFromAxisAngle(UP, instances[o + 3])
    s.setScalar(instances[o + 4])
    mesh.setMatrixAt(i, m.compose(p, q, s))
  }
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

/** Extra capacity so the editor brush can add instances without reallocating every stroke. */
const HEADROOM = 512

function ScatterLayerMesh({ layer }: { layer: ScatterLayer }) {
  const def = MODEL_MAP.get(layer.model)
  const count = layer.instances.length / STRIDE
  const capacity = Math.ceil((count + HEADROOM) / HEADROOM) * HEADROOM
  const mesh = useMemo(() => {
    const geometry = getModelGeometry(layer.model)
    const material = getNatureMaterial(def?.wind ?? false, def?.height ?? 1)
    const instanced = new THREE.InstancedMesh(geometry, material, capacity)
    instanced.castShadow = def?.shadow ?? true
    instanced.receiveShadow = true
    instanced.name = `scatter:${layer.id}`
    instanced.userData.scatterLayer = layer.id
    return instanced
    // Rebuild only when the capacity bucket changes.
  }, [layer.model, layer.id, capacity, def])

  useEffect(() => writeInstanceMatrices(mesh, layer.instances), [mesh, layer.instances])
  useEffect(() => () => mesh.dispose(), [mesh])

  return <primitive object={mesh} />
}

export function Scatter() {
  const layers = useWorldStore((st) => st.world?.scatter)
  if (!layers) return null
  return (
    <group name="scatter">
      {layers.map((layer) => (
        <ScatterLayerMesh key={layer.id} layer={layer} />
      ))}
    </group>
  )
}
