import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import Photo from './Photo'

const ROLES = [
  { id: 'driver', name: 'Driver', who: 'Vehicle owner', photo: 'driver.jpg', alt: 'A driver on a highway',
    goal: 'Pass toll plazas without stopping to pay cash, and always know what was charged.',
    does: ['Registers and adds vehicles, each with its own RFID tag', 'Tops up the prepaid wallet (payments are simulated)', 'Views every toll in a filterable transaction history', 'Receives notifications: toll paid, low balance, credit used, dues due soon', 'Uses pay later when the wallet is short, then settles the dues'],
    story: 'Asha has ₹500 in her wallet. She drives through Bhubaneswar, ₹80 is deducted automatically, and she sees “Toll paid, balance ₹420”.',
    demo: { email: 'asha@toll.test', password: 'Driver@123' } },
  { id: 'operator', name: 'Operator', who: 'Toll plaza staff', photo: 'operator.jpg', alt: 'Toll plaza operator at a booth',
    goal: 'Process every vehicle at their own plaza quickly and see exactly what happened.',
    does: ['Enters the RFID tag and processes the toll', 'Sees the result at once: success, passed on credit, or failed with a reason', 'Works only at the plazas assigned to them (plaza scoping)', 'Views transactions and revenue for their own plazas', 'Exports transactions as CSV'],
    story: 'The operator at BBS-01 processes RFID-0003. The bus owner’s wallet is too low, so the screen shows FAILED, insufficient balance, and nothing is deducted.',
    demo: { email: 'operator@toll.test', password: 'Operator@123' } },
  { id: 'admin', name: 'Admin', who: 'Toll authority / manager', photo: 'admin.jpg', alt: 'Manager reviewing a revenue dashboard',
    goal: 'Run the whole network from one place and trust the numbers.',
    does: ['Creates plazas and sets or retires toll rates per vehicle type', 'Manages users, assigns operators to plazas, sets pay-later limits', 'Watches revenue by plaza, vehicle type and day', 'Runs the reconciliation report: ledger against wallet balances', 'Triggers pay-later reminders and exports reports'],
    story: 'The admin raises the car toll at CTC-01 from ₹60 to ₹70. Every operator uses the new rate on the next vehicle, because rates live in one cloud database.',
    demo: { email: 'admin@toll.test', password: 'Admin@123' } },
]

export default function Roles() {
  const [idx, setIdx] = useState(0)
  const r = ROLES[idx]
  return (
    <div>
      <div className="lp-tabs" role="tablist" aria-label="Choose a role">
        {ROLES.map((x, i) => (
          <button key={x.id} type="button" role="tab" id={`tab-${x.id}`} aria-selected={i === idx} aria-controls="role-panel" className={`lp-tab ${i === idx ? 'is-active' : ''}`} onClick={() => setIdx(i)}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="lp-role" role="tabpanel" id="role-panel" aria-labelledby={`tab-${r.id}`}>
        <Photo file={r.photo} alt={r.alt} className="lp-role__photo" />
        <div className="lp-role__body">
          <span className="lp-tag">{r.who}</span>
          <h3>{r.goal}</h3>
          <ul className="lp-list">
            {r.does.map((d) => (<li key={d}><Icon name="check" size={16} />{d}</li>))}
          </ul>
          <blockquote className="lp-quote">{r.story}</blockquote>
          <div className="lp-demo">
            <div><span className="lp-muted">Demo account</span><br /><code>{r.demo.email}</code> <code>{r.demo.password}</code></div>
            <Link to="/login" className="lp-btn lp-btn--primary lp-btn--sm">Log in as {r.name}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
