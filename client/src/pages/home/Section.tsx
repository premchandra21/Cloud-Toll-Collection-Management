import type { ReactNode } from 'react'

interface Props {
  id: string
  eyebrow: string
  title: string
  lead?: string
  tone?: 'white' | 'grey' | 'navy'
  children: ReactNode
}

export default function Section({ id, eyebrow, title, lead, tone = 'white', children }: Props) {
  return (
    <section id={id} className={`lp-section lp-section--${tone}`}>
      <div className="lp-wrap">
        <header className="lp-head">
          <span className="lp-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </header>
        {children}
      </div>
    </section>
  )
}
