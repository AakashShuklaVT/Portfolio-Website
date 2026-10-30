import { profile } from '../config/profile'
import { CONTENT } from '../stations/content'
import { useUiStore } from '../store/useUiStore'
import { Sections } from './sections'

const ORDER = ['about', 'projects', 'lab', 'experience', 'contact']

/**
 * The whole portfolio as a plain HTML page: the tier C fallback, the
 * "simple version" for visitors in a hurry, and something screen readers and
 * crawlers can read top to bottom.
 */
export function LiteSite({ canGoBack }: { canGoBack: boolean }) {
  const setLiteOpen = useUiStore((s) => s.setLiteOpen)
  return (
    <div className="lite">
      <header className="lite-head">
        <div>
          <p className="eyebrow">{profile.siteName}</p>
          <h1>{profile.name}</h1>
          <p className="intro-roles">{profile.roles.join(' · ')}</p>
        </div>
        {canGoBack && (
          <button className="btn btn-primary" onClick={() => setLiteOpen(false)}>
            Back to the island
          </button>
        )}
      </header>
      <img className="lite-hero" src={`${import.meta.env.BASE_URL}island.webp`} alt="A small low-poly island with a train climbing a terraced mountain to a lighthouse." onError={(e) => (e.currentTarget.style.display = 'none')} />
      <main>
        {ORDER.map((id) => {
          const c = CONTENT[id]
          return (
            <section key={id} className="lite-station" aria-labelledby={`lite-${id}`}>
              <p className="eyebrow">{c.label}</p>
              <h2 id={`lite-${id}`}>{c.title}</h2>
              <p className="lead">{c.intro}</p>
              <Sections sections={c.sections} interactive={false} />
            </section>
          )
        })}
      </main>
    </div>
  )
}
