import { usePlazas } from '../../hooks/usePlazas'

interface Props {
  value: string
  onChange: (value: string) => void
}

// Only rendered for staff: GET /plazas is OPERATOR/ADMIN only.
export default function PlazaFilter({ value, onChange }: Props) {
  const plazas = usePlazas()

  return (
    <label>
      Plaza
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All plazas</option>
        {plazas.data?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.code})
          </option>
        ))}
      </select>
    </label>
  )
}