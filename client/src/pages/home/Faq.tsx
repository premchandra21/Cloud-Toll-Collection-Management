const FAQ = [
  ['Is real RFID hardware or real money used?', 'No. The RFID reader is simulated (an operator types the tag number) and wallet top-ups are fake. The rules, database transactions and roles behave like a real system.'],
  ['What stops a driver being charged twice?', 'Every toll event carries a unique idempotency key. If the same request is sent again, for example after a network failure, the server returns the first result instead of charging again.'],
  ['Can a wallet go below zero?', 'No. The debit is one conditional update that only succeeds when the balance is enough, and a database CHECK constraint backs it up.'],
  ['What if the wallet is short at the gate?', 'If pay later is on and the driver is within the limits, the vehicle passes and the toll becomes a due with a deadline. Otherwise the toll is stored as FAILED with a clear reason and nothing is deducted.'],
  ['How do we know the money adds up?', 'Wallet history is an append-only ledger. A reconciliation report checks that the ledger total equals every wallet balance, and the admin can run it at any time.'],
  ['Why is the first load sometimes slow?', 'The demo runs on free cloud tiers. The API sleeps when idle and can take about a minute to wake on the first request.'],
]

export default function Faq() {
  return (
    <div className="lp-faq">
      {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
    </div>
  )
}
