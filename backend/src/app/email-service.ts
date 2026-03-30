import { Resend } from 'resend'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import type { StoredAlertSubscription } from '../db/alerts-repository.js'
import {
  getQuorumAuthCodeTtlMinutes,
  getQuorumEmailFrom,
  getResendApiKey,
} from '../db/config.js'
import {
  renderWalletSignalAlertEmailHtml,
  renderWalletSignalAlertEmailText,
} from './alert-email-template.js'
import type { PulseSmartMoneyWallet } from '../contracts/pulse-smart-money.js'

type EmailSendResult = {
  providerMessageId: string | null
}

let resendClient: Resend | null | undefined
let testEmailSender:
  | ((input: {
      email: string
      html?: string
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
  html?: string
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
    from: getQuorumEmailFrom(),
    html: input.html,
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
    text: `Open this link to sign in to Quorum: ${input.magicLinkUrl} The link expires in ${getQuorumAuthCodeTtlMinutes()} minutes.`,
  })
}

export async function sendWalletSignalAlertEmail(input: {
  email: string
  signal: PulseSmartMoneySignal
  subscription: StoredAlertSubscription
  unsubscribeToken: string
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}) {
  const walletDisplayName =
    input.signal.walletDisplayName?.trim() || input.signal.walletShortAddress

  return sendEmail({
    email: input.email,
    html: renderWalletSignalAlertEmailHtml({
      signal: input.signal,
      unsubscribeToken: input.unsubscribeToken,
      wallet: input.wallet,
    }),
    subject: `Wallet alert: ${walletDisplayName} opened a new position`,
    text: renderWalletSignalAlertEmailText({
      signal: input.signal,
      unsubscribeToken: input.unsubscribeToken,
      wallet: input.wallet,
    }),
  })
}

export function setTestEmailSender(
  sender:
    | ((input: {
        email: string
        html?: string
        subject: string
        text: string
      }) => Promise<EmailSendResult>)
    | null,
) {
  testEmailSender = sender
}
