import { profile } from '../config/profile'

export interface ProjectLink {
  label: string
  href: string
}

export interface Project {
  title: string
  kind: string
  year?: string
  description: string
  tags: string[]
  links: ProjectLink[]
  /** Optional image or video in /public/media. */
  media?: string
  accent?: string
  /** Shown with a "placeholder" badge until replaced with real work. */
  placeholder?: boolean
}

export type Section =
  | { type: 'text'; heading?: string; body: string[] }
  | { type: 'tags'; heading?: string; items: string[] }
  | { type: 'projects'; heading?: string; items: Project[] }
  | { type: 'services'; heading?: string; items: { title: string; body: string; icon: string }[] }
  | { type: 'timeline'; heading?: string; items: { title: string; org: string; period: string; body: string; placeholder?: boolean }[] }
  | { type: 'playground'; heading?: string; body: string }
  | { type: 'contact'; heading?: string; body: string }

export interface StationContent {
  id: string
  /** Short label for the route map. */
  label: string
  title: string
  intro: string
  sections: Section[]
}

export const CONTENT: Record<string, StationContent> = {
  about: {
    id: 'about',
    label: 'About',
    title: `Hi, I'm ${profile.name}.`,
    intro:
      'I build playful, fast, interactive things for the web: 3D worlds, playable ads and HTML5 games. This island is one of them. Every tree, wave and wheel here is code.',
    sections: [
      {
        type: 'text',
        body: [
          'I am a creative developer and game developer with a frontend background. I like the space where engineering meets play: shaders, game feel, tight performance budgets and interfaces that feel good to touch.',
          'The train will carry you around the island. Each station holds a different part of my work. Stay as long as you like, or use the route map to jump ahead.',
        ],
      },
      { type: 'tags', heading: 'Toolbox', items: profile.skills },
    ],
  },
  projects: {
    id: 'projects',
    label: 'Projects',
    title: 'Featured work',
    intro: 'A few things I have built. Each one taught me something about making the web feel alive.',
    sections: [
      {
        type: 'projects',
        items: [
          {
            title: 'Portfolio Island',
            kind: 'Interactive 3D website',
            year: '2026',
            description:
              'This site. A hand-built diorama island with a train that carries visitors between stations. React Three Fiber on the WebGPU renderer with a WebGL 2 fallback, TSL materials for terrain, water and wind, and an in-browser world editor.',
            tags: ['R3F', 'WebGPU', 'TSL', 'Zustand'],
            links: [],
            accent: '#2f8f83',
          },
          {
            title: 'Playable ad title',
            kind: 'Playable ad',
            description: 'Replace with a real playable ad: the brief, the mechanic, the size budget you hit and the results (CTR, install rate).',
            tags: ['HTML5', 'MRAID', 'Size budget'],
            links: [],
            accent: '#d9643a',
            placeholder: true,
          },
          {
            title: 'HTML5 game title',
            kind: 'HTML5 game',
            description: 'Replace with a real game: what it is, how it plays, the engine or framework, and a link to play it.',
            tags: ['Game dev', 'Canvas / WebGL'],
            links: [],
            accent: '#e2a93b',
            placeholder: true,
          },
          {
            title: 'Three.js / R3F project title',
            kind: '3D web experience',
            description: 'Replace with a real 3D web project: a configurator, a product launch page, a data visualisation or a creative experiment.',
            tags: ['Three.js', 'React'],
            links: [],
            accent: '#5f8f4e',
            placeholder: true,
          },
        ],
      },
    ],
  },
  lab: {
    id: 'lab',
    label: 'Lab',
    title: 'The experiment mine',
    intro: 'Deep in the mountain is where I dig into shaders, physics toys and game mechanics. The island itself is the first exhibit.',
    sections: [
      {
        type: 'playground',
        heading: 'Play with the island',
        body: 'These sliders drive TSL uniforms running on your GPU right now. The same node graph compiles to WGSL on WebGPU and GLSL on WebGL 2.',
      },
      {
        type: 'services',
        heading: 'What is running here',
        items: [
          { icon: '🌲', title: 'Instanced forest with GPU wind', body: 'Thousands of trees in a handful of draw calls. Sway is computed in the vertex stage, so there is no CPU cost per tree.' },
          { icon: '🌊', title: 'Stylised water', body: 'Depth baked from the terrain drives colour and the shoreline foam bands that roll in towards the beach.' },
          { icon: '⛰️', title: 'Procedural, carved terrain', body: 'A seeded terraced heightfield. The railway cuts and fills its own bed, and tunnels appear wherever the rail runs too deep.' },
          { icon: '🚂', title: 'Rail by distance, not physics', body: 'The train follows an arc-length parameterised spline with eased braking, so every stop is smooth and predictable.' },
        ],
      },
    ],
  },
  experience: {
    id: 'experience',
    label: 'Experience',
    title: 'What I do',
    intro: 'The village is where the work gets done. Here is what I can help with, and where I have been.',
    sections: [
      {
        type: 'services',
        items: [
          { icon: '🎮', title: 'Playable ads', body: 'Lightweight HTML5 playables for ad networks. Fast first frame, tight size budgets and mechanics that make people want to tap.' },
          { icon: '🕹️', title: 'HTML5 games', body: 'Browser games from prototype to polish: game feel, mobile performance, asset pipelines and analytics hooks.' },
          { icon: '✨', title: 'Creative development', body: 'Three.js and React Three Fiber experiences, custom shaders, WebGPU and scroll or interaction driven storytelling.' },
          { icon: '🧩', title: 'Frontend', body: 'Accessible, fast React and TypeScript interfaces that sit comfortably next to heavy 3D.' },
        ],
      },
      {
        type: 'timeline',
        heading: 'Journey so far',
        items: [
          { title: 'Role title', org: 'Company name', period: '20XX – now', body: 'Replace with a real role: what you built and the impact.', placeholder: true },
          { title: 'Role title', org: 'Company name', period: '20XX – 20XX', body: 'Replace with a real role: what you built and the impact.', placeholder: true },
        ],
      },
    ],
  },
  contact: {
    id: 'contact',
    label: 'Contact',
    title: 'Send a signal',
    intro: 'You made it to the top. If you have a project, a role or just want to say hi, the lighthouse is listening.',
    sections: [{ type: 'contact', body: 'Write a message and the lighthouse will flash it to my inbox.' }],
  },
}
