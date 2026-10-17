import Meter from '../../components/ui/Meter'
import type { CreditSummary } from '../../types/wallet'
import { formatDate, formatMoney } from '../../utils/format'
import { percentOf, toCents } from '../../utils/money'

// How full a limit is decides the colour: calm until 80%, then a warning, red at the limit.
function toneFor(percent: number): 'ok' | 'warn' | 'danger' {
  if (percent >= 100) return 'danger'
  if (percent >= 80) return 'warn'
  return 'ok'
}

function statusOf(c: CreditSummary): { label: string; className: string } {
  if (!c.enabled) return { label: 'Off for new tolls', className: 'status--off' }
  if (c.hasOverdue) return { label: 'Blocked: overdue dues', className: 'status--fail' }
  if (toCents(c.available) === 0) return { label: 'Limit reached', className: 'status--warn' }
  return { label: 'Active', className: 'status--ok' }
}

// The driver's pay-later position: limits, what is owed, and what can still be taken right now.
export default function CreditPanel({ credit }: { credit: CreditSummary }) {
  const status = statusOf(credit)
  const usedPct = percentOf(credit.outstanding, credit.limit)
  const monthPct = percentOf(credit.usedThisMonth, credit.monthlyLimit)

  return (
    <section className="card section-gap">
      <div className="plaza__head">
        <div>
          <h3 className="plaza__title">Pay later</h3>
          <p className="muted">
            If your wallet is short at a toll gate you can still pass; the toll is added to your dues
            and you pay it within {credit.dueDays} day{credit.dueDays === 1 ? '' : 's'}.
          </p>
        </div>
        <span className={`status ${status.className}`}>{status.label}</span>
      </div>

      {credit.hasOverdue && (
        <div className="alert alert--error">
          {formatMoney(credit.overdueAmount)} ({credit.overdueCount} toll
          {credit.overdueCount === 1 ? '' : 's'}) is overdue. Pay your dues to use pay later again;
          until then a toll your wallet cannot cover will fail.
        </div>
      )}

      {!credit.enabled && (
        <div className="alert alert--warn">
          Pay later has been switched off for your account, so new tolls cannot go on credit. Dues you
          already have stay payable.
        </div>
      )}

      {credit.enabled && (
        <div className="credit-grid">
          <Meter
            label="Credit in use"
            value={`${formatMoney(credit.outstanding)} of ${formatMoney(credit.limit)}`}
            percent={usedPct}
            tone={toneFor(usedPct)}
          />
          <Meter
            label="Taken this month"
            value={`${formatMoney(credit.usedThisMonth)} of ${formatMoney(credit.monthlyLimit)}`}
            percent={monthPct}
            tone={toneFor(monthPct)}
          />
        </div>
      )}

      <dl className="result__grid">
        {credit.enabled && (
          <div>
            <dt>Available now</dt>
            <dd>{formatMoney(credit.available)}</dd>
          </div>
        )}
        <div>
          <dt>Owed</dt>
          <dd>{formatMoney(credit.outstanding)}</dd>
        </div>
        {credit.nextDueAt && (
          <div>
            <dt>Next due by</dt>
            <dd>{formatDate(credit.nextDueAt)}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}