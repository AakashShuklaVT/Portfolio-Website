// Small inline icon set (stroke icons, 24px grid).
const Svg = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const IconMap = () => (
  <Svg>
    <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
    <path d="M9 4v14M15 6v14" />
  </Svg>
)
export const IconSettings = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </Svg>
)
// Speaker in the Windows 11 (Fluent) style: rounded box and cone, curved waves, or an x when muted.
const SPEAKER = 'M4.5 9h2.2l4.3-3.4c.5-.4 1.2 0 1.2.6v11.6c0 .6-.7 1-1.2.6L6.7 15H4.5A1.5 1.5 0 013 13.5v-3A1.5 1.5 0 014.5 9z'
export const IconSoundOn = () => (
  <svg className="speaker" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={SPEAKER} />
    <path className="wave" d="M15.5 9.5a3.5 3.5 0 010 5" />
    <path className="wave wave-2" d="M18 7a7 7 0 010 10" />
  </svg>
)
export const IconSoundOff = () => (
  <svg className="speaker" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={SPEAKER} />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
)
export const IconArrow = () => (
  <Svg size={18}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
export const IconSkip = () => (
  <Svg size={18}>
    <path d="M5 5l8 7-8 7V5zM13 5l8 7-8 7V5z" />
  </Svg>
)
export const IconExternal = () => (
  <Svg size={14}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Svg>
)
export const IconInfo = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
)
