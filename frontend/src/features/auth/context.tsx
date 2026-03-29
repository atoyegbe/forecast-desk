import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BackendRequestError } from '../../lib/api-client'
import {
  getCurrentSession,
  logoutSession,
  requestLoginCode,
  verifyLoginCode,
} from './api'
import type {
  PulseAuthSession,
  PulseAuthSessionView,
  PulseAuthUser,
} from './types'

const AUTH_TOKEN_STORAGE_KEY = 'quorum-auth-token'

type AuthDialogState = {
  email: string
  error: string | null
  isOpen: boolean
  isSubmitting: boolean
  step: 'request' | 'verify'
}

type AuthContextValue = {
  authDialog: AuthDialogState
  closeAuthDialog: () => void
  currentSession: PulseAuthSessionView | null
  isAuthenticated: boolean
  isHydrating: boolean
  openAuthDialog: (initialEmail?: string) => void
  requestCode: (email: string) => Promise<boolean>
  sessionToken: string | null
  signOut: () => Promise<void>
  user: PulseAuthUser | null
  verifyCode: (code: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

function getErrorMessage(error: unknown) {
  if (error instanceof BackendRequestError || error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<PulseAuthSessionView | null>(
    null,
  )
  const [user, setUser] = useState<PulseAuthUser | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [authDialog, setAuthDialog] = useState<AuthDialogState>({
    email: '',
    error: null,
    isOpen: false,
    isSubmitting: false,
    step: 'request',
  })

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      setIsHydrating(false)
      return
    }

    let isActive = true
    setSessionToken(token)

    void getCurrentSession(token)
      .then((session) => {
        if (!isActive) {
          return
        }

        setCurrentSession(session.session)
        setUser(session.user)
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setSessionToken(null)
        setCurrentSession(null)
        setUser(null)
        setStoredToken(null)
      })
      .finally(() => {
        if (isActive) {
          setIsHydrating(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const openAuthDialog = (initialEmail = '') => {
    setAuthDialog({
      email: initialEmail,
      error: null,
      isOpen: true,
      isSubmitting: false,
      step: 'request',
    })
  }

  const closeAuthDialog = () => {
    setAuthDialog((current) => ({
      ...current,
      error: null,
      isOpen: false,
      isSubmitting: false,
    }))
  }

  const requestCodeForEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setAuthDialog((current) => ({
        ...current,
        error: 'Email is required.',
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
      await requestLoginCode(normalizedEmail)
      setAuthDialog((current) => ({
        ...current,
        email: normalizedEmail,
        error: null,
        isSubmitting: false,
        step: 'verify',
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

  const verifyAuthCode = async (code: string) => {
    const normalizedCode = code.trim()
    const email = authDialog.email

    if (!email || normalizedCode.length < 6) {
      setAuthDialog((current) => ({
        ...current,
        error: 'Enter the 6-digit code sent to your email.',
      }))

      return false
    }

    setAuthDialog((current) => ({
      ...current,
      error: null,
      isSubmitting: true,
    }))

    try {
      const nextSession = await verifyLoginCode(email, normalizedCode)
      const storedSession: PulseAuthSession = nextSession.session

      setSessionToken(storedSession.token)
      setStoredToken(storedSession.token)
      setCurrentSession({
        expiresAt: storedSession.expiresAt,
        id: storedSession.id,
      })
      setUser(nextSession.user)
      setAuthDialog({
        email: '',
        error: null,
        isOpen: false,
        isSubmitting: false,
        step: 'request',
      })
      void queryClient.invalidateQueries({
        queryKey: ['alerts'],
      })

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

  const signOut = async () => {
    const activeToken = sessionToken

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
        currentSession,
        isAuthenticated: Boolean(sessionToken && user),
        isHydrating,
        openAuthDialog,
        requestCode: requestCodeForEmail,
        sessionToken,
        signOut,
        user,
        verifyCode: verifyAuthCode,
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
