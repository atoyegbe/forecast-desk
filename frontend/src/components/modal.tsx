import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type ModalProps = {
  children: ReactNode
  className?: string
  closeLabel?: string
  isOpen: boolean
  onClose?: () => void
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function Modal({
  children,
  className = '',
  closeLabel = 'Close dialog',
  isOpen,
  onClose,
}: ModalProps) {
  const [viewportOffset, setViewportOffset] = useState(0)

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setViewportOffset(0)
      return
    }

    const viewport = window.visualViewport
    const updateOffset = () => {
      const nextOffset = Math.max(
        window.innerHeight - viewport.height - viewport.offsetTop,
        0,
      )

      setViewportOffset(nextOffset)
    }

    updateOffset()
    viewport.addEventListener('resize', updateOffset)
    viewport.addEventListener('scroll', updateOffset)

    return () => {
      viewport.removeEventListener('resize', updateOffset)
      viewport.removeEventListener('scroll', updateOffset)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(13,15,16,0.72)] px-0 pt-6 backdrop-blur-sm sm:px-4 sm:py-6"
      role="dialog"
      style={{ paddingBottom: `max(env(safe-area-inset-bottom), ${viewportOffset}px)` }}
    >
      <div
        className={`relative w-full max-w-[420px] rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 pb-6 pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.35)] sm:rounded-[12px] sm:p-8 ${className}`.trim()}
      >
        <div className="mb-4 flex justify-center sm:hidden">
          <span aria-hidden="true" className="mobile-sheet-handle" />
        </div>

        {onClose ? (
          <button
            aria-label={closeLabel}
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)] sm:right-4 sm:top-4"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        ) : null}

        {children}
      </div>
    </div>
  )
}
