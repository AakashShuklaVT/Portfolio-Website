// Prints the railway layout of the default world: run types, lengths and station spacing.
// npx tsx scripts/inspect-world.ts
import { createDefaultWorld } from '../src/world/defaultWorld'
import { buildDerivedWorld } from '../src/world/buildWorld'

const t0 = performance.now()
const world = createDefaultWorld()
const derived = buildDerivedWorld(world)
const { track, stations, heightfield } = derived
console.log(`built in ${(performance.now() - t0).toFixed(0)} ms, track length ${track.length.toFixed(1)}`)
const names = ['ground', 'tunnel', 'bridge']
for (const r of track.runs) console.log(`  ${names[r.kind].padEnd(7)} ${r.start.toFixed(1).padStart(7)} -> ${r.end.toFixed(1).padStart(7)}  (${(r.end - r.start).toFixed(1)})`)
stations.forEach((s, i) => {
  const next = stations[(i + 1) % stations.length]
  const p = s.position
  console.log(`  ${s.def.id.padEnd(10)} d=${s.distance.toFixed(1).padStart(6)} y=${p.y.toFixed(1)} ground=${heightfield.heightAt(p.x, p.z).toFixed(2)} -> next ${track.ahead(s.distance, next.distance).toFixed(1)}`)
})
