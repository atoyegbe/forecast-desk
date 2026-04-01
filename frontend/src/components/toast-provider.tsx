import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ToastItem = {
  id: string
  label: string
  message: string
  visible: boolean
}

type ToastContextValue = {
  pushToast: (input: {
    label: string
    message: string
  }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast: ({ label, message }) => {
        const id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`

        setToasts((current) =>
          [...current, { id, label, message, visible: true }].slice(-3),
        )

        const fadeTimer = window.setTimeout(() => {
          setToasts((current) =>
            current.map((toast) =>
              toast.id === id ? { ...toast, visible: false } : toast,
            ),
          )
        }, 2_700)
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }, 3_000)
        void fadeTimer
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[60] flex flex-col gap-3 sm:right-5 sm:left-auto sm:bottom-5 sm:w-full sm:max-w-[22rem]">
        {toasts.map((toast) => (
          <div
            className={`rounded-lg border border-[var(--color-border)] border-l-[3px] border-l-[#00c58e] bg-[var(--color-bg-elevated)] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition-opacity duration-300 ${
              toast.visible ? 'opacity-100' : 'opacity-0'
            }`}
            key={toast.id}
          >
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              {toast.label}
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {toast.message}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.')
  }

  return context
}
