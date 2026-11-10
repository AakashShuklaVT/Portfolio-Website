import type { CSSProperties } from 'react'
import type { Section } from '../stations/content'
import { IconArrow } from './icons'
import { Playground } from './Playground'
import { ContactForm } from './ContactForm'
import { pad2, stagger } from './Words'

/** Renders station content as plain, accessible HTML (shared by the 3D overlay and the lite page). */
export function Sections({ sections, interactive = true, animate = false }: { sections: Section[]; interactive?: boolean; animate?: boolean }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={i} className={`section section-${section.type} ${animate ? 'fade-up' : ''}`} style={animate ? stagger(i + 3, 500) : undefined}>
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
        <div className="text-lines">
          {section.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
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
        <ol className="work">
          {section.items.map((p, i) => (
            <li key={p.title + i} className={`work-item ${p.links.length ? 'has-link' : ''}`} style={{ '--accent-card': p.accent ?? 'var(--accent)' } as CSSProperties}>
              <span className="work-index">{pad2(i + 1)}</span>
              <div className="work-meta">
                <span className="label">
                  {p.kind}
                  {p.year && ` · ${p.year}`}
                </span>
                {p.placeholder && <span className="badge">placeholder</span>}
              </div>
              <h4>{p.title}</h4>
              <div>
                {p.media && <img src={p.media} alt="" loading="lazy" />}
                <p>{p.description}</p>
                <div className="work-foot">
                  <span className="work-tags">{p.tags.join(' / ')}</span>
                  {/* The first link stretches over the whole card, so a click anywhere on it opens the project in a new tab. */}
                  {p.links.map((l, li) => (
                    <a key={l.href} className={`arrow-link ${li === 0 ? 'card-link' : ''}`} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label} <IconArrow />
                    </a>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'services':
      return (
        <ol className="services">
          {section.items.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      )
    case 'timeline':
      return (
        <ol className="timeline">
          {section.items.map((t, i) => (
            <li key={i}>
              <span className="period">{t.period}</span>
              <strong>
                {t.title}, {t.org}
              </strong>
              <p>{t.body}</p>
              {t.placeholder && <span className="badge">placeholder</span>}
            </li>
          ))}
        </ol>
      )
    case 'playground':
      return (
        <>
          <p>{section.body}</p>
          {interactive ? <Playground /> : <p className="muted">Open the island to try the live controls.</p>}
        </>
      )
    case 'contact':
      return <ContactForm intro={section.body} />
  }
}
