import { useAppStore } from '../store/useAppStore'

export function DebugBadge() {
  const backend = useAppStore((s) => s.backend)
  const tier = useAppStore((s) => s.quality?.tier)
  return (
    <div className="debug-badge" aria-hidden>
      {backend === 'pending' ? 'starting renderer…' : `${backend.toUpperCase()} · tier ${tier}`}
    </div>
  )
}
