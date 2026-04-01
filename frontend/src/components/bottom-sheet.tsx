import {
  useEffect,
  type ReactNode,
} from 'react'

type BottomSheetProps = {
  children: ReactNode
  footer?: ReactNode
  isOpen: boolean
  onClose: () => void
  title?: string
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 16 16"
      width="18"
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

export function BottomSheet({
  children,
  footer,
  isOpen,
  onClose,
  title,
}: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-[rgba(13,15,16,0.46)] backdrop-blur-sm"
      role="dialog"
    >
      <button
        aria-label="Close sheet"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />

      <div className="relative z-10 flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_-24px_60px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-center px-4 pt-3">
          <span aria-hidden="true" className="mobile-sheet-handle" />
        </div>

        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">
              {title}
            </h2>
            <button
              aria-label="Close sheet"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-[var(--color-border-subtle)] px-4 py-4 tab-bar-safe">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
