import { useState } from 'react'
import VehicleForm from '../../features/user/VehicleForm'
import { useUpdateVehicle, useVehicles } from '../../hooks/useVehicles'
import { VEHICLE_TYPE_LABELS } from '../../types/vehicle'
import { getErrorMessage } from '../../utils/getErrorMessage'

export default function VehiclesPage() {
  const { data: vehicles, isPending, isError, error } = useVehicles()
  const update = useUpdateVehicle()
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
      <section className="card">
        <h2>Add a vehicle</h2>
        <p className="muted">
          The RFID tag is what the toll plaza scans, so it must be unique across the system.
        </p>
        <VehicleForm onDone={() => undefined} />
      </section>

      <section className="card section-gap">
        <h2>My vehicles</h2>
        {actionError && <div className="alert alert--error">{actionError}</div>}

        {isPending && <p className="muted">Loading vehicles...</p>}
        {isError && <div className="alert alert--error">{getErrorMessage(error)}</div>}
        {vehicles && vehicles.length === 0 && (
          <p className="muted">No vehicles yet. Add your first one above.</p>
        )}

        {vehicles && vehicles.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle number</th>
                  <th>Type</th>
                  <th>RFID tag</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) =>
                  editingId === v.id ? (
                    <tr key={v.id}>
                      <td colSpan={5}>
                        <VehicleForm vehicle={v} onDone={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.vehicleNumber}</strong>
                      </td>
                      <td>{VEHICLE_TYPE_LABELS[v.vehicleType]}</td>
                      <td>
                        <code>{v.rfidTag}</code>
                      </td>
                      <td>
                        <span className={`status status--${v.isActive ? 'ok' : 'off'}`}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table__actions">
                        <button
                          type="button"
                          className="btn btn--small btn--ghost"
                          onClick={() => setEditingId(v.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--small btn--ghost"
                          disabled={update.isPending}
                          onClick={() => toggleActive(v.id, v.isActive)}
                        >
                          {v.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}