import { useState } from 'react'
import { useSetUserPlazas } from '../../hooks/useAdminUsers'
import { usePlazas } from '../../hooks/usePlazas'
import type { AdminUser } from '../../types/adminUser'
import { getErrorMessage } from '../../utils/getErrorMessage'

interface Props {
  operator: AdminUser
  onClose: () => void
}

// Admin picks which plazas one operator may work at. Saving replaces the whole set,
// and it applies on the operator's very next request.
export default function OperatorPlazasEditor({ operator, onClose }: Props) {
  const plazas = usePlazas()
  const save = useSetUserPlazas()
  const [selected, setSelected] = useState<string[]>(operator.plazas.map((p) => p.id))
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const onSave = async () => {
    setError(null)
    try {
      await save.mutateAsync({ id: operator.id, plazaIds: selected })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <section className="card section-gap">
      <h2>Plazas for {operator.name}</h2>
      <p className="muted">
        This operator can only process tolls at, and only see transactions and revenue for, the
        plazas ticked below.
      </p>

      {plazas.isPending && <p className="muted">Loading plazas...</p>}
      {plazas.isError && <div className="alert alert--error">{getErrorMessage(plazas.error)}</div>}
      {plazas.data && plazas.data.length === 0 && (
        <p className="muted">No plazas exist yet. Create one on the Plazas page first.</p>
      )}

      {plazas.data && plazas.data.length > 0 && (
        <div className="plaza-picker">
          {plazas.data.map((p) => {
            const on = selected.includes(p.id)
            return (
              <label key={p.id} className={`plaza-picker__item ${on ? 'plaza-picker__item--on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                <span>
                  <strong>{p.name}</strong> ({p.code})
                  {!p.isActive && <span className="badge badge--plain">Inactive</span>}
                  <span className="muted note"> {p.location}</span>
                </span>
              </label>
            )
          })}
        </div>
      )}

      {selected.length === 0 && plazas.data && plazas.data.length > 0 && (
        <div className="alert alert--warn">
          No plaza ticked: this operator will not be able to process or see anything.
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}

      <div className="form__actions">
        <button type="button" className="btn" disabled={save.isPending} onClick={onSave}>
          {save.isPending ? 'Saving...' : 'Save plazas'}
        </button>
        <button type="button" className="btn btn--ghost" disabled={save.isPending} onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  )
}