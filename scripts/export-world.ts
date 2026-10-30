// Writes the procedural default world (terrain, track, stations, auto forest
// and props) to public/data/world.json. Overwrites any editor changes.
// npx tsx scripts/export-world.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { createDefaultWorld } from '../src/world/defaultWorld'
import { buildDerivedWorld } from '../src/world/buildWorld'
import { autoScatter } from '../src/world/autoScatter'
import { autoProps } from '../src/world/autoProps'

const base = createDefaultWorld()
const derived = buildDerivedWorld(base)
const world = { ...base, scatter: autoScatter(base, derived), props: autoProps(derived) }

const json = JSON.stringify(world, null, 2).replace(/\[\s+([-\d.e,\s]+?)\s+\]/g, (_, inner: string) => `[${inner.replace(/\s+/g, ' ')}]`)
mkdirSync('public/data', { recursive: true })
writeFileSync('public/data/world.json', json + '\n')
console.log(`wrote public/data/world.json (${(json.length / 1024).toFixed(0)} KB)`)
