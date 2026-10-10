import type { PageMeta } from '../../types/wallet'

interface Props {
  meta: PageMeta
  onPageChange: (page: number) => void
  disabled?: boolean
}

export default function Pagination({ meta, onPageChange, disabled }: Props) {
  if (meta.totalPages <= 1) return null

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn--small btn--ghost"
        disabled={disabled || meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
      >
        Previous
      </button>
      <span className="muted">
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        className="btn btn--small btn--ghost"
        disabled={disabled || meta.page >= meta.totalPages}
        onClick={() => onPageChange(meta.page + 1)}
      >
        Next
      </button>
    </div>
  )
}