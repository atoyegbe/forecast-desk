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

export type PulseAuthEmailLinkResult = {
  delivered: true
}

export type PulseAuthTelegramInitResult = {
  botUrl: string
  token: string
}

export type PulseAuthTelegramStatusResult =
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

export type PulseTelegramConnectResult = {
  handle: string
}

export type PulseUserPreferencesUpdateInput = {
  defaultChannel?: PulseUserDefaultChannel
  email?: string
}
