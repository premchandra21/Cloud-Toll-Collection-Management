import { useState } from 'react'
import PlazaForm from '../../features/admin/PlazaForm'
import RateEditor from '../../features/admin/RateEditor'
import { usePlazas, useUpdatePlaza } from '../../hooks/usePlazas'
import { getErrorMessage } from '../../utils/getErrorMessage'

export default function PlazasPage() {
  const { data: plazas, isPending, isError, error } = usePlazas()
  const update = useUpdatePlaza()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const toggleActive = async (id: string, isActive: boolean) => {
    setActionError(null)
    try {
      await update.mutateAsync({ id, input: { isActive: !isActive } })
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  return (
    <>
      <h2 className="page-title">Plazas &amp; rates</h2>

      <section className="card">
        <h2>Add a plaza</h2>
        <p className="muted">
          Operators pick from these plazas in the toll simulator. The code must be unique.
        </p>
        <PlazaForm onDone={() => undefined} />
      </section>

      {actionError && <div className="alert alert--error section-gap">{actionError}</div>}
      {isPending && <p className="muted section-gap">Loading plazas...</p>}
      {isError && <div className="alert alert--error section-gap">{getErrorMessage(error)}</div>}
      {plazas && plazas.length === 0 && (
        <p className="muted section-gap">No plazas yet. Add your first one above.</p>
      )}

      {plazas?.map((p) => (
        <section key={p.id} className="card section-gap">
          {editingId === p.id ? (
            <PlazaForm plaza={p} onDone={() => setEditingId(null)} />
          ) : (
            <div className="plaza__head">
              <div>
                <h2 className="plaza__title">
                  {p.name} <span className="badge">{p.code}</span>
                </h2>
                <p className="muted">{p.location}</p>
              </div>
              <div className="plaza__actions">
                <span className={`status status--${p.isActive ? 'ok' : 'off'}`}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => setEditingId(p.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={update.isPending}
                  onClick={() => toggleActive(p.id, p.isActive)}
                >
                  {p.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          )}

          {!p.isActive && (
            <div className="alert alert--warn section-gap">
              This plaza is inactive. Toll events for it will be rejected.
            </div>
          )}

          <RateEditor plaza={p} />
        </section>
      ))}
    </>
  )
}