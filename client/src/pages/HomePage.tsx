import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Digital wallet',
    text: 'Top up once and let tolls debit automatically, with a full ledger.',
  },
  {
    title: 'Atomic toll processing',
    text: 'One transaction per event: no double charges, no negative balances.',
  },
  {
    title: 'Revenue dashboards',
    text: 'Per-plaza and per-vehicle-type revenue, centralised in the cloud.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>One cloud system for every toll plaza</h1>
        <p>
          Identify the vehicle, calculate the toll, deduct from the wallet and record
          the transaction, all in a single centralised platform.
        </p>
        <div className="hero__actions">
          <Link to="/login" className="btn">
            Get started
          </Link>
        </div>
      </section>

      <section className="grid">
        {features.map((f) => (
          <article key={f.title} className="card">
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </section>
    </>
  )
}