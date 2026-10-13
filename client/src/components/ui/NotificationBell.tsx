import { Link } from 'react-router-dom'
import { useUnreadCount } from '../../hooks/useNotifications'

// Bell in the top bar (drivers only). The badge shows unread notifications.
export default function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount()

  return (
    <Link
      to="/app/notifications"
      className="bell"
      aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      title="Notifications"
    >
      <span aria-hidden="true">🔔</span>
      {unread > 0 && <span className="bell__count">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}