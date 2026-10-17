import { useState } from 'react'
import type { FormEvent } from 'react'
import Pagination from '../../components/ui/Pagination'
import CreditLimitsEditor from '../../features/admin/CreditLimitsEditor'
import OperatorPlazasEditor from '../../features/admin/OperatorPlazasEditor'
import { useAuth } from '../../features/auth/useAuth'
import { useAdminUsers, useSetUserActive } from '../../hooks/useAdminUsers'
import type { Role } from '../../types/auth'
import { formatDateTime, formatMoney } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { toCents } from '../../utils/money'

export default function UsersPage() {
  const { user: me } = useAuth()
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState<'' | Role>('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creditId, setCreditId] = useState<string | null>(null)

  const list = useAdminUsers({
    page,
    pageSize: 10,
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
  })
  const setActive = useSetUserActive()

  const search = (e: FormEvent) => {
    e.preventDefault()
    setQ(qInput.trim())
    setPage(1)
  }

  // Look the operator up in the current page so the editor always starts from fresh data.
  const editing = list.data?.items.find((u) => u.id === editingId) ?? null
  const creditDriver = list.data?.items.find((u) => u.id === creditId) ?? null

  const toggle = async (id: string, isActive: boolean) => {
    setActionError(null)
    try {
      await setActive.mutateAsync({ id, isActive: !isActive })
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  return (
    <>
      <h2 className="page-title">Users</h2>

      <section className="card">
        <form onSubmit={search} className="form form--inline">
          <label>
            Name or email
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} autoComplete="off" />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as '' | Role)
                setPage(1)
              }}
            >
              <option value="">All roles</option>
              <option value="USER">User (driver)</option>
              <option value="OPERATOR">Operator</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <div className="form__actions">
            <button type="submit" className="btn">
              Search
            </button>
          </div>
        </form>
      </section>

      {actionError && <div className="alert alert--error section-gap">{actionError}</div>}

      {editing && (
        <OperatorPlazasEditor
          key={editing.id}
          operator={editing}
          onClose={() => setEditingId(null)}
        />
      )}

      {creditDriver && (
        <CreditLimitsEditor
          key={creditDriver.id}
          driver={creditDriver}
          onClose={() => setCreditId(null)}
        />
      )}

      <section className="card section-gap">
        {list.isPending && <p className="muted">Loading users...</p>}
        {list.isError && <div className="alert alert--error">{getErrorMessage(list.error)}</div>}
        {list.data && list.data.items.length === 0 && <p className="muted">No users found.</p>}

        {list.data && list.data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Plazas</th>
                    <th className="num">Vehicles</th>
                    <th className="num">Wallet</th>
                    <th>Pay later</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((u) => {
                    const isSelf = u.id === me?.id
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          {isSelf && <span className="badge">You</span>}
                          <div className="muted note">{u.email}</div>
                        </td>
                        <td>
                          <span className="badge badge--plain">{u.role}</span>
                        </td>
                        <td>
                          {u.role === 'OPERATOR' ? (
                            u.plazas.length > 0 ? (
                              <div className="plaza-tags">
                                {u.plazas.map((p) => (
                                  <span key={p.id} className="badge badge--plain">
                                    {p.code}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="status status--warn">None assigned</span>
                            )
                          ) : u.role === 'ADMIN' ? (
                            <span className="muted">All plazas</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="num">{u.role === 'USER' ? u.vehicleCount : '-'}</td>
                        <td className="num">{u.walletBalance ? formatMoney(u.walletBalance) : '-'}</td>
                        <td>
                          {u.credit ? (
                            <>
                              {u.credit.enabled ? (
                                <>
                                  <strong>{formatMoney(u.credit.limit)}</strong>
                                  <div className="muted note">
                                    {formatMoney(u.credit.monthlyLimit)} / month
                                  </div>
                                </>
                              ) : (
                                <span className="status status--off">Off</span>
                              )}
                              {toCents(u.credit.outstanding) > 0 && (
                                <div className="note">
                                  <span className="status status--credit">
                                    Owes {formatMoney(u.credit.outstanding)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{formatDateTime(u.createdAt)}</td>
                        <td>
                          <span className={`status status--${u.isActive ? 'ok' : 'off'}`}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="table__actions">
                          {u.role === 'USER' && u.credit && (
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => setCreditId(u.id)}
                            >
                              Pay later
                            </button>
                          )}
                          {u.role === 'OPERATOR' && (
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => setEditingId(u.id)}
                            >
                              Plazas
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--small btn--ghost"
                            disabled={isSelf || setActive.isPending}
                            title={isSelf ? 'You cannot deactivate your own account' : undefined}
                            onClick={() => toggle(u.id, u.isActive)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination meta={list.data.meta} onPageChange={setPage} disabled={list.isFetching} />
          </>
        )}
      </section>
    </>
  )
}