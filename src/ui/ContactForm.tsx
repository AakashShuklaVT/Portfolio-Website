import { useState } from 'react'
import { profile } from '../config/profile'
import { useUiStore } from '../store/useUiStore'
import { IconExternal } from './icons'

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
    const subject = encodeURIComponent(`Hello from Portfolio Island${name ? ` — ${name}` : ''}`)
    const body = encodeURIComponent(`${message}\n\n— ${name || 'A visitor'}`)
    sendSignal()
    setSent(true)
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`
  }

  return (
    <div className="contact">
      {profile.email ? (
        <form onSubmit={onSubmit}>
          <p>{intro} It opens your email app with the message ready to go.</p>
          <label>
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label>
            <span>Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required />
          </label>
          <button className="btn btn-primary" type="submit">
            Send a signal
          </button>
          {sent && <p className="muted" role="status">The lighthouse flashed. Thanks for writing!</p>}
        </form>
      ) : (
        <p className="muted">Contact details are being set up. Check back soon.</p>
      )}
      {links.length > 0 && (
        <ul className="social">
          {links.map((l) => (
            <li key={l.kind}>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.label} <IconExternal />
              </a>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost" type="button" onClick={sendSignal}>
        Just flash the lighthouse
      </button>
    </div>
  )
}
