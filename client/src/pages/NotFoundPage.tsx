import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="hero">
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <div className="hero__actions">
        <Link to="/" className="btn">
          Back to home
        </Link>
      </div>
    </section>
  )
}