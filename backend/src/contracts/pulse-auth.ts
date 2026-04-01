export type PulseUserDefaultChannel = 'both' | 'email' | 'telegram'
export type PulseAuthProvider = 'email' | 'telegram'

export type PulseAuthUser = {
  authProvider: PulseAuthProvider
  createdAt: string
  defaultChannel: PulseUserDefaultChannel
  email: string | null
  id: string
  lastLoginAt?: string | null
  telegramHandle?: string | null
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

export type PulseAuthSignedInResult = {
  status: 'signed-in'
  session: PulseAuthSession
  user: PulseAuthUser
}

export type PulseAuthEmailLinkedResult = {
  status: 'email-linked'
  user: PulseAuthUser
}

export type PulseAuthVerifyLinkResult =
  | PulseAuthEmailLinkedResult
  | PulseAuthSignedInResult

export type PulseAuthCurrentSession = {
  session: PulseAuthSessionView
  user: PulseAuthUser
}

export type PulseAuthLogoutResult = {
  revoked: true
}

export type PulseAuthEmailLinkInput = {
  email: string
}

export type PulseAuthEmailLinkResult = {
  delivered: true
}

export type PulseTelegramAuthInitResult = {
  botUrl: string
  token: string
}

export type PulseTelegramAuthStatusResult =
  | {
      status: 'approved'
      username: string | null
    }
  | {
      status: 'expired'
    }
  | {
      status: 'pending'
    }

export type PulseTelegramConnectInput = {
  code: string
}

export type PulseTelegramConnectResult = {
  handle: string
}

export type PulseUserPreferencesUpdateInput = {
  defaultChannel?: PulseUserDefaultChannel
  email?: string
}
