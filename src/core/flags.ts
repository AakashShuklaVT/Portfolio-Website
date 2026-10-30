// URL flags read once at startup.
//   ?edit          -> world editor (dev builds only)
//   ?backend=webgl -> force the WebGL 2 fallback backend
//   ?debug         -> debug panel (backend, tier, fps)
//   ?lite          -> force the HTML-only fallback
const params = new URLSearchParams(window.location.search)

export const flags = {
  edit: import.meta.env.DEV && params.has('edit'),
  forceWebGL: params.get('backend') === 'webgl',
  debug: params.has('debug') || (import.meta.env.DEV && params.has('edit')),
  lite: params.has('lite'),
} as const
