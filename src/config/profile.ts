// Everything personal lives here. Edit this file (and src/stations/content.ts
// for the per-station text) to update the portfolio.

export interface SocialLink {
  label: string
  href: string
  kind: 'github' | 'linkedin' | 'x' | 'itch' | 'codepen' | 'dribbble' | 'youtube' | 'email' | 'website' | 'resume'
}

export const profile = {
  name: 'Aakash Shukla',
  role: 'Creative Developer',
  tagline: 'Interactive 3D, playable ads and HTML5 games for the web.',
  roles: ['Creative developer', 'Game developer', 'Frontend developer'],
  skills: ['Three.js', 'React Three Fiber', 'WebGPU / TSL', 'GLSL', 'Playable ads', 'HTML5 games', 'TypeScript', 'React', 'Frontend'],
  /** TODO: set the address visitors should write to. Leave empty to hide the email form. */
  email: '',
  /** TODO: replace the placeholder URLs with real profiles. Links with an empty href are hidden. */
  links: [
    { label: 'GitHub', href: '', kind: 'github' },
    { label: 'LinkedIn', href: '', kind: 'linkedin' },
    { label: 'itch.io', href: '', kind: 'itch' },
    { label: 'Résumé', href: '', kind: 'resume' },
  ] as SocialLink[],
  siteName: 'Portfolio Island',
}
