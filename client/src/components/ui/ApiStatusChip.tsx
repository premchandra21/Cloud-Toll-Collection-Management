import { useHealth } from '../../hooks/useHealth'

export default function ApiStatusChip() {
  const { isPending, isError, data } = useHealth()

  let state: 'checking' | 'online' | 'offline' = 'checking'
  let label = 'Checking API...'

  if (!isPending && isError) {
    state = 'offline'
    label = 'API offline'
  } else if (data) {
    state = 'online'
    label = data.db === 'connected' ? 'API + DB connected' : 'API online'
  }

  return (
    <span className={`chip chip--${state}`}>
      <span className="chip__dot" />
      {label}
    </span>
  )
}