export type Vec3 = [number, number, number]

export interface TerrainParams {
  seed: number
  /** Island shore radius in world units. */
  radius: number
  peakHeight: number
  /** Profile exponent: >1 = concave slopes, <1 = domed. */
  profilePower: number
  terraceStep: number
  /** 0 = smooth ramps, 1 = vertical cliffs (fraction of each step that is flat). */
  terraceFlatness: number
  noiseScale: number
  noiseAmount: number
  /** Half size of the generated square in world units. */
  extent: number
  resolution: number
}

export interface TrackPoint {
  p: Vec3
}

export interface TrackData {
  points: TrackPoint[]
  /** Terrain deeper than this above the rail makes a tunnel. */
  tunnelDepth: number
  /** Rail higher than this above the terrain makes a bridge. */
  bridgeHeight: number
  /**
   * Optional pair of portal gates. The train enters the exit gate, the track
   * between the gates is hidden, and it reappears from the entry gate.
   */
  warp?: { exit: Vec3; entry: Vec3 }
}

export interface CameraShot {
  position: Vec3
  target: Vec3
}

export type StationBuilding = 'harbor' | 'woodland' | 'mine' | 'village' | 'lighthouse'

export interface StationDef {
  id: string
  name: string
  /** Station anchor; the train stops at the nearest point on the track. */
  anchor: Vec3
  contentId: string
  building: StationBuilding
  /** Which side of the track the building sits on (1 = left, -1 = right). Defaults to uphill. */
  side?: 1 | -1
  camera?: CameraShot
}

export interface PropInstance {
  id: string
  model: string
  position: Vec3
  rotation: Vec3
  scale: number
  name?: string
}

export interface ScatterLayer {
  id: string
  model: string
  /** Packed [x, y, z, rotY, scale] per instance. */
  instances: number[]
}

export interface AtmosphereData {
  sunDirection: Vec3
  sunColor: string
  sunIntensity: number
  ambientSky: string
  ambientGround: string
  ambientIntensity: number
  skyTop: string
  skyHorizon: string
  fogColor: string
  fogNear: number
  fogFar: number
  tiltShift: number
}

export interface WaterData {
  level: number
  shallow: string
  deep: string
  foam: string
}

export interface WorldData {
  version: 1
  terrain: TerrainParams
  water: WaterData
  track: TrackData
  stations: StationDef[]
  props: PropInstance[]
  scatter: ScatterLayer[]
  atmosphere: AtmosphereData
  overview: CameraShot
}
