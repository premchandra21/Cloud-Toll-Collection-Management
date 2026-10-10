import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Pagination from '../../components/ui/Pagination'
import { useLedger, useTopUp, useWallet } from '../../hooks/useWallet'
import { formatDateTime, formatMoney } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'

const QUICK_AMOUNTS = ['100', '500', '1000']

interface TopUpForm {
  amount: string
}

export default function WalletPage() {
  const [page, setPage] = useState(1)
  const wallet = useWallet()
  const ledger = useLedger(page)
  const topUp = useTopUp()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TopUpForm>({ defaultValues: { amount: '' } })

  const onSubmit = async ({ amount }: TopUpForm) => {
    setServerError(null)
    setSuccess(null)
    try {
      const result = await topUp.mutateAsync(amount.trim())
      setSuccess(`Top-up successful. New balance: ${formatMoney(result.balance)}`)
      reset({ amount: '' })
      setPage(1)
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <>
      <section className="card">
        <h2>Wallet</h2>
        {wallet.isPending && <p className="muted">Loading wallet...</p>}
        {wallet.isError && <div className="alert alert--error">{getErrorMessage(wallet.error)}</div>}

        {wallet.data && (
          <>
            {wallet.data.lowBalance && (
              <div className="alert alert--warn">
                Low balance: you are at or below {formatMoney(wallet.data.lowBalanceThreshold)}. Top
                up so your next toll does not fail.
              </div>
            )}
            <p className="balance">{formatMoney(wallet.data.balance)}</p>
            <p className="muted">
              Total topped up {formatMoney(wallet.data.totalToppedUp)} · Spent on tolls{' '}
              {formatMoney(wallet.data.totalSpentOnTolls)}
            </p>
          </>
        )}
      </section>

      <section className="card section-gap">
        <h3>Top up (simulated)</h3>
        <p className="muted">No real payment is taken. This simulates a payment gateway.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="form form--inline">
          {serverError && <div className="alert alert--error">{serverError}</div>}
          {success && <div className="alert alert--ok">{success}</div>}

          <label>
            Amount (₹)
            <input
              inputMode="decimal"
              placeholder="500"
              {...register('amount', {
                required: 'Enter an amount',
                pattern: {
                  value: /^\d{1,6}(\.\d{1,2})?$/,
                  message: 'Use numbers with at most 2 decimals',
                },
                validate: (v) => {
                  const n = Number(v)
                  return (n >= 1 && n <= 50000) || 'Amount must be between 1 and 50,000'
                },
              })}
            />
            {errors.amount && <span className="error">{errors.amount.message}</span>}
          </label>

          <div className="chips">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => setValue('amount', a, { shouldValidate: true })}
              >
                +₹{a}
              </button>
            ))}
          </div>

          <div className="form__actions">
            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Top up'}
            </button>
          </div>
        </form>
      </section>

      <section className="card section-gap">
        <h3>Wallet history</h3>
        {ledger.isPending && <p className="muted">Loading history...</p>}
        {ledger.isError && <div className="alert alert--error">{getErrorMessage(ledger.error)}</div>}
        {ledger.data && ledger.data.items.length === 0 && (
          <p className="muted">No wallet activity yet.</p>
        )}

        {ledger.data && ledger.data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data.items.map((e) => {
                    const negative = e.amount.startsWith('-')
                    return (
                      <tr key={e.id}>
                        <td>{formatDateTime(e.createdAt)}</td>
                        <td>
                          <span className="badge badge--plain">{e.type.replace('_', ' ')}</span>
                        </td>
                        <td>{e.description ?? '-'}</td>
                        <td className={`num ${negative ? 'neg' : 'pos'}`}>
                          {negative ? '' : '+'}
                          {formatMoney(e.amount)}
                        </td>
                        <td className="num">{formatMoney(e.balanceAfter)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={ledger.data.meta}
              onPageChange={setPage}
              disabled={ledger.isFetching}
            />
          </>
        )}
      </section>
    </>
  )
}