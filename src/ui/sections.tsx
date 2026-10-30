import type { Section } from '../stations/content'
import { IconExternal } from './icons'
import { Playground } from './Playground'
import { ContactForm } from './ContactForm'

/** Renders station content as plain, accessible HTML (shared by the 3D overlay and the lite page). */
export function Sections({ sections, interactive = true }: { sections: Section[]; interactive?: boolean }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={i} className={`section section-${section.type}`}>
          {section.heading && <h3>{section.heading}</h3>}
          <SectionBody section={section} interactive={interactive} />
        </section>
      ))}
    </>
  )
}

function SectionBody({ section, interactive }: { section: Section; interactive: boolean }) {
  switch (section.type) {
    case 'text':
      return (
        <>
          {section.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </>
      )
    case 'tags':
      return (
        <ul className="tags">
          {section.items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )
    case 'projects':
      return (
        <div className="projects">
          {section.items.map((p) => (
            <article key={p.title} className="project" style={{ '--accent-card': p.accent ?? 'var(--accent)' } as React.CSSProperties}>
              <header>
                <span className="project-kind">
                  {p.kind}
                  {p.year && ` · ${p.year}`}
                </span>
                {p.placeholder && <span className="badge">placeholder</span>}
              </header>
              <h4>{p.title}</h4>
              {p.media && <img src={p.media} alt="" loading="lazy" />}
              <p>{p.description}</p>
              <ul className="tags small">
                {p.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {p.links.length > 0 && (
                <div className="project-links">
                  {p.links.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                      {l.label} <IconExternal />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )
    case 'services':
      return (
        <ul className="services">
          {section.items.map((s) => (
            <li key={s.title}>
              <span className="service-icon" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )
    case 'timeline':
      return (
        <ol className="timeline">
          {section.items.map((t, i) => (
            <li key={i}>
              <span className="period">{t.period}</span>
              <strong>
                {t.title} · {t.org}
              </strong>
              {t.placeholder && <span className="badge">placeholder</span>}
              <p>{t.body}</p>
            </li>
          ))}
        </ol>
      )
    case 'playground':
      return (
        <>
          <p>{section.body}</p>
          {interactive ? <Playground /> : <p className="muted">Open the 3D island to try the live controls.</p>}
        </>
      )
    case 'contact':
      return <ContactForm intro={section.body} />
  }
}
