interface Props {
  label: string
  value: string // already formatted, e.g. "₹160.00 of ₹300.00"
  percent: number // 0-100
  tone?: 'ok' | 'warn' | 'danger'
}

// A labelled progress bar. Pure display; the maths is done by the caller.
export default function Meter({ label, value, percent, tone = 'ok' }: Props) {
  return (
    <div className="meter">
      <div className="meter__head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div
        className="meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}