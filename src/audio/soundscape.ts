// Procedural soundscape built on the Web Audio API. Everything is synthesised,
// so there are no audio files to load or license.

let ctx: AudioContext | null = null
let master: GainNode
let seaGain: GainNode
let windGain: GainNode
let noiseBuffer: AudioBuffer

const MASTER_VOLUME = 0.55

function createNoiseBuffer(c: AudioContext) {
  // Brown-ish noise: smoother and warmer than white noise.
  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.04 * white) / 1.04
    data[i] = last * 3.2
  }
  return buffer
}

function loopNoise(filterType: BiquadFilterType, frequency: number, q: number, out: AudioNode) {
  const src = ctx!.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = ctx!.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = frequency
  filter.Q.value = q
  src.connect(filter).connect(out)
  src.start()
  return filter
}

/** Slow amplitude swell, like waves rolling in. */
function addSwell(target: GainNode, rate: number, depth: number) {
  const lfo = ctx!.createOscillator()
  lfo.frequency.value = rate
  const amount = ctx!.createGain()
  amount.gain.value = depth
  lfo.connect(amount).connect(target.gain)
  lfo.start()
}

function init() {
  if (ctx) return
  ctx = new AudioContext()
  noiseBuffer = createNoiseBuffer(ctx)
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  seaGain = ctx.createGain()
  seaGain.gain.value = 0.25
  seaGain.connect(master)
  loopNoise('lowpass', 420, 0.6, seaGain)
  addSwell(seaGain, 0.12, 0.12)

  windGain = ctx.createGain()
  windGain.gain.value = 0.05
  windGain.connect(master)
  const windFilter = loopNoise('bandpass', 700, 0.9, windGain)
  const windLfo = ctx.createOscillator()
  windLfo.frequency.value = 0.07
  const windLfoAmount = ctx.createGain()
  windLfoAmount.gain.value = 260
  windLfo.connect(windLfoAmount).connect(windFilter.frequency)
  windLfo.start()
}

export const soundscape = {
  /** Must be called from a user gesture the first time (autoplay policy). */
  async setEnabled(enabled: boolean) {
    if (enabled) init()
    if (!ctx) return
    if (enabled && ctx.state === 'suspended') await ctx.resume()
    master.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, ctx.currentTime, 0.4)
  },

  get active() {
    return !!ctx && ctx.state === 'running' && master.gain.value > 0.01
  },

  /** 0 at sea level .. 1 at the summit: less surf, more wind as the train climbs. */
  setAltitude(t: number) {
    if (!ctx) return
    const now = ctx.currentTime
    seaGain.gain.setTargetAtTime(0.28 * (1 - t * 0.75), now, 0.5)
    windGain.gain.setTargetAtTime(0.04 + t * 0.16, now, 0.5)
  },

  /** A short filtered noise burst: one "chuff" of the engine. */
  chuff(strength: number) {
    if (!this.active) return
    const c = ctx!
    const t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 380 + Math.random() * 120
    filter.Q.value = 1.2
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.32 * strength, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    src.connect(filter).connect(g).connect(master)
    src.start(t, Math.random())
    src.stop(t + 0.25)
  },

  /** Wheels crossing a rail joint: a quick "clickety" pair. */
  clack(strength: number) {
    if (!this.active) return
    const c = ctx!
    for (const [offset, level] of [
      [0, 1],
      [0.09, 0.7],
    ] as const) {
      const t = c.currentTime + offset
      const src = c.createBufferSource()
      src.buffer = noiseBuffer
      const filter = c.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1800
      const g = c.createGain()
      g.gain.setValueAtTime(0.14 * strength * level, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      src.connect(filter).connect(g).connect(master)
      src.start(t, Math.random())
      src.stop(t + 0.06)
    }
  },

  /** Two detuned tones with a soft attack: a little steam whistle. */
  whistle() {
    if (!this.active) return
    const c = ctx!
    const t = c.currentTime
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.09, t + 0.08)
    g.gain.setValueAtTime(0.09, t + 0.55)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
    g.connect(master)
    for (const f of [587, 740, 880]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(f * 0.97, t)
      o.frequency.linearRampToValueAtTime(f, t + 0.1)
      o.connect(g)
      o.start(t)
      o.stop(t + 0.95)
    }
  },

  brake() {
    if (!this.active) return
    const c = ctx!
    const t = c.currentTime
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2300, t)
    o.frequency.linearRampToValueAtTime(1900, t + 1.2)
    const vib = c.createOscillator()
    vib.frequency.value = 9
    const vibAmount = c.createGain()
    vibAmount.gain.value = 25
    vib.connect(vibAmount).connect(o.frequency)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.025, t + 0.2)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3)
    o.connect(g).connect(master)
    o.start(t)
    vib.start(t)
    o.stop(t + 1.4)
    vib.stop(t + 1.4)
  },

  /** Short musical motif played on arrival (pentatonic, soft bell-like sines). */
  chime(notes: number[] = [72, 76, 79]) {
    if (!this.active) return
    const c = ctx!
    notes.forEach((midi, i) => {
      const t = c.currentTime + i * 0.16
      const f = 440 * Math.pow(2, (midi - 69) / 12)
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.08, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 1.2)
    })
  },
}
