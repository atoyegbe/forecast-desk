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

export type PulseAuthVerifyCodeResult = {
  session: PulseAuthSession
  user: PulseAuthUser
}

export type PulseAuthCurrentSession = {
  session: PulseAuthSessionView
  user: PulseAuthUser
}
