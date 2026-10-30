import { useRideStore } from '../store/useRideStore'
import { useWorldStore } from '../store/useWorldStore'

/** Phase 1 grey-box controls: board, continue, and a route list for fast travel. */
export function RideUI() {
  const stations = useWorldStore((s) => s.derived?.stations)
  const { state, currentStation, targetStation, overlayOpen, board, depart } = useRideStore()
  if (!stations?.length) return null

  const current = stations.find((s) => s.def.id === currentStation)
  const next = current ? stations[(current.index + 1) % stations.length] : stations[0]

  return (
    <div className="ride-ui">
      {state === 'INTRO' && (
        <button className="btn btn-primary" onClick={() => board(stations[0].def.id)}>
          Board the train
        </button>
      )}
      {state === 'IDLE_AT_STATION' && overlayOpen && current && (
        <div className="panel">
          <h2>{current.def.name}</h2>
          <button className="btn btn-primary" onClick={() => depart(next.def.id)}>
            Continue to {next.def.name} →
          </button>
        </div>
      )}
      {state !== 'INTRO' && (
        <nav className="route" aria-label="Route map">
          {stations.map((s) => (
            <button
              key={s.def.id}
              className={s.def.id === (targetStation ?? currentStation) ? 'active' : ''}
              onClick={() => depart(s.def.id, true)}
            >
              {s.def.name}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
