import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/toast-provider'
import { BackendRequestError } from '../../lib/api-client'
import {
  getCurrentSession,
  logoutSession,
  requestMagicLink,
  verifyMagicLink,
} from './api'
import type {
  PulseAuthSession,
  PulseAuthSessionView,
  PulseAuthUser,
} from './types'

const AUTH_CALLBACK_EMAIL_PARAM = 'auth_email'
const AUTH_CALLBACK_TOKEN_PARAM = 'auth_token'
const AUTH_TOKEN_STORAGE_KEY = 'quorum-auth-token'
const PENDING_AUTH_ACTION_STORAGE_KEY = 'quorum-auth-pending-action'

type AuthDialogState = {
  email: string
  error: string | null
  isOpen: boolean
  isSubmitting: boolean
  resendCooldownEndsAt: number | null
  resentState: 'idle' | 'resent'
  step: 'email' | 'check-email'
}

export type WalletAlertPendingAuthActionInput = {
  type: 'wallet-alert'
  walletAddress: string
  walletLabel?: string | null
}

export type AlertsRoutePendingAuthActionInput = {
  type: 'alerts-route'
}

export type PendingAuthActionInput =
  | WalletAlertPendingAuthActionInput
  | AlertsRoutePendingAuthActionInput

export type PendingAuthAction =
  | (WalletAlertPendingAuthActionInput & {
      id: string
      returnToPath: string
    })
  | (AlertsRoutePendingAuthActionInput & {
      id: string
      returnToPath: string
    })

type AuthContextValue = {
  authDialog: AuthDialogState
  closeAuthDialog: () => void
  consumePendingAction: (id: string) => void
  currentSession: PulseAuthSessionView | null
  isAuthenticated: boolean
  isHydrating: boolean
  openAuthDialog: (input?: {
    initialEmail?: string
    pendingAction?: PendingAuthActionInput | null
  }) => void
  pendingAction: PendingAuthAction | null
  requestMagicLink: (email: string) => Promise<boolean>
  resetAuthDialogToEmailEntry: () => void
  resendMagicLink: () => Promise<boolean>
  sessionToken: string | null
  signOut: () => Promise<void>
  user: PulseAuthUser | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function createDefaultDialogState(
  overrides: Partial<AuthDialogState> = {},
): AuthDialogState {
  return {
    email: '',
    error: null,
    isOpen: false,
    isSubmitting: false,
    resendCooldownEndsAt: null,
    resentState: 'idle',
    step: 'email',
    ...overrides,
  }
}

function getStoredToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

function setStoredToken(token: string | null) {
  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

function createPendingActionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getCurrentReturnToPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function isPendingAuthAction(value: unknown): value is PendingAuthAction {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    (candidate.type === 'wallet-alert' || candidate.type === 'alerts-route') &&
    typeof candidate.id === 'string' &&
    typeof candidate.returnToPath === 'string' &&
    (candidate.type === 'alerts-route' ||
      typeof candidate.walletAddress === 'string')
  )
}

function getStoredPendingAuthAction() {
  const rawValue = window.sessionStorage.getItem(PENDING_AUTH_ACTION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown

    return isPendingAuthAction(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setStoredPendingAuthAction(action: PendingAuthAction | null) {
  if (!action) {
    window.sessionStorage.removeItem(PENDING_AUTH_ACTION_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(
    PENDING_AUTH_ACTION_STORAGE_KEY,
    JSON.stringify(action),
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof BackendRequestError || error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

function getAuthCallback() {
  const url = new URL(window.location.href)
  const email = url.searchParams.get(AUTH_CALLBACK_EMAIL_PARAM)?.trim() ?? ''
  const token = url.searchParams.get(AUTH_CALLBACK_TOKEN_PARAM)?.trim() ?? ''

  if (!email || !token) {
    return null
  }

  url.searchParams.delete(AUTH_CALLBACK_EMAIL_PARAM)
  url.searchParams.delete(AUTH_CALLBACK_TOKEN_PARAM)

  return {
    cleanUrl: `${url.pathname}${url.search}${url.hash}`,
    email,
    token,
  }
}

function storeAuthCallbackRemoval(cleanUrl: string) {
  window.history.replaceState(window.history.state, '', cleanUrl)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}

function normalizePendingAction(
  input?: PendingAuthActionInput | null,
): PendingAuthAction | null {
  if (!input) {
    return null
  }

  if (input.type === 'alerts-route') {
    return {
      id: createPendingActionId(),
      returnToPath: getCurrentReturnToPath(),
      type: 'alerts-route',
    }
  }

  return {
    id: createPendingActionId(),
    returnToPath: getCurrentReturnToPath(),
    type: 'wallet-alert',
    walletAddress: input.walletAddress.trim().toLowerCase(),
    walletLabel: input.walletLabel ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const didHydrateRef = useRef(false)
  const pendingActionRef = useRef<PendingAuthAction | null>(null)
  const resentTimerRef = useRef<number | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<PulseAuthSessionView | null>(
    null,
  )
  const [user, setUser] = useState<PulseAuthUser | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [pendingAction, setPendingAction] = useState<PendingAuthAction | null>(null)
  const [authDialog, setAuthDialog] = useState<AuthDialogState>(
    createDefaultDialogState(),
  )

  useEffect(() => {
    return () => {
      if (resentTimerRef.current) {
        window.clearTimeout(resentTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (didHydrateRef.current) {
      return
    }

    didHydrateRef.current = true
    let isActive = true

    const applySessionState = (nextSession: {
      session: PulseAuthSession
      user: PulseAuthUser
    }) => {
      const storedSession = nextSession.session

      setSessionToken(storedSession.token)
      setStoredToken(storedSession.token)
      setCurrentSession({
        expiresAt: storedSession.expiresAt,
        id: storedSession.id,
      })
      setUser(nextSession.user)
      void queryClient.invalidateQueries({
        queryKey: ['alerts'],
      })
    }

    void (async () => {
      const authCallback = getAuthCallback()

      if (authCallback) {
        storeAuthCallbackRemoval(authCallback.cleanUrl)

        try {
          const nextSession = await verifyMagicLink(
            authCallback.email,
            authCallback.token,
          )

          if (!isActive) {
            return
          }

          applySessionState(nextSession)
          const nextPendingAction = getStoredPendingAuthAction()

          pendingActionRef.current = nextPendingAction
          setPendingAction(nextPendingAction)
          setAuthDialog(createDefaultDialogState())
          pushToast({
            label: 'Signed in',
            message: `Signed in as ${nextSession.user.email}`,
          })
        } catch (error) {
          if (!isActive) {
            return
          }

          pendingActionRef.current = getStoredPendingAuthAction()
          setAuthDialog(
            createDefaultDialogState({
              email: authCallback.email,
              error: getErrorMessage(error),
              isOpen: true,
            }),
          )
        } finally {
          if (isActive) {
            setIsHydrating(false)
          }
        }

        return
      }

      const token = getStoredToken()

      if (!token) {
        if (isActive) {
          setIsHydrating(false)
        }

        return
      }

      setSessionToken(token)

      try {
        const session = await getCurrentSession(token)

        if (!isActive) {
          return
        }

        setCurrentSession(session.session)
        setUser(session.user)
      } catch {
        if (!isActive) {
          return
        }

        setSessionToken(null)
        setCurrentSession(null)
        setUser(null)
        setStoredToken(null)
      } finally {
        if (isActive) {
          setIsHydrating(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [pushToast, queryClient])

  const openAuthDialog = (input?: {
    initialEmail?: string
    pendingAction?: PendingAuthActionInput | null
  }) => {
    const nextPendingAction = normalizePendingAction(input?.pendingAction)

    pendingActionRef.current = nextPendingAction
    setPendingAction(null)
    setStoredPendingAuthAction(nextPendingAction)
    setAuthDialog(
      createDefaultDialogState({
        email: input?.initialEmail?.trim().toLowerCase() ?? '',
        isOpen: true,
      }),
    )
  }

  const closeAuthDialog = () => {
    setAuthDialog((current) => ({
      ...current,
      error: null,
      isOpen: false,
      isSubmitting: false,
    }))
  }

  const requestMagicLinkForEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setAuthDialog((current) => ({
        ...current,
        error: 'Enter your email to continue.',
      }))

      return false
    }

    setAuthDialog((current) => ({
      ...current,
      email: normalizedEmail,
      error: null,
      isSubmitting: true,
    }))

    try {
      await requestMagicLink(
        normalizedEmail,
        pendingActionRef.current?.returnToPath ?? getCurrentReturnToPath(),
      )

      setAuthDialog((current) => ({
        ...current,
        email: normalizedEmail,
        error: null,
        isSubmitting: false,
        resendCooldownEndsAt: Date.now() + 60_000,
        resentState: 'idle',
        step: 'check-email',
      }))

      return true
    } catch (error) {
      setAuthDialog((current) => ({
        ...current,
        error: getErrorMessage(error),
        isSubmitting: false,
      }))

      return false
    }
  }

  const resendMagicLinkForEmail = async () => {
    const email = authDialog.email.trim().toLowerCase()

    if (!email) {
      setAuthDialog((current) => ({
        ...current,
        error: 'Enter your email to continue.',
        step: 'email',
      }))

      return false
    }

    setAuthDialog((current) => ({
      ...current,
      error: null,
      isSubmitting: true,
    }))

    try {
      await requestMagicLink(
        email,
        pendingActionRef.current?.returnToPath ?? getCurrentReturnToPath(),
      )

      if (resentTimerRef.current) {
        window.clearTimeout(resentTimerRef.current)
      }

      resentTimerRef.current = window.setTimeout(() => {
        setAuthDialog((current) => ({
          ...current,
          resentState: 'idle',
        }))
      }, 2_000)

      setAuthDialog((current) => ({
        ...current,
        error: null,
        isSubmitting: false,
        resendCooldownEndsAt: Date.now() + 60_000,
        resentState: 'resent',
      }))

      return true
    } catch (error) {
      setAuthDialog((current) => ({
        ...current,
        error: getErrorMessage(error),
        isSubmitting: false,
      }))

      return false
    }
  }

  const resetAuthDialogToEmailEntry = () => {
    setAuthDialog(
      createDefaultDialogState({
        isOpen: true,
      }),
    )
  }

  const consumePendingAction = (id: string) => {
    setPendingAction((current) => {
      if (!current || current.id !== id) {
        return current
      }

      return null
    })

    if (pendingActionRef.current?.id === id) {
      pendingActionRef.current = null
    }

    const storedAction = getStoredPendingAuthAction()

    if (storedAction?.id === id) {
      setStoredPendingAuthAction(null)
    }
  }

  const signOut = async () => {
    const activeToken = sessionToken

    pendingActionRef.current = null
    setPendingAction(null)
    setStoredPendingAuthAction(null)
    setSessionToken(null)
    setCurrentSession(null)
    setUser(null)
    setStoredToken(null)

    if (activeToken) {
      try {
        await logoutSession(activeToken)
      } catch {
        // Best-effort logout. The local session is already gone.
      }
    }

    void queryClient.removeQueries({
      queryKey: ['alerts'],
    })
  }

  return (
    <AuthContext.Provider
      value={{
        authDialog,
        closeAuthDialog,
        consumePendingAction,
        currentSession,
        isAuthenticated: Boolean(sessionToken && user),
        isHydrating,
        openAuthDialog,
        pendingAction,
        requestMagicLink: requestMagicLinkForEmail,
        resetAuthDialogToEmailEntry,
        resendMagicLink: resendMagicLinkForEmail,
        sessionToken,
        signOut,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }

  return context
}
