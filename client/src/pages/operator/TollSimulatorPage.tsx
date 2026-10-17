import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlazas } from '../../hooks/usePlazas'
import { useProcessToll } from '../../hooks/useProcessToll'
import type { ProcessTollInput, ProcessTollResult } from '../../types/toll'
import { VEHICLE_TYPE_LABELS } from '../../types/vehicle'
import { failureExplanation, failureLabel } from '../../utils/failureReasons'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { getErrorCode } from '../../utils/getErrorCode'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { newIdempotencyKey } from '../../utils/idempotency'

// Tags created by the seed script, as quick-fill buttons for the demo.
const DEMO_TAGS = [
  { tag: 'RFID-0001', label: 'RFID-0001 · Car' },
  { tag: 'RFID-0002', label: 'RFID-0002 · Truck' },
  { tag: 'RFID-0003', label: 'RFID-0003 · Bus (low balance)' },
  { tag: 'RFID-0004', label: 'RFID-0004 · Car (pay later)' },
]

type Outcome = 'SUCCESS' | 'CREDIT' | 'FAILED' | 'DUPLICATE' | 'REJECTED'

interface LogRow {
  id: string
  time: string
  rfidTag: string
  plazaCode: string
  outcome: Outcome
  detail: string
}

const OUTCOME_CLASS: Record<Outcome, string> = {
  SUCCESS: 'status--ok',
  CREDIT: 'status--credit',
  FAILED: 'status--fail',
  DUPLICATE: 'status--warn',
  REJECTED: 'status--fail',
}

export default function TollSimulatorPage() {
  const plazas = usePlazas()
  const processToll = useProcessToll()

  const [rfidTag, setRfidTag] = useState('')
  const [plazaId, setPlazaId] = useState('')
  const [lastEvent, setLastEvent] = useState<ProcessTollInput | null>(null)
  const [result, setResult] = useState<ProcessTollResult | null>(null)
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null)
  const [log, setLog] = useState<LogRow[]>([])

  const activePlazas = plazas.data?.filter((p) => p.isActive) ?? []
  const selectedPlazaId = plazaId || activePlazas[0]?.id || ''

  const addLog = (row: Omit<LogRow, 'id' | 'time'>) => {
    const entry: LogRow = { ...row, id: newIdempotencyKey(), time: new Date().toISOString() }
    setLog((prev) => [entry, ...prev].slice(0, 10))
  }

  const submit = async (event: ProcessTollInput) => {
    setError(null)
    setResult(null)
    const plazaCode = plazas.data?.find((p) => p.id === event.plazaId)?.code ?? '-'

    try {
      const res = await processToll.mutateAsync(event)
      setResult(res)
      const onCredit = res.status === 'SUCCESS' && res.credit !== null
      addLog({
        rfidTag: event.rfidTag,
        plazaCode,
        outcome: res.idempotentReplay ? 'DUPLICATE' : onCredit ? 'CREDIT' : res.status,
        detail: res.idempotentReplay
          ? 'Existing transaction returned, not charged again'
          : onCredit
            ? `${formatMoney(res.amount)} on credit${res.credit?.dueAt ? `, due by ${formatDate(res.credit.dueAt)}` : ''}`
            : res.status === 'SUCCESS'
              ? `${formatMoney(res.amount)} collected`
              : failureLabel(res.failureReason),
      })
    } catch (err) {
      const message = getErrorMessage(err)
      setError({ code: getErrorCode(err), message })
      addLog({ rfidTag: event.rfidTag, plazaCode, outcome: 'REJECTED', detail: message })
    }
  }

  // A normal click is a NEW toll event, so it gets a fresh idempotency key.
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const tag = rfidTag.trim()
    if (!tag) {
      setResult(null)
      setError({ code: null, message: 'Enter or pick an RFID tag' })
      return
    }
    if (!selectedPlazaId) {
      setResult(null)
      setError({ code: null, message: 'No active plaza available. Ask an admin to add one.' })
      return
    }
    const event = { rfidTag: tag, plazaId: selectedPlazaId, idempotencyKey: newIdempotencyKey() }
    setLastEvent(event)
    void submit(event)
  }

  // Re-sending the SAME event (same key) is how a retry or a double scan looks to the API.
  const resend = () => {
    if (lastEvent) void submit(lastEvent)
  }

  return (
    <>
      <h2 className="page-title">Toll simulator</h2>

      <section className="card">
        <h2>Process a toll event</h2>
        <p className="muted">
          Simulates a vehicle passing a plaza. The server finds the vehicle by RFID, applies the
          active rate and debits the owner&apos;s wallet atomically. If the wallet is short and the
          driver has pay later, the vehicle passes on credit instead and the toll becomes a due.
        </p>

        <form onSubmit={onSubmit} className="form form--inline section-gap">
          <label>
            RFID tag
            <input
              placeholder="RFID-0001"
              value={rfidTag}
              onChange={(e) => setRfidTag(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label>
            Toll plaza
            <select value={selectedPlazaId} onChange={(e) => setPlazaId(e.target.value)}>
              {activePlazas.length === 0 && <option value="">No active plazas</option>}
              {activePlazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>

          <div className="chips">
            <span className="muted">Demo tags:</span>
            {DEMO_TAGS.map((d) => (
              <button
                key={d.tag}
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => setRfidTag(d.tag)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="form__actions">
            <button type="submit" className="btn" disabled={processToll.isPending}>
              {processToll.isPending ? 'Processing...' : 'Process toll'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!lastEvent || processToll.isPending}
              onClick={resend}
              title="Sends the previous event again with the same idempotency key"
            >
              Resend last event (same key)
            </button>
          </div>
        </form>

        {plazas.isError && (
          <div className="alert alert--error section-gap">{getErrorMessage(plazas.error)}</div>
        )}
      </section>

      {error && (
        <div className="alert alert--error section-gap">
          {error.code && <strong>{error.code}: </strong>}
          {error.message}
        </div>
      )}

      {result && <ResultCard result={result} />}

      {log.length > 0 && (
        <section className="card section-gap">
          <h2>This session</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>RFID</th>
                  <th>Plaza</th>
                  <th>Outcome</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.time).toLocaleTimeString('en-IN')}</td>
                    <td>
                      <code>{row.rfidTag}</code>
                    </td>
                    <td>{row.plazaCode}</td>
                    <td>
                      <span className={`status ${OUTCOME_CLASS[row.outcome]}`}>{row.outcome}</span>
                    </td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function ResultCard({ result }: { result: ProcessTollResult }) {
  const credit = result.status === 'SUCCESS' ? result.credit : null
  const tone = credit ? 'credit' : result.status === 'SUCCESS' ? 'ok' : 'fail'
  const title = credit
    ? '🕒 Passed on credit'
    : result.status === 'SUCCESS'
      ? '✅ Toll collected'
      : '❌ Toll failed'

  return (
    <section className={`card section-gap result result--${tone}`}>
      <h2>{title}</h2>

      {result.idempotentReplay && (
        <div className="alert alert--warn">
          Duplicate event: this idempotency key was already processed, so the existing transaction is
          shown and the wallet was NOT charged again.
        </div>
      )}

      {credit && (
        <div className="alert alert--info">
          {credit.settled ? (
            <>The driver has since paid this pay-later toll.</>
          ) : (
            <>
              The wallet balance could not cover {formatMoney(result.amount)}, so the vehicle passed on
              credit and nothing was deducted. The driver must pay{' '}
              <strong>by {credit.dueAt ? formatDate(credit.dueAt) : 'the due date'}</strong>.
            </>
          )}
        </div>
      )}

      {result.status === 'FAILED' && (
        <div className="alert alert--error">
          <strong>{failureLabel(result.failureReason)}.</strong> {failureExplanation(result.failureReason)}
        </div>
      )}

      {result.lowBalance && result.status === 'SUCCESS' && !credit && (
        <div className="alert alert--warn">Low balance: the driver has been notified.</div>
      )}

      <dl className="result__grid">
        <div>
          <dt>Vehicle</dt>
          <dd>
            {result.vehicle.vehicleNumber} ({VEHICLE_TYPE_LABELS[result.vehicle.vehicleType]})
          </dd>
        </div>
        <div>
          <dt>RFID tag</dt>
          <dd>{result.vehicle.rfidTag}</dd>
        </div>
        <div>
          <dt>Plaza</dt>
          <dd>
            {result.plaza.name} ({result.plaza.code})
          </dd>
        </div>
        <div>
          <dt>Toll amount</dt>
          <dd>{formatMoney(result.amount)}</dd>
        </div>
        <div>
          <dt>{credit ? 'Wallet balance (not charged)' : 'Remaining balance'}</dt>
          <dd>{formatMoney(result.remainingBalance)}</dd>
        </div>
        {credit?.dueAt && (
          <div>
            <dt>Pay later, due by</dt>
            <dd>{formatDate(credit.dueAt)}</dd>
          </div>
        )}
        {credit?.outstanding && credit.limit && (
          <div>
            <dt>Unpaid credit</dt>
            <dd>
              {formatMoney(credit.outstanding)} of {formatMoney(credit.limit)}
            </dd>
          </div>
        )}
        <div>
          <dt>Processed at</dt>
          <dd>{formatDateTime(result.processedAt)}</dd>
        </div>
        <div>
          <dt>Transaction ID</dt>
          <dd>
            <code>{result.transactionId}</code>
          </dd>
        </div>
        <div>
          <dt>Idempotency key</dt>
          <dd>
            <code>{result.idempotencyKey}</code>
          </dd>
        </div>
      </dl>
    </section>
  )
}