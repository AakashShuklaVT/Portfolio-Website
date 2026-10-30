import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { mulberry32 } from '../lib/noise'
import { createTerrainMaterial } from '../materials/terrainMaterial'
import { useWorldStore } from '../store/useWorldStore'
import type { Heightfield } from './terrainGen'

/** Skip far-offshore faces that sit entirely below this depth. */
const SEA_FLOOR_CULL = -5.5

function buildTerrainGeometry(hf: Heightfield) {
  const { res, extent, cell, heights, path } = hf
  const n = res + 1
  const rand = mulberry32(1234)
  const pos: number[] = []
  const nor: number[] = []
  const face: number[] = []

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()

  const pushTri = (i0: number, i1: number, i2: number) => {
    const k = [i0, i1, i2]
    const ys = k.map((v) => heights[v])
    if (ys[0] < SEA_FLOOR_CULL && ys[1] < SEA_FLOOR_CULL && ys[2] < SEA_FLOOR_CULL) return
    const vs = [a, b, c]
    k.forEach((v, idx) => vs[idx].set(-extent + (v % n) * cell, heights[v], -extent + Math.floor(v / n) * cell))
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const normal = ab.cross(ac).normalize()
    const cy = (ys[0] + ys[1] + ys[2]) / 3
    const pm = (path[i0] + path[i1] + path[i2]) / 3
    const r = rand()
    for (const v of vs) {
      pos.push(v.x, v.y, v.z)
      nor.push(normal.x, normal.y, normal.z)
      face.push(cy, pm, r)
    }
  }

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const i00 = j * n + i
      const i10 = i00 + 1
      const i01 = i00 + n
      const i11 = i01 + 1
      pushTri(i00, i01, i10)
      pushTri(i11, i10, i01)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geometry.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 3))
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

export function Terrain() {
  const heightfield = useWorldStore((s) => s.derived?.heightfield)
  const material = useMemo(() => createTerrainMaterial(), [])
  const geometry = useMemo(() => (heightfield ? buildTerrainGeometry(heightfield) : null), [heightfield])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return <mesh name="terrain" geometry={geometry} material={material} receiveShadow castShadow userData={{ terrain: true }} />
}
