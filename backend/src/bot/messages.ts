import { getQuorumBaseUrl } from '../db/config.js'

export type AlertSignal = {
  currentDiff: number
  currentPrice: number
  entryPrice: number
  marketTitle: string
  marketUrl: string
  outcome: string
  positionSize: string
  walletName: string
  walletRank: number
  walletScore: number
  walletUrl: string
}

export const escapeMarkdown = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

function getAlertsPageUrl() {
  return new URL('/alerts', getQuorumBaseUrl()).toString()
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function formatScore(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

export const verificationMessage = (code: string) => `
*Your Quorum verification code*

\`${code}\`

Enter this code on the [Quorum alerts page](${getAlertsPageUrl()}) to connect your Telegram\\.

_This code expires in 15 minutes\\._
_Do not share it with anyone\\._
`

export const connectedMessage = (email: string) => `
*Telegram connected* ✓

You'll now receive Quorum alerts here when your watched wallets move\\.

Account: \`${email}\`

Use /stop at any time to disconnect\\.
`

export const alertMessage = (signal: AlertSignal) => {
  const diffText = signal.currentDiff > 0
    ? `\\+${signal.currentDiff.toFixed(1)} pts`
    : signal.currentDiff < 0
      ? `${signal.currentDiff.toFixed(1)} pts`
      : '0\\.0 pts'

  const diffSign = signal.currentDiff > 0
    ? '↑'
    : signal.currentDiff < 0
      ? '↓'
      : '→'

  return `
*Signal detected*

Rank \\#${signal.walletRank} · Score ${formatScore(signal.walletScore)}
*${escapeMarkdown(signal.walletName)}* opened a new position

*${escapeMarkdown(signal.marketTitle)}*

Outcome: \`${signal.outcome}\`
Entry: \`${formatPercent(signal.entryPrice)}%\`
Size: \`${signal.positionSize}\`
Now: \`${formatPercent(signal.currentPrice)}%\` ${diffSign} ${diffText}

[View market](${signal.marketUrl}) · [View wallet](${signal.walletUrl})

_Reply /stop to unsubscribe from alerts\\._
`
}

export const stopMessage = () => `
*Alerts paused*

Your Telegram is disconnected from Quorum\\.
You won't receive any more alerts here\\.

To reconnect, visit [Quorum alerts page](${getAlertsPageUrl()}) and connect Telegram again\\.
`

export const notConnectedMessage = () => `
*Not connected*

This Telegram account is not linked to any Quorum account\\.

To connect, visit [Quorum alerts page](${getAlertsPageUrl()})\\.
`

export const unknownMessage = () => `
I only send Quorum alerts\\.

Use /status to check your connection or /stop to disconnect\\.
`

export const statusMessage = (email: string, count: number) => `
*Connected account*

Email: \`${email}\`
Active subscriptions: \`${count}\`

Use /stop to disconnect\\.
`
