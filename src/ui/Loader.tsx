import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

/** Shown while the world is generated and shaders are compiled. */
export function Loader() {
  const loaded = useAppStore((s) => s.loaded)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setGone(true), 700)
    return () => clearTimeout(t)
  }, [loaded])
  if (gone) return null
  return (
    <div className={`loader ${loaded ? 'loader-done' : ''}`} role="status" aria-live="polite">
      <div className="loader-track" aria-hidden="true">
        <span className="loader-train" />
      </div>
      <p>{loaded ? 'Here we go!' : 'Assembling the island…'}</p>
    </div>
  )
}
