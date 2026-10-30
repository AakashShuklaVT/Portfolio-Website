# Portfolio Island

The portfolio of **Aakash Shukla**: creative developer, game developer and frontend developer.

A small hand-built low-poly island with a terraced mountain and a railway that spirals to a lighthouse at the summit. Visitors ride a little train between five stations, and each station holds a piece of the portfolio. A route map gives impatient visitors express travel, and a plain HTML version exists for anyone in a hurry, for screen readers and for devices without WebGL.

Built with React Three Fiber on Three.js's **WebGPURenderer** (automatic WebGL 2 fallback), with every shader written in **TSL**.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run preview        # serve the production build
```

Useful URL flags:

| Flag | What it does |
| --- | --- |
| `?edit` | Opens the world editor (dev server only; not shipped in production) |
| `?backend=webgl` | Forces the WebGL 2 fallback so both backends get tested |
| `?debug` | Shows the active backend and quality tier |
| `?lite` | Shows the plain HTML version |

## Editing your content

| What | Where |
| --- | --- |
| Name, roles, skills, email, social links | `src/config/profile.ts` |
| Station text, projects, services, timeline | `src/stations/content.ts` |
| Project images or videos | drop them in `public/media/` and set `media: '/media/…'` on a project |
| The island itself | the in-browser editor (`npm run dev`, then open `/?edit`) |

Projects and timeline entries marked `placeholder: true` show a "placeholder" badge until you replace them. The contact form stays hidden until `profile.email` is set, and social links with an empty `href` are hidden.

## The world editor (`/?edit`)

The editor runs inside the real renderer, so what you see is what visitors get.

- **Tools**: Select (V), Place (B), Scatter brush (S), Erase (X), Track (T), Stations (K)
- **Gizmo**: move / rotate / scale (W / E / R), optional grid snapping, drop-to-ground
- **Model library**: rendered thumbnails, search and tag filters; click to place, or to set the scatter brush
- **Scatter brush**: radius, density, spacing, scale range, slope and height limits (instanced, so thousands of trees stay cheap)
- **Track**: drag control points; on release the terrain re-carves itself, and tunnels and bridges are detected automatically. Insert, delete and level points, and run a preview train.
- **Stations**: content, building style, side of the track, capture the current view as the station camera, preview the arrival
- **World settings** (right panel): lighting presets, sun angle, fog, water, live TSL uniforms (wind, terrain colours) and the terrain generator
- **Undo / redo** (Ctrl+Z / Ctrl+Shift+Z), autosave to local storage, import and export
- **Save** (Ctrl+S) writes `public/data/world.json` through a dev-server endpoint. Commit that file to publish the change.
- **Play-test** (P) switches to the visitor experience and back

`npm run world:reset` regenerates `public/data/world.json` from the procedural defaults (this overwrites editor work). `npm run world:inspect` prints the railway layout.

## How it works

- **Rendering**: one `WebGPURenderer`, created in an async R3F `gl` factory. It uses WebGPU when available and WebGL 2 otherwise. The backend that actually starts sets a quality tier (pixel ratio, shadows, post-processing, particle counts).
- **Terrain**: a seeded, terraced heightfield. The railway cuts and fills its own bed, station pads are flattened, and colour comes from a TSL material using per-face height, slope and path data, so facets stay crisp.
- **Railway**: a closed Catmull-Rom spline sampled by arc length. The train has no physics; each car is placed from two bogie points at fixed distances behind the engine. A small state machine (intro, departing, riding, arriving, idle, fast travel) eases speed along a braking curve.
- **Camera**: a rig that blends between overview, ride, tunnel and station shots, plus a projection offset that keeps the subject framed beside the UI.
- **Materials (TSL)**: terrain, water (baked depth, shore foam bands, faceted waves), GPU wind sway for instanced foliage, a sky dome, tilt-shift and vignette post-processing.
- **Polish**: island-assembly intro after pipelines are precompiled, steam, birds, clouds with moving shadows, day / sunset / night or local time, and a procedural Web Audio soundscape (off until the visitor opts in).
- **Accessibility**: real HTML for all content, keyboard operable, reduced-motion setting (which also honours the OS preference), and the lite HTML page.

```
src/
  core/       renderer, flags, quality tiers, warm-up, post-processing
  store/      zustand stores (world, ride, UI, settings, editor mode)
  world/      terrain generation, water, scatter, props, sky, clouds, birds, models
  rail/       track path, track meshes, train, ride controller, steam
  camera/     camera rig
  stations/   station buildings, content, travel helpers
  materials/  TSL materials
  ui/         HUD, station panel, intro, route map, lite page
  audio/      procedural soundscape
  editor/     world editor (dev only, lazy-loaded)
public/data/world.json   the authored world
```

## Deploying

`npm run build` produces a static site in `dist/` that works on Vercel, Netlify or Cloudflare Pages with no extra configuration. After choosing a domain, make the `og:image` URLs in `index.html` absolute so social previews work everywhere.

## Versions

Versions are pinned exactly (three r187, @react-three/fiber 9.8, drei 10.7). The WebGPU and TSL APIs still change between three releases, so read the release notes before upgrading and test both backends (`?backend=webgl`) afterwards.
