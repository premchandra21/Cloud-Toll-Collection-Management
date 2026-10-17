import { useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../components/ui/Pagination'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../hooks/useNotifications'
import type { NotificationType } from '../../types/notification'
import { formatDateTime } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'

const ICONS: Record<NotificationType, string> = {
  TOLL_SUCCESS: '✅',
  TOLL_FAILED: '❌',
  LOW_BALANCE: '⚠️',
  CREDIT_USED: '🕒',
  CREDIT_DUE_SOON: '⏰',
  CREDIT_OVERDUE: '🚨',
  CREDIT_SETTLED: '💸',
}

// Notifications that call for action link straight to the wallet.
const WALLET_LINK: Partial<Record<NotificationType, string>> = {
  CREDIT_USED: 'View dues',
  CREDIT_DUE_SOON: 'Pay dues',
  CREDIT_OVERDUE: 'Pay dues',
  TOLL_FAILED: 'Open wallet',
  LOW_BALANCE: 'Top up',
 }

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const list = useNotifications(page)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const actionError = markRead.error ?? markAll.error
  const unread = list.data?.unreadCount ?? 0

  return (
    <>
      <div className="plaza__head">
        <h2 className="page-title">Notifications</h2>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all as read
        </button>
      </div>

      {actionError && <div className="alert alert--error">{getErrorMessage(actionError)}</div>}

      <section className="card">
        {list.isPending && <p className="muted">Loading notifications...</p>}
        {list.isError && <div className="alert alert--error">{getErrorMessage(list.error)}</div>}
        {list.data && list.data.items.length === 0 && (
          <p className="muted">No notifications yet. Toll results, low-balance alerts and pay-later reminders appear here.</p>
        )}

        {list.data && list.data.items.length > 0 && (
          <>
            <ul className="notif-list">
              {list.data.items.map((n) => (
                <li key={n.id} className={`notif${n.isRead ? '' : ' notif--unread'}`}>
                  <span className="notif__icon" aria-hidden="true">
                    {ICONS[n.type] ?? '🔔'}
                  </span>
                  <div className="notif__body">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <span className="muted note">{formatDateTime(n.createdAt)}</span>
                    {WALLET_LINK[n.type] && (
                      <div>
                        <Link to="/app/wallet" className="link">
                          {WALLET_LINK[n.type]} →
                        </Link>
                      </div>
                    )}
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination meta={list.data.meta} onPageChange={setPage} disabled={list.isFetching} />
          </>
        )}
      </section>
    </>
  )
}