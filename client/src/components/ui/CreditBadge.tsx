import { formatDate, isPast } from '../../utils/format'

interface Props {
  credit: { dueAt: string | null; settled: boolean } | null | undefined
}

// "Pay later" marker for a toll that passed on credit: Paid, Due <date> or Overdue.
export default function CreditBadge({ credit }: Props) {
  if (!credit) return null

  if (credit.settled) {
    return <span className="status status--ok">Pay later · Paid</span>
  }
  if (credit.dueAt && isPast(credit.dueAt)) {
    return <span className="status status--fail">Pay later · Overdue</span>
  }
  return (
    <span className="status status--credit">
      Pay later · Due {credit.dueAt ? formatDate(credit.dueAt) : 'soon'}
    </span>
  )
}