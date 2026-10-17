import { useForm, useWatch } from 'react-hook-form'
import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import { useSetUserCredit } from '../../hooks/useAdminUsers'
import type { AdminUser } from '../../types/adminUser'
import { formatMoney } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { toCents } from '../../utils/money'

const MAX_LIMIT = 100000
const AMOUNT = /^\d{1,6}(\.\d{1,2})?$/

interface Form {
  enabled: boolean
  creditLimit: string
  monthlyCreditLimit: string
}

interface Props {
  driver: AdminUser
  onClose: () => void
}

// Admin sets a driver's pay-later limits. Both limits must be above 0 to turn it on; turning it off
// sends 0 / 0. It only affects the driver's NEXT toll: dues already taken stay payable.
export default function CreditLimitsEditor({ driver, onClose }: Props) {
  const save = useSetUserCredit()
  const [serverError, setServerError] = useState<string | null>(null)
  const credit = driver.credit

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    defaultValues: {
      enabled: credit?.enabled ?? false,
      creditLimit: credit?.enabled ? credit.limit : '',
      monthlyCreditLimit: credit?.enabled ? credit.monthlyLimit : '',
    },
  })

  const enabled = useWatch({ control, name: 'enabled' })
  const limit = useWatch({ control, name: 'creditLimit' })
  const monthly = useWatch({ control, name: 'monthlyCreditLimit' })

  const limitOk = AMOUNT.test(limit.trim())
  const monthlyOk = AMOUNT.test(monthly.trim())
  const owed = credit?.outstanding ?? '0.00'
  const belowOwed = enabled && limitOk && toCents(limit.trim()) < toCents(owed)
  const monthlyBelowLimit =
    enabled && limitOk && monthlyOk && toCents(monthly.trim()) < toCents(limit.trim())

  const amountRules = (label: string) => ({
    validate: (v: string) => {
      if (!enabled) return true
      const t = v.trim()
      if (!t) return `Enter the ${label}`
      if (!AMOUNT.test(t)) return 'Use numbers with at most 2 decimals'
      const n = Number(t)
      if (n <= 0) return 'Must be above 0 (or turn pay later off)'
      if (n > MAX_LIMIT) return `Cannot exceed ${MAX_LIMIT.toLocaleString('en-IN')}`
      return true
    },
  })

  const onSubmit = async (f: Form) => {
    setServerError(null)
    try {
      await save.mutateAsync({
        id: driver.id,
        creditLimit: f.enabled ? f.creditLimit.trim() : '0',
        monthlyCreditLimit: f.enabled ? f.monthlyCreditLimit.trim() : '0',
      })
      onClose()
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <Modal title={`Pay later for ${driver.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        <p className="muted">
          Lets this driver pass a toll gate when their wallet is short. The toll becomes a due they
          must pay in time. Changes apply from their next toll; dues already taken stay payable.
        </p>

        <label className="check">
          <input type="checkbox" {...register('enabled')} />
          <span>
            <strong>Allow pay later</strong>
            <span className="muted note"> {enabled ? 'On' : 'Off: a short wallet fails the toll'}</span>
          </span>
        </label>

        {enabled && (
          <div className="form--inline">
            <label>
              Credit limit (₹)
              <input
                inputMode="decimal"
                placeholder="300"
                {...register('creditLimit', amountRules('credit limit'))}
              />
              <span className="muted note">Most the driver can owe at any one time.</span>
              {errors.creditLimit && <span className="error">{errors.creditLimit.message}</span>}
            </label>
            <label>
              Monthly limit (₹)
              <input
                inputMode="decimal"
                placeholder="600"
                {...register('monthlyCreditLimit', amountRules('monthly limit'))}
              />
              <span className="muted note">Most credit that can be taken in one calendar month.</span>
              {errors.monthlyCreditLimit && (
                <span className="error">{errors.monthlyCreditLimit.message}</span>
              )}
            </label>
            <div className="chips">
              <span className="muted">Presets:</span>
              {[
                ['300', '600'],
                ['500', '1500'],
                ['1000', '3000'],
              ].map(([l, m]) => (
                <button
                  key={l}
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => {
                    setValue('creditLimit', l, { shouldValidate: true })
                    setValue('monthlyCreditLimit', m, { shouldValidate: true })
                  }}
                >
                  ₹{l} / ₹{m}
                </button>
              ))}
            </div>
          </div>
        )}

        {credit && toCents(credit.outstanding) > 0 && (
          <div className="alert alert--info">
            This driver currently owes {formatMoney(credit.outstanding)} on credit.
          </div>
        )}
        {belowOwed && (
          <div className="alert alert--warn">
            The new credit limit is below what is already owed. That is allowed, but it blocks any new
            credit until enough dues are paid.
          </div>
        )}
        {monthlyBelowLimit && (
          <div className="alert alert--warn">
            The monthly limit is lower than the credit limit, so the monthly limit will be the real cap.
          </div>
        )}
        {serverError && <div className="alert alert--error">{serverError}</div>}

        <div className="form__actions">
          <button type="submit" className="btn" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="btn btn--ghost" disabled={save.isPending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}