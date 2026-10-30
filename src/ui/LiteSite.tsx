import { profile } from '../config/profile'
import { CONTENT } from '../stations/content'
import { useUiStore } from '../store/useUiStore'
import { Sections } from './sections'
import { pad2 } from './Words'

const ORDER = ['about', 'projects', 'lab', 'experience', 'contact']

/**
 * The whole portfolio as a plain HTML page: the tier C fallback, the
 * "simple version" for visitors in a hurry, and something screen readers and
 * crawlers can read top to bottom.
 */
export function LiteSite({ canGoBack }: { canGoBack: boolean }) {
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  const [first, ...rest] = profile.name.split(' ')
  return (
    <div className="lite">
      <header className="lite-head">
        <div className="row">
          <span className="label label-accent">{profile.siteName}</span>
          {canGoBack && (
            <button className="btn btn-primary btn-sm" onClick={() => setLiteOpen(false)}>
              Back to the island
            </button>
          )}
        </div>
        <h1 className="display">
          {first} <em>{rest.join(' ')}</em>
        </h1>
        <p className="intro-lede">{profile.tagline}</p>
        <div className="intro-roles">
          {profile.roles.map((r) => (
            <span key={r} className="label">
              {r}
            </span>
          ))}
        </div>
      </header>
      <img
        className="lite-hero"
        src={`${import.meta.env.BASE_URL}island.webp`}
        alt="A small low-poly island with a train climbing a terraced mountain to a lighthouse."
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <main>
        {ORDER.map((id, i) => {
          const c = CONTENT[id]
          return (
            <section key={id} className="lite-station" aria-labelledby={`lite-${id}`}>
              <p className="label">
                {pad2(i + 1)} · {c.label}
              </p>
              <div>
                <h2 id={`lite-${id}`} className="display">
                  {c.title}
                </h2>
                <p className="lead">{c.intro}</p>
                <Sections sections={c.sections} interactive={false} />
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
