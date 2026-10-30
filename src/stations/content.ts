import { profile } from '../config/profile'

export interface ProjectLink {
  label: string
  href: string
}

export interface Project {
  title: string
  kind: string
  year?: string
  /** One line. */
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
  | { type: 'services'; heading?: string; items: { title: string; body: string }[] }
  | { type: 'timeline'; heading?: string; items: { title: string; org: string; period: string; body: string; placeholder?: boolean }[] }
  | { type: 'playground'; heading?: string; body: string }
  | { type: 'contact'; heading?: string; body: string }

export interface StationContent {
  id: string
  /** Short label for the route map. */
  label: string
  title: string
  /** One sentence. */
  intro: string
  sections: Section[]
}

// Keep it short: one-line intros, one-line descriptions. The island does the talking.
export const CONTENT: Record<string, StationContent> = {
  about: {
    id: 'about',
    label: 'About',
    title: `Hi, I'm ${profile.name.split(' ')[0]}.`,
    intro: 'Creative developer. I make 3D worlds, playable ads and HTML5 games that feel good to touch.',
    sections: [
      {
        type: 'text',
        body: ['Engineering meets play: shaders, game feel, tight budgets.', 'Ride on. Each stop shows another side of the work.'],
      },
      { type: 'tags', heading: 'Toolbox', items: profile.skills },
    ],
  },
  projects: {
    id: 'projects',
    label: 'Work',
    title: 'Selected work',
    intro: "A few things I've shipped.",
    sections: [
      {
        type: 'projects',
        items: [
          {
            title: 'Portfolio Island',
            kind: '3D website',
            year: '2026',
            description: 'This island. R3F on WebGPU, TSL shaders and a custom world editor.',
            tags: ['R3F', 'WebGPU', 'TSL'],
            links: [],
            accent: '#2f8f83',
          },
          {
            title: 'Playable ad',
            kind: 'Playable ad',
            description: 'Placeholder. Swap in a real playable: mechanic, size, results.',
            tags: ['HTML5', 'MRAID'],
            links: [],
            accent: '#d9643a',
            placeholder: true,
          },
          {
            title: 'HTML5 game',
            kind: 'Game',
            description: 'Placeholder. Swap in a game people can play.',
            tags: ['Canvas', 'WebGL'],
            links: [],
            accent: '#e2a93b',
            placeholder: true,
          },
          {
            title: '3D experience',
            kind: 'Three.js',
            description: 'Placeholder. Swap in a configurator, launch page or experiment.',
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
    title: 'The Lab',
    intro: 'Where I dig into shaders and game mechanics.',
    sections: [
      {
        type: 'playground',
        heading: 'Play with the island',
        body: 'Live TSL uniforms, running on your GPU.',
      },
      {
        type: 'services',
        heading: 'Under the hood',
        items: [
          { title: 'Instanced forest', body: 'GPU wind. Hundreds of trees, a handful of draws.' },
          { title: 'Stylised water', body: 'Baked depth drives colour and shoreline foam.' },
          { title: 'Carved terrain', body: 'Seeded terraces. The railway cuts its own bed.' },
          { title: 'Rail by distance', body: 'Arc-length spline, eased braking, no physics.' },
        ],
      },
    ],
  },
  experience: {
    id: 'experience',
    label: 'Services',
    title: 'What I do',
    intro: 'Four things I do well.',
    sections: [
      {
        type: 'services',
        items: [
          { title: 'Playable ads', body: 'Tiny, fast, tappable. Built to ad-network budgets.' },
          { title: 'HTML5 games', body: 'Prototype to polish, tuned for mobile.' },
          { title: 'Creative development', body: 'Three.js and R3F worlds, custom shaders, WebGPU.' },
          { title: 'Frontend', body: 'Fast, accessible React and TypeScript.' },
        ],
      },
      {
        type: 'timeline',
        heading: 'Journey',
        items: [
          { title: 'Role', org: 'Company', period: '20XX to now', body: 'Placeholder. What you built, and the impact.', placeholder: true },
          { title: 'Role', org: 'Company', period: '20XX to 20XX', body: 'Placeholder. What you built, and the impact.', placeholder: true },
        ],
      },
    ],
  },
  contact: {
    id: 'contact',
    label: 'Contact',
    title: 'Send a signal',
    intro: 'Project, role, or just hello. The lighthouse is listening.',
    sections: [{ type: 'contact', body: 'Your message opens in your mail app.' }],
  },
}
