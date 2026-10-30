import { DEG, lerp } from '../lib/math'
import type { TrackPoint, WorldData } from './types'

// Keyframes (angle in degrees, radius, rail height) for the default railway.
// It climbs the terraces counter-clockwise from the harbour to the summit,
// then dives into the mountain and spirals back down to the shore in a tunnel.
const KEYS: [number, number, number][] = [
  [-20, 55, 1.4],
  [0, 55, 1.4], // Harbor
  [15, 54.5, 1.4],
  [75, 41.5, 7.4],
  [100, 41.5, 7.4], // Woodland
  [120, 41.5, 7.4],
  [185, 29.5, 13.4],
  [205, 23.5, 13.4], // into the mine
  [220, 24.5, 13.4],
  [235, 29, 13.4],
  [245, 29.5, 13.4], // Mine stop
  [260, 28, 13.4],
  [315, 17.5, 19.4],
  [330, 17.5, 19.4], // Village
  [345, 17.5, 19.4],
  [425, 8, 25.4],
  [460, 7.6, 25.4], // Lighthouse
  [478, 7.8, 25.4],
  [505, 8.5, 20.5], // trench into the descent tunnel
  [530, 12, 13],
  [575, 20, 6],
  [625, 32, 3],
  [665, 42, 1.8],
  [685, 47.5, 1.4],
  [705, 53, 1.4],
]

function keyAt(deg: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a0, r0, y0] = KEYS[i]
    const [a1, r1, y1] = KEYS[i + 1]
    if (deg >= a0 && deg <= a1) {
      const t = (deg - a0) / (a1 - a0)
      // smooth ramp ends so platforms stay level
      const s = t * t * (3 - 2 * t)
      return { r: lerp(r0, r1, t), y: lerp(y0, y1, s) }
    }
  }
  const [, r, y] = KEYS[KEYS.length - 1]
  return { r, y }
}

export const polar = (deg: number, r: number, y: number): [number, number, number] => [
  +(Math.sin(deg * DEG) * r).toFixed(3),
  +y.toFixed(3),
  +(Math.cos(deg * DEG) * r).toFixed(3),
]

function buildTrackPoints(): TrackPoint[] {
  const points: TrackPoint[] = []
  for (let deg = -15; deg < 705; deg += 10) {
    const { r, y } = keyAt(deg)
    points.push({ p: polar(deg, r, y) })
  }
  return points
}

export function createDefaultWorld(): WorldData {
  return {
    version: 1,
    terrain: {
      seed: 7,
      radius: 64,
      peakHeight: 30,
      profilePower: 1.1,
      terraceStep: 6,
      terraceFlatness: 0.62,
      noiseScale: 0.035,
      noiseAmount: 0.05,
      extent: 90,
      resolution: 220,
    },
    water: { level: 0, shallow: '#7fd3d1', deep: '#2f8ca8', foam: '#f6fbf7' },
    track: { points: buildTrackPoints(), tunnelDepth: 3.2, bridgeHeight: 3.5 },
    stations: [
      { id: 'harbor', name: 'Harbor Station', anchor: polar(0, 55, 1.4), contentId: 'about', building: 'harbor' },
      { id: 'woodland', name: 'Woodland Halt', anchor: polar(100, 41.5, 7.4), contentId: 'projects', building: 'woodland' },
      { id: 'mine', name: 'Mine Tunnel Stop', anchor: polar(242, 29.4, 13.4), contentId: 'lab', building: 'mine' },
      { id: 'village', name: 'Village Station', anchor: polar(330, 17.5, 19.4), contentId: 'experience', building: 'village' },
      { id: 'lighthouse', name: 'Lighthouse Summit', anchor: polar(458, 7.6, 25.4), contentId: 'contact', building: 'lighthouse' },
    ],
    props: [],
    scatter: [],
    atmosphere: {
      sunDirection: [0.55, 0.75, 0.38],
      sunColor: '#fff1d9',
      sunIntensity: 2.6,
      ambientSky: '#fff4e0',
      ambientGround: '#86a46e',
      ambientIntensity: 1.25,
      skyTop: '#8cc6e8',
      skyHorizon: '#fbe3c4',
      fogColor: '#f3dcc0',
      fogNear: 120,
      fogFar: 330,
      tiltShift: 0.6,
    },
    overview: { position: [95, 85, 125], target: [0, 8, 0] },
  }
}
