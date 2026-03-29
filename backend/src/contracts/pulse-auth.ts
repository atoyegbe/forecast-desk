export type PulseAuthUser = {
  createdAt: string
  email: string
  id: string
  lastLoginAt?: string | null
}

export type PulseAuthSession = {
  expiresAt: string
  id: string
  token: string
}

export type PulseAuthSessionView = Omit<PulseAuthSession, 'token'>

export type PulseAuthRequestCodeInput = {
  email: string
}

export type PulseAuthRequestCodeResult = {
  delivered: true
}

export type PulseAuthVerifyCodeInput = {
  code: string
  email: string
}

export type PulseAuthVerifyCodeResult = {
  session: PulseAuthSession
  user: PulseAuthUser
}

export type PulseAuthCurrentSession = {
  session: PulseAuthSessionView
  user: PulseAuthUser
}

export type PulseAuthLogoutResult = {
  revoked: true
}
