import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDeactivateRate, useSetRate } from '../../hooks/usePlazas'
import type { Plaza } from '../../types/plaza'
import { VEHICLE_TYPE_LABELS } from '../../types/vehicle'
import type { VehicleType } from '../../types/vehicle'
import { formatMoney } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'

const AMOUNT_PATTERN = /^\d{1,6}(\.\d{1,2})?$/

interface Note {
  kind: 'ok' | 'error'
  text: string
}

function RateRow({ plaza, vehicleType }: { plaza: Plaza; vehicleType: VehicleType }) {
  const rate = plaza.rates.find((r) => r.vehicleType === vehicleType)
  const setRate = useSetRate()
  const removeRate = useDeactivateRate()
  const [value, setValue] = useState('')
  const [note, setNote] = useState<Note | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setNote(null)

    const amount = value.trim()
    if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) {
      setNote({ kind: 'error', text: 'Enter an amount like 80 or 80.50' })
      return
    }

    try {
      const result = await setRate.mutateAsync({ plazaId: plaza.id, input: { vehicleType, amount } })
      setValue('')
      setNote({ kind: 'ok', text: result.changed ? 'Saved' : 'Same as current rate' })
    } catch (err) {
      setNote({ kind: 'error', text: getErrorMessage(err) })
    }
  }

  const remove = async () => {
    if (!rate) return
    setNote(null)
    try {
      await removeRate.mutateAsync({ plazaId: plaza.id, rateId: rate.id })
    } catch (err) {
      setNote({ kind: 'error', text: getErrorMessage(err) })
    }
  }

  return (
    <tr>
      <td>{VEHICLE_TYPE_LABELS[vehicleType]}</td>
      <td className="num">
        {rate ? (
          <strong>{formatMoney(rate.amount)}</strong>
        ) : (
          <span className="status status--off">Not set</span>
        )}
      </td>
      <td>
        <form onSubmit={save} className="rate-form">
          <input
            inputMode="decimal"
            placeholder={rate ? 'New amount' : 'Amount'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`New rate for ${VEHICLE_TYPE_LABELS[vehicleType]}`}
          />
          <button type="submit" className="btn btn--small" disabled={setRate.isPending}>
            {setRate.isPending ? 'Saving...' : rate ? 'Update' : 'Set rate'}
          </button>
        </form>
        {note && <div className={`note note--${note.kind}`}>{note.text}</div>}
      </td>
      <td className="table__actions">
        {rate && (
          <button
            type="button"
            className="btn btn--small btn--ghost"
            disabled={removeRate.isPending}
            onClick={remove}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  )
}

// One row per vehicle type. "Update" makes the new amount the active rate;
// the old rate is kept (switched off) so past toll transactions keep pointing at it.
export default function RateEditor({ plaza }: { plaza: Plaza }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Vehicle type</th>
            <th className="num">Active rate</th>
            <th>Set new rate (₹)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((t) => (
            <RateRow key={t} plaza={plaza} vehicleType={t} />
          ))}
        </tbody>
      </table>
    </div>
  )
}