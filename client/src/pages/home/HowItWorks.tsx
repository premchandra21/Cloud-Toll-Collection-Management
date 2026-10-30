import { useState } from 'react'
import Icon from './Icon'

const STEPS = [
  { icon: 'radio', title: 'Vehicle detected', text: 'The vehicle enters the lane and the plaza reader scans its RFID tag. The operator terminal sends the tag number and plaza to the cloud API.', check: 'POST /api/v1/toll-transactions/process\n{ rfidTag, plazaId, idempotencyKey }', note: 'In this project the RFID reader is simulated: the operator types the tag number.' },
  { icon: 'search', title: 'Identify and price', text: 'The API confirms the operator is assigned to this plaza, finds the vehicle and wallet that belong to the tag, and looks up the rate for that vehicle type at that plaza.', check: 'operator → assigned plaza?\ntag → vehicle → owner wallet\nplaza + vehicle type → rate', note: 'An unknown tag, or a plaza the operator is not assigned to, is rejected at this point.' },
  { icon: 'lock', title: 'Charge exactly once', text: 'In one database transaction the wallet is debited, the toll is recorded and a ledger entry is written. If any part fails, everything is rolled back.', check: 'UPDATE wallet SET balance = balance - rate\nWHERE balance >= rate   (+ CHECK balance >= 0)', note: 'The idempotency key is unique, so a retried request returns the first result instead of charging again.' },
  { icon: 'clock', title: 'Pay later, if allowed', text: 'If the wallet is short and the driver has pay later switched on, the vehicle still passes. The toll becomes a due with a deadline, within the driver’s credit limits.', check: 'overdue dues        → block\nunpaid + toll > limit → block\notherwise           → pass on credit', note: 'When credit is not available the toll is stored as FAILED with a reason and nothing is deducted.' },
  { icon: 'bell', title: 'Notify and report', text: 'The driver is notified (toll paid, low balance, credit used, due soon). Dashboards and reports for operators and admins read from the same central data.', check: 'notification written after commit\n→ dashboards · CSV export · reconciliation', note: 'A notification problem can never undo a toll, because it is sent after the commit.' },
]

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  const step = STEPS[active]
  return (
    <div className="lp-flow">
      <ol className="lp-flow__list">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button type="button" className={`lp-flow__item ${i === active ? 'is-active' : ''}`} onClick={() => setActive(i)} aria-current={i === active ? 'step' : undefined}>
              <span className="lp-flow__num">{i + 1}</span>
              <span>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="lp-flow__panel">
        <div className="lp-flow__icon"><Icon name={step.icon} size={26} /></div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <pre className="lp-code">{step.check}</pre>
        <p className="lp-muted">{step.note}</p>
      </div>
    </div>
  )
}
