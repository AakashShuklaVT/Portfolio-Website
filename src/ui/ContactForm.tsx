import { profile } from '../config/profile'
import { useUiStore } from '../store/useUiStore'
import { IconArrow } from './icons'

/** "Send a signal": the email address, social links, and a button that flashes the lighthouse. */
export function ContactForm() {
  const sendSignal = useUiStore((s) => s.sendSignal)
  const links = profile.links.filter((l) => l.href)

  return (
    <div className="contact">
      {profile.email && (
        <div className="contact-email">
          <span className="label">Email</span>
          <a className="arrow-link" href={`mailto:${profile.email}`}>
            {profile.email} <IconArrow />
          </a>
        </div>
      )}
      {links.length > 0 && (
        <ul className="social">
          {links.map((l) => (
            <li key={l.kind}>
              <a className="arrow-link" href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} <IconArrow />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="contact-actions">
        <button className="btn btn-ghost btn-sm" type="button" onClick={sendSignal}>
          Flash the lighthouse
        </button>
      </div>
    </div>
  )
}
