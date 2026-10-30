import { useState } from 'react'
import { profile } from '../config/profile'
import { useUiStore } from '../store/useUiStore'
import { IconArrow } from './icons'

/** "Send a signal": composes an email in the visitor's mail app and flashes the lighthouse. */
export function ContactForm({ intro }: { intro: string }) {
  const sendSignal = useUiStore((s) => s.sendSignal)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const links = profile.links.filter((l) => l.href)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile.email || !message.trim()) return
    const subject = encodeURIComponent(`Hello from Portfolio Island${name ? `, ${name}` : ''}`)
    const body = encodeURIComponent(`${message}\n\n${name || 'A visitor'}`)
    sendSignal()
    setSent(true)
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`
  }

  return (
    <div className="contact">
      {profile.email ? (
        <form onSubmit={onSubmit}>
          <p className="muted small">{intro}</p>
          <label className="field">
            <span className="label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="field">
            <span className="label">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} required />
          </label>
          <div className="contact-actions">
            <button className="btn btn-primary" type="submit">
              Send a signal <IconArrow />
            </button>
          </div>
          {sent && (
            <p className="muted small" role="status">
              The lighthouse flashed. Thanks for writing.
            </p>
          )}
        </form>
      ) : (
        <p className="muted">Contact details are on their way.</p>
      )}
      {links.length > 0 && (
        <ul className="social">
          {links.map((l) => (
            <li key={l.kind}>
              <a className="arrow-link" href={l.href} target="_blank" rel="noreferrer">
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
