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

export type PulseAuthRequestLinkInput = {
  email: string
  returnToPath?: string
}

export type PulseAuthRequestLinkResult = {
  delivered: true
}

export type PulseAuthVerifyLinkInput = {
  email: string
  token: string
}

export type PulseAuthVerifyLinkResult = {
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
