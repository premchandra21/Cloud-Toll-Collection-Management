import { useState } from 'react'
import Icon from './Icon'

// A browser-only copy of the toll rules (nothing is sent to the server), so a visitor can see
// each outcome: paid from the wallet, passed on credit, failed, and a safely repeated request.

type Plaza = 'BBS-01' | 'CTC-01'
type VType = 'CAR' | 'TRUCK' | 'BUS'
type Outcome = 'WALLET' | 'CREDIT' | 'FAILED'

const RATES: Record<Plaza, Record<VType, number>> = {
  'BBS-01': { CAR: 80, TRUCK: 200, BUS: 160 },
  'CTC-01': { CAR: 60, TRUCK: 150, BUS: 120 },
}
const VEHICLES = [
  { id: 'RFID-0001', owner: 'Asha', type: 'CAR' as VType, label: 'Car · RFID-0001 · Asha' },
  { id: 'RFID-0002', owner: 'Asha', type: 'TRUCK' as VType, label: 'Truck · RFID-0002 · Asha' },
  { id: 'RFID-0003', owner: 'Ravi', type: 'BUS' as VType, label: 'Bus · RFID-0003 · Ravi' },
]
const START: Record<string, number> = { Asha: 500, Ravi: 50 }
const LIMIT = 300
const fmt = (n: number) => `₹${n.toFixed(2)}`

interface Entry { key: string; rfid: string; plaza: Plaza; amount: number; outcome: Outcome; reason?: string }

const REASONS: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'The wallet balance is too low and pay later is off. Nothing was deducted.',
  CREDIT_OVERDUE: 'The wallet is too low and the driver has overdue dues, so credit is blocked. Nothing was deducted.',
  CREDIT_LIMIT_EXCEEDED: `This toll would take unpaid credit above the ${fmt(LIMIT)} limit. Nothing was deducted.`,
}

export default function Simulator() {
  const [vehicleId, setVehicleId] = useState('RFID-0001')
  const [plaza, setPlaza] = useState<Plaza>('BBS-01')
  const [balances, setBalances] = useState({ ...START })
  const [payLater, setPayLater] = useState(false)
  const [overdue, setOverdue] = useState(false)
  const [outstanding, setOutstanding] = useState(0)
  const [log, setLog] = useState<Entry[]>([])
  const [last, setLast] = useState<Entry | null>(null)
  const [replayed, setReplayed] = useState(false)

  const vehicle = VEHICLES.find((v) => v.id === vehicleId)!
  const amount = RATES[plaza][vehicle.type]
  const balance = balances[vehicle.owner]

  function process() {
    let outcome: Outcome = 'WALLET'
    let reason: string | undefined
    if (balance < amount) {
      if (!payLater) { outcome = 'FAILED'; reason = 'INSUFFICIENT_BALANCE' }
      else if (overdue) { outcome = 'FAILED'; reason = 'CREDIT_OVERDUE' }
      else if (outstanding + amount > LIMIT) { outcome = 'FAILED'; reason = 'CREDIT_LIMIT_EXCEEDED' }
      else outcome = 'CREDIT'
    }
    const entry: Entry = { key: `evt-${String(log.length + 1).padStart(3, '0')}`, rfid: vehicle.id, plaza, amount, outcome, reason }
    if (outcome === 'WALLET') setBalances((b) => ({ ...b, [vehicle.owner]: b[vehicle.owner] - amount }))
    if (outcome === 'CREDIT') setOutstanding((o) => o + amount)
    setLog((l) => [entry, ...l].slice(0, 8))
    setLast(entry)
    setReplayed(false)
  }

  function reset() {
    setBalances({ ...START }); setOutstanding(0); setLog([]); setLast(null); setReplayed(false); setPayLater(false); setOverdue(false)
  }

  return (
    <div className="lp-demo-grid">
      <div className="lp-card lp-form">
        <h3>Toll event</h3>
        <label>Vehicle (RFID tag)
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {VEHICLES.map((v) => (<option key={v.id} value={v.id}>{v.label}</option>))}
          </select>
        </label>
        <label>Toll plaza
          <select value={plaza} onChange={(e) => setPlaza(e.target.value as Plaza)}>
            <option value="BBS-01">BBS-01 · Bhubaneswar North</option>
            <option value="CTC-01">CTC-01 · Cuttack</option>
          </select>
        </label>
        <dl className="lp-facts">
          <div><dt>Toll for this vehicle</dt><dd>{fmt(amount)}</dd></div>
          <div><dt>{vehicle.owner}’s wallet</dt><dd className={balance < amount ? 'is-warn' : ''}>{fmt(balance)}</dd></div>
          <div><dt>Unpaid pay-later credit</dt><dd>{fmt(outstanding)} <small>of {fmt(LIMIT)}</small></dd></div>
        </dl>
        <label className="lp-check"><input type="checkbox" checked={payLater} onChange={(e) => setPayLater(e.target.checked)} /> Pay later enabled <small>(limit {fmt(LIMIT)}, due in 7 days)</small></label>
        <label className={`lp-check ${payLater ? '' : 'is-off'}`}><input type="checkbox" checked={overdue} disabled={!payLater} onChange={(e) => setOverdue(e.target.checked)} /> Driver has overdue dues</label>
        <div className="lp-actions">
          <button type="button" className="lp-btn lp-btn--primary" onClick={process}>Process toll</button>
          <button type="button" className="lp-btn lp-btn--outline" onClick={() => setReplayed(true)} disabled={!last}>Send same request again</button>
        </div>
        <button type="button" className="lp-textbtn" onClick={reset}>Reset demo</button>
        <p className="lp-muted">Tip: choose the bus (wallet ₹50) to see a failed toll, then enable pay later.</p>
      </div>

      <div className="lp-demo-side">
        <div className={`lp-card lp-result ${last ? `lp-result--${last.outcome.toLowerCase()}` : ''}`} aria-live="polite">
          <h3>Result</h3>
          {!last && <p className="lp-muted">Press “Process toll”. The system identifies the vehicle, calculates the toll and applies the rules; the outcome appears here.</p>}
          {last?.outcome === 'WALLET' && (<><p className="lp-result__title"><Icon name="check" size={18} /> Success · {fmt(last.amount)} deducted</p><p>The debit, the toll record and the ledger entry were saved in one database transaction. The driver receives a notification.</p></>)}
          {last?.outcome === 'CREDIT' && (<><p className="lp-result__title"><Icon name="clock" size={18} /> Success · passed on credit</p><p>The wallet could not cover {fmt(last.amount)}, so the toll was added to the driver’s dues instead of stopping the vehicle. Unpaid credit is now {fmt(outstanding)} of {fmt(LIMIT)}.</p></>)}
          {last?.outcome === 'FAILED' && (<><p className="lp-result__title"><Icon name="x" size={18} /> Failed · {last.reason?.replaceAll('_', ' ').toLowerCase()}</p><p>{REASONS[last.reason ?? '']}</p></>)}
          {replayed && last && (<p className="lp-replay"><strong>Repeated request.</strong> Key “{last.key}” was sent again. The server found the stored result and returned it, so the wallet was not charged a second time.</p>)}
        </div>

        <div className="lp-card">
          <h3>Transaction ledger</h3>
          {log.length === 0 ? (<p className="lp-muted">No tolls processed yet.</p>) : (
            <table className="lp-table">
              <thead><tr><th>Key</th><th>Vehicle</th><th>Plaza</th><th>Outcome</th></tr></thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.key}>
                    <td><code>{e.key}</code></td><td>{e.rfid}</td><td>{e.plaza}</td>
                    <td><span className={`lp-badge lp-badge--${e.outcome.toLowerCase()}`}>{e.outcome === 'WALLET' ? `Paid ${fmt(e.amount)}` : e.outcome === 'CREDIT' ? `Credit ${fmt(e.amount)}` : 'Failed'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
