import { useEffect, useRef, useState } from 'react'
import { useEditorMode } from '../store/useEditorMode'
import { useWorldStore } from '../store/useWorldStore'
import { useRideStore } from '../store/useRideStore'
import { CONTENT } from '../stations/content'
import { travelTo } from '../stations/travel'
import { MODELS } from '../world/models'
import type { StationBuilding, StationDef, TrackPoint, Vec3, WorldData } from '../world/types'
import { clearScatterNearTrack, resnapToTerrain } from './brush'
import { getThumbnails } from './thumbnails'
import { commitWorld, readAutosave, uid, useEditorStore, type Tool } from './useEditorStore'
import { LevaPanels } from './LevaPanels'
import { editorCamera } from './editorCamera'
import './editor.css'

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Select', key: 'V', hint: 'Click props to select; W/E/R to move, rotate, scale' },
  { id: 'place', label: 'Place', key: 'B', hint: 'Click the terrain to place the library model' },
  { id: 'scatter', label: 'Scatter', key: 'S', hint: 'Paint instances. Right-drag orbits, middle-drag pans' },
  { id: 'erase', label: 'Erase', key: 'X', hint: 'Paint to remove scattered instances' },
  { id: 'track', label: 'Track', key: 'T', hint: 'Click a control point and drag the gizmo' },
  { id: 'station', label: 'Stations', key: 'K', hint: 'Click a station flag to edit it' },
]

const fmt = (w: WorldData) => JSON.stringify(w)

async function saveToProject() {
  const world = useWorldStore.getState().world
  if (!world) return
  const res = await fetch('/__editor/save-world', { method: 'POST', body: fmt(world) })
  const json = await res.json().catch(() => ({ ok: false }))
  const store = useEditorStore.getState()
  if (json.ok) {
    store.markSaved()
    store.setStatus('Saved to public/data/world.json')
  } else store.setStatus(`Save failed: ${json.error ?? res.status}`)
}

function downloadJson() {
  const world = useWorldStore.getState().world
  if (!world) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(world, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'world.json' })
  a.click()
  URL.revokeObjectURL(url)
}

export default function EditorPanels() {
  const mode = useEditorMode((s) => s.mode)
  const setMode = useEditorMode((s) => s.setMode)
  useShortcuts()

  if (mode === 'play') {
    return (
      <div className="ed-play-banner">
        <span>Play-testing</span>
        <button onClick={() => setMode('edit')}>Back to editor (P)</button>
      </div>
    )
  }
  return (
    <div className="ed">
      <Toolbar />
      <aside className="ed-left">
        <LeftTabs />
        <Inspector />
      </aside>
      <LevaPanels />
      <StatusBar />
    </div>
  )
}

function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const gizmo = useEditorStore((s) => s.gizmo)
  const setGizmo = useEditorStore((s) => s.setGizmo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const dirty = useEditorStore((s) => s.dirty)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const snapToTerrain = useEditorStore((s) => s.snapToTerrain)
  const setSnap = useEditorStore((s) => s.setSnap)
  const fileInput = useRef<HTMLInputElement>(null)

  const onImport = async (file: File) => {
    try {
      const world = JSON.parse(await file.text()) as WorldData
      if (world.version !== 1) throw new Error('unknown version')
      commitWorld(() => world)
      useEditorStore.getState().setStatus(`Imported ${file.name}`)
    } catch (e) {
      useEditorStore.getState().setStatus(`Import failed: ${String(e)}`)
    }
  }

  return (
    <div className="ed-toolbar" role="toolbar" aria-label="Editor tools">
      <div className="ed-group">
        {TOOLS.map((t) => (
          <button key={t.id} className={tool === t.id ? 'on' : ''} title={`${t.hint} (${t.key})`} onClick={() => setTool(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="ed-group">
        {(['translate', 'rotate', 'scale'] as const).map((g, i) => (
          <button key={g} className={gizmo === g ? 'on' : ''} title={`${g} (${'WER'[i]})`} onClick={() => setGizmo(g)}>
            {'⇄⟳⤢'[i]}
          </button>
        ))}
        <button className={snapToGrid ? 'on' : ''} title="Snap gizmo to a 1m grid / 15°" onClick={() => setSnap({ snapToGrid: !snapToGrid })}>
          Grid
        </button>
        <button className={snapToTerrain ? 'on' : ''} title="Drop moved props onto the terrain" onClick={() => setSnap({ snapToTerrain: !snapToTerrain })}>
          Ground
        </button>
      </div>
      <div className="ed-group">
        <button disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={() => useEditorStore.getState().undo()}>
          Undo
        </button>
        <button disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={() => useEditorStore.getState().redo()}>
          Redo
        </button>
      </div>
      <div className="ed-group">
        <button className="primary" title="Write public/data/world.json (Ctrl+S)" onClick={saveToProject}>
          Save{dirty ? ' •' : ''}
        </button>
        <button title="Download world.json" onClick={downloadJson}>
          Export
        </button>
        <button title="Load a world.json" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        <button title="Play-test the visitor experience (P)" onClick={() => useEditorMode.getState().setMode('play')}>
          ▶ Play
        </button>
      </div>
    </div>
  )
}

function LeftTabs() {
  const [tab, setTab] = useState<'hierarchy' | 'library'>('hierarchy')
  return (
    <section className="ed-panel">
      <div className="ed-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'hierarchy'} onClick={() => setTab('hierarchy')}>
          Hierarchy
        </button>
        <button role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')}>
          Model library
        </button>
      </div>
      {tab === 'hierarchy' ? <Hierarchy /> : <Library />}
    </section>
  )
}

function Hierarchy() {
  const world = useWorldStore((s) => s.world)
  const selection = useEditorStore((s) => s.selection)
  const select = useEditorStore((s) => s.select)
  const [filter, setFilter] = useState('')
  if (!world) return null
  const props = world.props.filter((p) => !filter || (p.name ?? p.id).toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="ed-scroll">
      <details open>
        <summary>Stations ({world.stations.length})</summary>
        <ul className="ed-list">
          {world.stations.map((s) => (
            <li key={s.id}>
              <button className={selection?.kind === 'station' && selection.id === s.id ? 'on' : ''} onClick={() => select({ kind: 'station', id: s.id })}>
                🚉 {s.name}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary>Props ({world.props.length})</summary>
        <input className="ed-input" placeholder="Filter props…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <ul className="ed-list">
          {props.map((p) => (
            <li key={p.id}>
              <button className={selection?.kind === 'prop' && selection.id === p.id ? 'on' : ''} onClick={() => select({ kind: 'prop', id: p.id })}>
                ▫ {p.name ?? p.id}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary>Scatter layers ({world.scatter.length})</summary>
        <ul className="ed-list">
          {world.scatter.map((l) => (
            <li key={l.id} className="ed-row">
              <span>🌲 {l.model}</span>
              <span className="ed-muted">{l.instances.length / 5}</span>
              <button title="Remove every instance in this layer" onClick={() => commitWorld((w) => ({ ...w, scatter: w.scatter.filter((x) => x.id !== l.id) }))}>
                Clear
              </button>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Track ({world.track.points.length} points)</summary>
        <ul className="ed-list">
          {world.track.points.map((_, i) => (
            <li key={i}>
              <button
                className={selection?.kind === 'trackPoint' && selection.index === i ? 'on' : ''}
                onClick={() => {
                  useEditorStore.getState().setTool('track')
                  select({ kind: 'trackPoint', index: i })
                }}
              >
                ● Point {i}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function Library() {
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null)
  const [tag, setTag] = useState<string>('all')
  const [query, setQuery] = useState('')
  const tool = useEditorStore((s) => s.tool)
  const placeModel = useEditorStore((s) => s.placeModel)
  const brushModel = useEditorStore((s) => s.brush.model)

  useEffect(() => {
    getThumbnails()
      .then(setThumbs)
      .catch(() => setThumbs(new Map()))
  }, [])

  const tags = ['all', ...new Set(MODELS.flatMap((m) => m.tags))]
  const models = MODELS.filter((m) => (tag === 'all' || m.tags.includes(tag as never)) && m.label.toLowerCase().includes(query.toLowerCase()))
  const active = tool === 'scatter' ? brushModel : placeModel

  const pick = (id: string) => {
    const store = useEditorStore.getState()
    if (store.tool === 'scatter') store.setBrush({ model: id })
    else {
      store.setPlaceModel(id)
      store.setTool('place')
    }
  }

  return (
    <div className="ed-scroll">
      <input className="ed-input" placeholder="Search models…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="ed-chips">
        {tags.map((t) => (
          <button key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="ed-library">
        {models.map((m) => (
          <button key={m.id} className={active === m.id ? 'on' : ''} onClick={() => pick(m.id)} title={tool === 'scatter' ? 'Use as scatter brush' : 'Place this model'}>
            {thumbs?.get(m.id) ? <img src={thumbs.get(m.id)} alt="" /> : <span className="ed-thumb-placeholder" />}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <p className="ed-muted ed-note">Tip: with the Scatter tool active, picking a model sets the brush.</p>
    </div>
  )
}

function NumberField({ label, value, onChange, step = 0.1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => e.target.value !== '' && onChange(+e.target.value)} />
    </label>
  )
}

function Vec3Field({ label, value, onChange }: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <div className="ed-vec">
      <span>{label}</span>
      {value.map((c, i) => (
        <input key={i} type="number" step={0.1} value={c} aria-label={`${label} ${'xyz'[i]}`} onChange={(e) => onChange(value.map((v, k) => (k === i ? +e.target.value : v)) as Vec3)} />
      ))}
    </div>
  )
}

function Inspector() {
  const selection = useEditorStore((s) => s.selection)
  const tool = useEditorStore((s) => s.tool)
  return (
    <section className="ed-panel ed-inspector">
      <h3>{selection ? 'Inspector' : `${TOOLS.find((t) => t.id === tool)?.label} tool`}</h3>
      <div className="ed-scroll">
        {selection?.kind === 'prop' && <PropInspector id={selection.id} />}
        {selection?.kind === 'station' && <StationInspector id={selection.id} />}
        {selection?.kind === 'trackPoint' && <TrackPointInspector index={selection.index} />}
        {!selection && <ToolSettings />}
      </div>
    </section>
  )
}

function PropInspector({ id }: { id: string }) {
  const prop = useWorldStore((s) => s.world?.props.find((p) => p.id === id))
  const select = useEditorStore((s) => s.select)
  if (!prop) return <p className="ed-muted">Prop not found.</p>
  const update = (patch: Partial<typeof prop>) => commitWorld((w) => ({ ...w, props: w.props.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  return (
    <>
      <label className="ed-field">
        <span>Name</span>
        <input defaultValue={prop.name ?? ''} placeholder={prop.id} onBlur={(e) => update({ name: e.target.value || undefined })} />
      </label>
      <p className="ed-muted">Model: {prop.model}</p>
      <Vec3Field label="Position" value={prop.position} onChange={(position) => update({ position })} />
      <NumberField label="Rotation Y" value={prop.rotation[1]} step={0.05} onChange={(v) => update({ rotation: [prop.rotation[0], v, prop.rotation[2]] })} />
      <NumberField label="Scale" value={prop.scale} step={0.05} onChange={(scale) => update({ scale })} />
      <div className="ed-actions">
        <button
          onClick={() => {
            const hf = useWorldStore.getState().derived?.heightfield
            if (hf) update({ position: [prop.position[0], +(hf.heightAt(prop.position[0], prop.position[2]) - 0.02).toFixed(2), prop.position[2]] })
          }}
        >
          Drop to ground
        </button>
        <button
          onClick={() => {
            const copy = { ...prop, id: uid(prop.model), name: prop.name ? `${prop.name} copy` : undefined, position: [prop.position[0] + 2, prop.position[1], prop.position[2] + 2] as Vec3 }
            commitWorld((w) => ({ ...w, props: [...w.props, copy] }))
            select({ kind: 'prop', id: copy.id })
          }}
        >
          Duplicate
        </button>
        <button
          className="danger"
          onClick={() => {
            commitWorld((w) => ({ ...w, props: w.props.filter((p) => p.id !== id) }))
            select(null)
          }}
        >
          Delete
        </button>
      </div>
    </>
  )
}

const BUILDINGS: StationBuilding[] = ['harbor', 'woodland', 'mine', 'village', 'lighthouse']

function StationInspector({ id }: { id: string }) {
  const station = useWorldStore((s) => s.world?.stations.find((st) => st.id === id))
  const select = useEditorStore((s) => s.select)
  if (!station) return <p className="ed-muted">Station not found.</p>
  const update = (patch: Partial<StationDef>) => commitWorld((w) => ({ ...w, stations: w.stations.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  return (
    <>
      <label className="ed-field">
        <span>Name</span>
        <input defaultValue={station.name} key={station.id} onBlur={(e) => e.target.value && update({ name: e.target.value })} />
      </label>
      <label className="ed-field">
        <span>Content</span>
        <select value={station.contentId} onChange={(e) => update({ contentId: e.target.value })}>
          {Object.keys(CONTENT).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="ed-field">
        <span>Building</span>
        <select value={station.building} onChange={(e) => update({ building: e.target.value as StationBuilding })}>
          {BUILDINGS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className="ed-field">
        <span>Side</span>
        <select value={station.side ?? 0} onChange={(e) => update({ side: +e.target.value === 0 ? undefined : (+e.target.value as 1 | -1) })}>
          <option value={0}>auto (uphill)</option>
          <option value={1}>left</option>
          <option value={-1}>right</option>
        </select>
      </label>
      <p className="ed-muted">Camera: {station.camera ? 'custom shot' : 'automatic'}</p>
      <div className="ed-actions">
        <button
          title="Use the current editor view as this station's camera shot"
          onClick={() => {
            const shot = editorCamera.capture()
            if (shot) update({ camera: shot })
            useEditorStore.getState().setStatus(`Captured camera for ${station.name}`)
          }}
        >
          Capture view
        </button>
        {station.camera && <button onClick={() => update({ camera: undefined })}>Auto camera</button>}
        <button
          onClick={() => {
            const shot = useWorldStore.getState().derived?.stations.find((s) => s.def.id === id)?.camera
            if (shot) editorCamera.goTo(shot)
          }}
        >
          Look through
        </button>
        <button
          onClick={() => {
            useEditorMode.getState().setMode('play')
            useRideStore.setState({ state: 'INTRO' })
            travelTo(id, true)
          }}
        >
          Preview arrival
        </button>
        <button
          className="danger"
          onClick={() => {
            commitWorld((w) => ({ ...w, stations: w.stations.filter((s) => s.id !== id) }))
            select(null)
          }}
        >
          Delete
        </button>
      </div>
    </>
  )
}

function TrackPointInspector({ index }: { index: number }) {
  const points = useWorldStore((s) => s.world?.track.points)
  const select = useEditorStore((s) => s.select)
  if (!points?.[index]) return <p className="ed-muted">Point not found.</p>
  const p = points[index].p
  const setPoints = (fn: (pts: TrackPoint[]) => TrackPoint[]) => commitWorld((w) => ({ ...w, track: { ...w.track, points: fn(w.track.points) } }))
  return (
    <>
      <p className="ed-muted">
        Control point {index} of {points.length}
      </p>
      <Vec3Field label="Position" value={p} onChange={(v) => setPoints((pts) => pts.map((pt, i) => (i === index ? { p: v } : pt)))} />
      <div className="ed-actions">
        <button
          title="Insert a new point halfway to the next one"
          onClick={() => {
            const n = points[(index + 1) % points.length].p
            const mid = p.map((c, k) => +((c + n[k]) / 2).toFixed(2)) as Vec3
            setPoints((pts) => [...pts.slice(0, index + 1), { p: mid }, ...pts.slice(index + 1)])
            select({ kind: 'trackPoint', index: index + 1 })
          }}
        >
          Insert after
        </button>
        <button
          title="Give this point the height of the previous point"
          onClick={() => {
            const prev = points[(index - 1 + points.length) % points.length].p
            setPoints((pts) => pts.map((pt, i) => (i === index ? { p: [p[0], prev[1], p[2]] } : pt)))
          }}
        >
          Level with previous
        </button>
        <button
          className="danger"
          disabled={points.length <= 4}
          onClick={() => {
            setPoints((pts) => pts.filter((_, i) => i !== index))
            select(null)
          }}
        >
          Delete
        </button>
      </div>
      <TrackTools />
    </>
  )
}

function TrackTools() {
  const preview = useEditorMode((s) => s.previewTrain)
  return (
    <div className="ed-actions">
      <button className={preview ? 'on' : ''} onClick={() => useEditorMode.getState().setPreviewTrain(!preview)}>
        {preview ? 'Stop preview train' : 'Run preview train'}
      </button>
      <button
        title="Drop every tree and prop back onto the (re-carved) terrain"
        onClick={() => {
          const hf = useWorldStore.getState().derived?.heightfield
          if (hf) commitWorld((w) => resnapToTerrain(w, hf))
        }}
      >
        Re-snap to terrain
      </button>
      <button
        title="Remove scattered instances that now sit on the railway"
        onClick={() => {
          const hf = useWorldStore.getState().derived?.heightfield
          if (hf) commitWorld((w) => clearScatterNearTrack(w, hf))
        }}
      >
        Clear scatter on track
      </button>
    </div>
  )
}

function ToolSettings() {
  const tool = useEditorStore((s) => s.tool)
  const brush = useEditorStore((s) => s.brush)
  const setBrush = useEditorStore((s) => s.setBrush)
  const place = useEditorStore((s) => s.place)
  const setPlace = useEditorStore((s) => s.setPlace)
  const placeModel = useEditorStore((s) => s.placeModel)

  if (tool === 'scatter' || tool === 'erase') {
    return (
      <>
        {tool === 'scatter' && (
          <label className="ed-field">
            <span>Brush model</span>
            <select value={brush.model} onChange={(e) => setBrush({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Range label="Radius" min={1} max={25} step={0.5} value={brush.radius} onChange={(radius) => setBrush({ radius })} />
        {tool === 'scatter' && (
          <>
            <Range label="Density" min={1} max={12} step={1} value={brush.density} onChange={(density) => setBrush({ density })} />
            <Range label="Spacing" min={0.4} max={6} step={0.1} value={brush.spacing} onChange={(spacing) => setBrush({ spacing })} />
            <Range label="Scale min" min={0.2} max={2.5} step={0.05} value={brush.scaleMin} onChange={(scaleMin) => setBrush({ scaleMin })} />
            <Range label="Scale max" min={0.2} max={2.5} step={0.05} value={brush.scaleMax} onChange={(scaleMax) => setBrush({ scaleMax })} />
            <Range label="Slope limit (flatness)" min={0} max={1} step={0.01} value={brush.minFlat} onChange={(minFlat) => setBrush({ minFlat })} />
            <Range label="Min height" min={-5} max={40} step={0.5} value={brush.minHeight} onChange={(minHeight) => setBrush({ minHeight })} />
            <Range label="Max height" min={0} max={50} step={0.5} value={brush.maxHeight} onChange={(maxHeight) => setBrush({ maxHeight })} />
            <label className="ed-check">
              <input type="checkbox" checked={brush.randomRotation} onChange={(e) => setBrush({ randomRotation: e.target.checked })} /> Random rotation
            </label>
          </>
        )}
      </>
    )
  }
  if (tool === 'place') {
    return (
      <>
        <p className="ed-muted">Placing: {MODELS.find((m) => m.id === placeModel)?.label}. Pick another in the Model library.</p>
        <Range label="Scale min" min={0.2} max={3} step={0.05} value={place.scaleMin} onChange={(scaleMin) => setPlace({ scaleMin })} />
        <Range label="Scale max" min={0.2} max={3} step={0.05} value={place.scaleMax} onChange={(scaleMax) => setPlace({ scaleMax })} />
        <label className="ed-check">
          <input type="checkbox" checked={place.randomRotation} onChange={(e) => setPlace({ randomRotation: e.target.checked })} /> Random rotation
        </label>
      </>
    )
  }
  if (tool === 'track') {
    return (
      <>
        <p className="ed-muted">Click a white control point, then drag the gizmo. The terrain re-carves itself on release; tunnels and bridges are detected automatically.</p>
        <TrackTools />
      </>
    )
  }
  if (tool === 'station') {
    return (
      <>
        <p className="ed-muted">Click a station flag to edit it. Flags snap to the nearest point on the track.</p>
        <button
          className="ed-wide"
          onClick={() => {
            const target = editorCamera.target()
            if (!target) return
            const id = uid('station')
            commitWorld((w) => ({ ...w, stations: [...w.stations, { id, name: 'New Station', anchor: target, contentId: 'about', building: 'village' }] }))
            useEditorStore.getState().select({ kind: 'station', id })
          }}
        >
          Add station at view centre
        </button>
      </>
    )
  }
  return <p className="ed-muted">Click a prop to select it. Use the Model library to place new ones, or the Scatter tool to paint forests.</p>
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="ed-range">
      <span>
        {label} <output>{value}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

function StatusBar() {
  const status = useEditorStore((s) => s.status)
  const counts = useWorldStore((s) => {
    const w = s.world
    if (!w) return ''
    const instances = w.scatter.reduce((n, l) => n + l.instances.length / 5, 0)
    return `${w.props.length} props · ${instances} scattered · ${w.track.points.length} track points · ${w.stations.length} stations`
  })
  const [autosave] = useState(readAutosave)
  return (
    <div className="ed-status">
      <span>{counts}</span>
      {status && <span className="ed-status-msg">{status}</span>}
      {autosave && (
        <button
          title={`Autosaved ${new Date(autosave.savedAt).toLocaleString()}`}
          onClick={() => {
            commitWorld(() => autosave.world)
            useEditorStore.getState().setStatus('Restored autosave')
          }}
        >
          Restore autosave
        </button>
      )}
    </div>
  )
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      const store = useEditorStore.getState()
      const modeStore = useEditorMode.getState()
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      if (k === 'p' && !mod) return modeStore.setMode(modeStore.mode === 'edit' ? 'play' : 'edit')
      if (modeStore.mode !== 'edit') return
      if (mod && k === 'z') {
        e.preventDefault()
        return e.shiftKey ? store.redo() : store.undo()
      }
      if (mod && k === 'y') {
        e.preventDefault()
        return store.redo()
      }
      if (mod && k === 's') {
        e.preventDefault()
        return void saveToProject()
      }
      if (mod && k === 'd' && store.selection?.kind === 'prop') {
        e.preventDefault()
        const id = store.selection.id
        const prop = useWorldStore.getState().world?.props.find((p) => p.id === id)
        if (!prop) return
        const copy = { ...prop, id: uid(prop.model), position: [prop.position[0] + 2, prop.position[1], prop.position[2] + 2] as Vec3 }
        commitWorld((w) => ({ ...w, props: [...w.props, copy] }))
        return store.select({ kind: 'prop', id: copy.id })
      }
      if ((k === 'delete' || k === 'backspace') && store.selection?.kind === 'prop') {
        const id = store.selection.id
        commitWorld((w) => ({ ...w, props: w.props.filter((p) => p.id !== id) }))
        return store.select(null)
      }
      if (k === 'escape') return store.select(null)
      if (mod) return
      const tool = TOOLS.find((t) => t.key.toLowerCase() === k)
      if (tool) return store.setTool(tool.id)
      if (k === 'w') store.setGizmo('translate')
      if (k === 'e') store.setGizmo('rotate')
      if (k === 'r') store.setGizmo('scale')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
