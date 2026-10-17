import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

// Dialog built on the native <dialog> element: focus trapping, Esc to close and the backdrop come
// from the browser. Mount it only while it should be open (`{open && <Modal ...>}`).
export default function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself, not on the panel inside it.
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="modal__panel">
        <div className="modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            aria-label="Close"
            onClick={() => ref.current?.close()}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}