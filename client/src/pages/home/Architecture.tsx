import { useState } from 'react'
import Icon from './Icon'

const NODES = [
  { id: 'web', icon: 'monitor', name: 'Frontend', tech: 'React + Vite · Vercel', model: 'Static hosting + CDN', text: 'Drivers, operators and admins use one website. It is only static files served from a CDN, so it loads quickly and costs almost nothing to run.' },
  { id: 'api', icon: 'layers', name: 'Backend API', tech: 'Node.js + Express · Render', model: 'Platform as a Service (stateless)', text: 'All business rules live here: login with JWT, role checks, toll processing, wallet, credit and reports. It keeps no state in memory, so it can be restarted or scaled out.' },
  { id: 'db', icon: 'database', name: 'Database', tech: 'PostgreSQL · Neon', model: 'Managed database service', text: 'The single source of truth for users, wallets, rates, tolls and the append-only ledger. Transactions and constraints keep the money correct.' },
]

export default function Architecture() {
  const [active, setActive] = useState('api')
  const n = NODES.find((x) => x.id === active)!
  return (
    <div>
      <div className="lp-arch">
        {NODES.map((x, i) => (
          <div className="lp-arch__cell" key={x.id}>
            <button type="button" className={`lp-node ${x.id === active ? 'is-active' : ''}`} onClick={() => setActive(x.id)} aria-pressed={x.id === active}>
              <span className="lp-node__icon"><Icon name={x.icon} size={26} /></span>
              <strong>{x.name}</strong>
              <small>{x.tech}</small>
            </button>
            {i < NODES.length - 1 && (<span className="lp-arch__arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>)}
          </div>
        ))}
      </div>
      <div className="lp-arch__info">
        <span className="lp-tag lp-tag--dark">{n.model}</span>
        <p>{n.text}</p>
      </div>
      <ul className="lp-points">
        <li><strong>Centralised</strong>Every plaza uses one cloud system, so rates, balances and reports stay consistent.</li>
        <li><strong>Scalable</strong>The API is stateless, so more instances can be added as traffic grows.</li>
        <li><strong>Secure</strong>HTTPS, JWT login, role checks on every route, hashed passwords, helmet and CORS limits.</li>
      </ul>
    </div>
  )
}
