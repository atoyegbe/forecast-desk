import type { ReactNode } from 'react'

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
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,15,16,0.72)] px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div
        className={`relative w-full max-w-[420px] rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] ${className}`.trim()}
      >
        {onClose ? (
          <button
            aria-label={closeLabel}
            className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]"
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
