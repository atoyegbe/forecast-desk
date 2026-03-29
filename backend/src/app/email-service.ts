import { Resend } from 'resend'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import type { StoredAlertSubscription } from '../db/alerts-repository.js'
import {
  getPulseAuthCodeTtlMinutes,
  getPulseEmailFrom,
  getResendApiKey,
} from '../db/config.js'

type EmailSendResult = {
  providerMessageId: string | null
}

let resendClient: Resend | null | undefined
let testEmailSender:
  | ((input: {
      email: string
      subject: string
      text: string
    }) => Promise<EmailSendResult>)
  | null = null

function getResendClient() {
  if (resendClient !== undefined) {
    return resendClient
  }

  const apiKey = getResendApiKey()
  resendClient = apiKey ? new Resend(apiKey) : null

  return resendClient
}

async function sendEmail(input: {
  email: string
  subject: string
  text: string
}) {
  if (testEmailSender) {
    return testEmailSender(input)
  }

  const client = getResendClient()

  if (!client) {
    return {
      providerMessageId: null,
    } satisfies EmailSendResult
  }

  const response = await client.emails.send({
    from: getPulseEmailFrom(),
    subject: input.subject,
    text: input.text,
    to: input.email,
  })

  if (response.error) {
    throw new Error(response.error.message)
  }

  return {
    providerMessageId: response.data?.id ?? null,
  } satisfies EmailSendResult
}

export async function sendPasswordlessMagicLinkEmail(input: {
  email: string
  magicLinkUrl: string
}) {
  return sendEmail({
    email: input.email,
    subject: 'Your Quorum magic link',
    text: `Open this link to sign in to Quorum: ${input.magicLinkUrl} The link expires in ${getPulseAuthCodeTtlMinutes()} minutes.`,
  })
}

export async function sendWalletSignalAlertEmail(input: {
  email: string
  signal: PulseSmartMoneySignal
  subscription: StoredAlertSubscription
}) {
  const thresholdBits = [
    input.subscription.minScore !== null
      ? `score >= ${input.subscription.minScore}`
      : null,
    input.subscription.minSizeUsd !== null
      ? `size >= $${Math.round(input.subscription.minSizeUsd)}`
      : null,
  ].filter(Boolean)
  const thresholdText =
    thresholdBits.length > 0 ? `Matched filters: ${thresholdBits.join(', ')}.` : ''

  return sendEmail({
    email: input.email,
    subject: `Wallet alert: ${input.signal.walletDisplayName} opened a new signal`,
    text: [
      `${input.signal.walletDisplayName} (${input.signal.walletAddress}) opened a ${input.signal.outcome} position in ${input.signal.marketTitle}.`,
      `Current market price: ${Math.round(input.signal.currentPrice * 100)}c.`,
      `Tracked size: $${Math.round(input.signal.size).toLocaleString('en-US')}.`,
      thresholdText,
    ]
      .filter(Boolean)
      .join(' '),
  })
}

export function setTestEmailSender(
  sender:
    | ((input: {
        email: string
        subject: string
        text: string
      }) => Promise<EmailSendResult>)
    | null,
) {
  testEmailSender = sender
}
