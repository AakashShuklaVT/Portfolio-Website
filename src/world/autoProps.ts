import * as THREE from 'three/webgpu'
import type { DerivedWorld } from './buildWorld'
import type { PropInstance, Vec3 } from './types'

/** Seeds hand-feeling details around each station: a pier and boats at the harbour, carts at the mine... */
export function autoProps(derived: DerivedWorld): PropInstance[] {
  const props: PropInstance[] = []
  const { heightfield: hf } = derived
  let n = 0
  const add = (model: string, pos: THREE.Vector3, yaw: number, scale = 1, onGround = true) => {
    const y = onGround ? hf.heightAt(pos.x, pos.z) - 0.02 : pos.y
    props.push({
      id: `${model}-${++n}`,
      model,
      position: [+pos.x.toFixed(2), +y.toFixed(2), +pos.z.toFixed(2)] as Vec3,
      rotation: [0, +yaw.toFixed(3), 0],
      scale,
    })
  }

  for (const s of derived.stations) {
    const outward = new THREE.Vector3(s.position.x, 0, s.position.z).normalize()
    const yawOut = Math.atan2(outward.x, outward.z)
    const along = s.tangent
    const at = (o: number, t: number, base = s.position) => base.clone().addScaledVector(outward, o).addScaledVector(along, t)

    switch (s.def.building) {
      case 'harbor': {
        // Walk outward until we reach the water's edge, then build the pier from there.
        let edge = 3
        while (edge < 30 && hf.heightAt(at(edge, -4).x, at(edge, -4).z) > 0.3) edge += 0.5
        const pierStart = at(edge - 2.5, -4)
        pierStart.y = 0.15
        add('pier', pierStart, yawOut, 1, false)
        const boat1 = at(edge + 9, -6.5)
        boat1.y = 0
        add('boat', boat1, yawOut + 0.4, 1, false)
        const boat2 = at(edge + 14, 3)
        boat2.y = 0
        add('boat', boat2, yawOut - 1.2, 0.85, false)
        add('crates', s.buildingPosition.clone().addScaledVector(along, 5.5), 0.3)
        break
      }
      case 'woodland':
        add('crates', s.buildingPosition.clone().addScaledVector(along, -4), 1.1, 0.9)
        break
      case 'mine':
        add('mine-cart', s.buildingPosition.clone().addScaledVector(along, 4), Math.atan2(along.x, along.z))
        add('crates', s.buildingPosition.clone().addScaledVector(along, 5.8).addScaledVector(s.side, 1.2), 0.6, 0.9)
        break
      case 'village':
        for (let i = -1; i <= 1; i++) {
          add('fence', s.buildingPosition.clone().addScaledVector(s.side, 4).addScaledVector(along, i * 3), Math.atan2(along.x, along.z) + Math.PI / 2)
        }
        break
      case 'lighthouse':
        add('crates', s.buildingPosition.clone().addScaledVector(along, -3.2), 0.2, 0.8)
        break
    }
  }
  return props
}
