import type { PulseProvider } from '../contracts/pulse-events.js'
import type {
  PulseSmartMoneySignal,
  PulseSmartMoneyWallet,
} from '../contracts/pulse-smart-money.js'
import { getPulseAuthFrontendBaseUrl } from '../db/config.js'

const FALLBACK_FRONTEND_BASE_URL = 'http://localhost:5173'

type AlertEmailTemplateValues = {
  current_diff: string
  current_price: string
  entry_price: string
  market_count: string
  market_title: string
  market_url: string
  platform: string
  rank: string
  roi: string
  score: string
  size: string
  time_since: string
  unsubscribe_token: string
  wallet_display_name: string
  wallet_url: string
  win_rate: string
}

const ALERT_EMAIL_HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>Quorum Smart Money Alert</title>
    <style>
      @media (prefers-color-scheme: dark) {
        body,
        .email-shell,
        .email-surface,
        .email-wallet {
          background-color: #0d0f10 !important;
        }

        .email-card {
          background-color: #161a1c !important;
          border-color: #2a3035 !important;
        }

        .email-border {
          border-color: #1f2528 !important;
        }

        .email-text {
          color: #e8eaeb !important;
        }

        .email-muted {
          color: #8a9399 !important;
        }
      }
    </style>
  </head>
  <body class="email-shell" style="margin:0; padding:0; background-color:#0d0f10;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#0d0f10;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-surface" style="width:100%; max-width:560px; background-color:#0d0f10;">
            <tr>
              <td class="email-border" style="padding:24px 32px; border-bottom:1px solid #1f2528;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:13px; font-weight:500; letter-spacing:3px; color:#00c58e;">
                      QUORUM
                    </td>
                    <td align="right" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:11px; color:#556068;">
                      Smart Money Alert
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 12px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#556068;">
                      SIGNAL DETECTED
                    </td>
                  </tr>
                  <tr>
                    <td class="email-text" style="padding:0 0 8px 0; font-family:system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; font-size:22px; font-weight:600; line-height:1.25; color:#e8eaeb;">
                      {wallet_display_name} opened a new position.
                    </td>
                  </tr>
                  <tr>
                    <td class="email-muted" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:13px; color:#8a9399;">
                      Wallet rank #{rank} &middot; Score {score} &middot; {time_since} ago
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width:100%; background-color:#161a1c; border:1px solid #2a3035; border-radius:8px;">
                  <tr>
                    <td style="padding:20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td class="email-text" style="padding:0 0 10px 0; font-family:system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; font-size:16px; font-weight:600; color:#e8eaeb;">
                            {market_title}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 16px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td valign="top" width="33.33%" style="width:33.33%; padding:0 8px 0 0;">
                                  <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#556068; padding:0 0 6px 0;">
                                    OPENED
                                  </div>
                                  <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:18px; font-weight:500; color:#00c58e;">
                                    YES @ {entry_price}%
                                  </div>
                                </td>
                                <td valign="top" width="33.33%" style="width:33.33%; padding:0 8px;">
                                  <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#556068; padding:0 0 6px 0;">
                                    POSITION
                                  </div>
                                  <div class="email-text" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:18px; font-weight:500; color:#e8eaeb;">
                                    {size}
                                  </div>
                                </td>
                                <td valign="top" width="33.33%" style="width:33.33%; padding:0 0 0 8px;">
                                  <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#556068; padding:0 0 6px 0;">
                                    PLATFORM
                                  </div>
                                  <div class="email-text" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:14px; color:#e8eaeb;">
                                    {platform}
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 16px 0; border-top:1px solid #2a3035; line-height:0; font-size:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td class="email-muted" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:13px; color:#8a9399;">
                            Current market: {current_price}%{{CURRENT_DIFF_HTML}}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 32px 28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#00c58e" style="background-color:#00c58e; border-radius:6px;">
                      <a href="{market_url}" style="display:inline-block; padding:12px 28px; font-family:system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; font-size:14px; font-weight:600; color:#0d0f10; text-decoration:none;">
                        View market on Quorum →
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="padding-top:12px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:11px; color:#556068;">
                  Or copy this link:
                  <a href="{market_url}" style="color:#00c58e; text-decoration:none;">{market_url}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td class="email-wallet" style="padding:0 32px 24px 32px; background-color:#0d0f10;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 10px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#556068;">
                      About this wallet
                    </td>
                  </tr>
                  <tr>
                    <td class="email-muted" style="padding:0 0 8px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:12px; color:#8a9399;">
                      Win rate {win_rate}% &nbsp;&middot;&nbsp; ROI {roi}% &nbsp;&middot;&nbsp; {market_count} markets traded
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <a href="{wallet_url}" style="font-family:system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; font-size:12px; color:#00c58e; text-decoration:none;">
                        View full wallet profile →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-border" style="padding:20px 32px; border-top:1px solid #1f2528;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 8px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:11px; color:#556068;">
                      You&apos;re receiving this because you set a wallet alert on Quorum.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 8px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:11px; color:#556068;">
                      <a href="{{MANAGE_ALERTS_URL}}" style="color:#8a9399; text-decoration:none;">Manage alerts</a>
                      <span style="color:#556068;"> &middot; </span>
                      <a href="{{UNSUBSCRIBE_URL}}" style="color:#8a9399; text-decoration:none;">Unsubscribe</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace; font-size:10px; color:#3d4a52;">
                      Quorum is for reading public markets, not placing trades.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function interpolateTemplate(
  template: string,
  values: AlertEmailTemplateValues,
) {
  return template.replaceAll(
    /\{([a-z_]+)\}/g,
    (_, key: keyof AlertEmailTemplateValues) => escapeHtml(values[key] ?? ''),
  )
}

function formatPercent(value: number) {
  const percentage = value * 100

  if (Number.isInteger(percentage)) {
    return percentage.toFixed(0)
  }

  return percentage.toFixed(Math.abs(percentage) < 10 ? 1 : 0)
}

function formatSignedPoints(value: number) {
  const percentage = value * 100
  const sign = percentage > 0 ? '+' : percentage < 0 ? '-' : ''
  const absoluteValue = Math.abs(percentage)
  const formattedValue = Number.isInteger(absoluteValue)
    ? absoluteValue.toFixed(0)
    : absoluteValue.toFixed(1)

  return `${sign}${formattedValue}`
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 1,
    notation: value >= 1_000 ? 'compact' : 'standard',
    style: 'currency',
  }).format(value)
}

function formatSignedPercentInt(value: number | null | undefined) {
  const percentage = Math.round((value ?? 0) * 100)
  const sign = percentage > 0 ? '+' : percentage < 0 ? '-' : ''

  return `${sign}${Math.abs(percentage)}`
}

function formatIntegerPercent(value: number | null | undefined) {
  return `${Math.round((value ?? 0) * 100)}`
}

function formatRelativeTimeWithoutAgo(value: string) {
  const signalTimestamp = new Date(value).getTime()

  if (Number.isNaN(signalTimestamp)) {
    return 'moments'
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - signalTimestamp) / 1_000))

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'}`
  }

  const diffMinutes = Math.round(diffSeconds / 60)

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`
  }

  const diffHours = Math.round(diffMinutes / 60)

  if (diffHours < 48) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'}`
  }

  const diffDays = Math.round(diffHours / 24)

  return `${diffDays} day${diffDays === 1 ? '' : 's'}`
}

function formatPlatformCode(provider: PulseProvider) {
  if (provider === 'kalshi') {
    return 'KL'
  }

  if (provider === 'manifold') {
    return 'MF'
  }

  if (provider === 'bayse') {
    return 'BY'
  }

  return 'PM'
}

function getFrontendBaseUrl() {
  return getPulseAuthFrontendBaseUrl() || FALLBACK_FRONTEND_BASE_URL
}

function buildAppUrl(pathname: string) {
  return new URL(pathname, getFrontendBaseUrl()).toString()
}

export function buildMarketUrl(signal: PulseSmartMoneySignal) {
  if (signal.eventId && signal.eventSlug) {
    return buildAppUrl(
      `/events/${encodeURIComponent(signal.eventId)}/${encodeURIComponent(signal.eventSlug)}`,
    )
  }

  return buildAppUrl(`/search?q=${encodeURIComponent(signal.marketTitle)}`)
}

function buildWalletUrl(walletAddress: string) {
  return buildAppUrl(`/smart-money/wallets/${encodeURIComponent(walletAddress.toLowerCase())}`)
}

function buildManageAlertsUrl() {
  return buildAppUrl('/alerts')
}

function buildUnsubscribeUrl(unsubscribeToken: string) {
  return buildAppUrl(`/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`)
}

function buildCurrentDiffHtml(currentDiff: string) {
  const numericValue = Number.parseFloat(currentDiff)

  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return ''
  }

  const color = numericValue > 0 ? '#00c58e' : '#ef4444'

  return ` &middot; <span style="color:${color};">${escapeHtml(currentDiff)} pts</span>`
}

function buildTemplateValues(input: {
  signal: PulseSmartMoneySignal
  unsubscribeToken: string
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}): AlertEmailTemplateValues {
  return {
    current_diff: formatSignedPoints(input.signal.priceDelta),
    current_price: formatPercent(input.signal.currentPrice),
    entry_price: formatPercent(input.signal.entryPrice),
    market_count: `${input.wallet?.marketCount ?? 0}`,
    market_title: input.signal.marketTitle,
    market_url: buildMarketUrl(input.signal),
    platform: formatPlatformCode(input.signal.provider),
    rank: `${input.signal.walletRank}`,
    roi: formatSignedPercentInt(input.wallet?.roi),
    score: `${Math.round(input.signal.walletScore)}`,
    size: formatCompactUsd(input.signal.size),
    time_since: formatRelativeTimeWithoutAgo(input.signal.signalAt),
    unsubscribe_token: input.unsubscribeToken,
    wallet_display_name:
      input.signal.walletDisplayName?.trim() || input.signal.walletShortAddress,
    wallet_url: buildWalletUrl(input.signal.walletAddress),
    win_rate: formatIntegerPercent(input.wallet?.winRate),
  }
}

export function renderWalletSignalAlertEmailHtml(input: {
  signal: PulseSmartMoneySignal
  unsubscribeToken: string
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}) {
  const templateValues = buildTemplateValues(input)

  return interpolateTemplate(ALERT_EMAIL_HTML_TEMPLATE, templateValues)
    .replaceAll('{{CURRENT_DIFF_HTML}}', buildCurrentDiffHtml(templateValues.current_diff))
    .replaceAll('{{MANAGE_ALERTS_URL}}', escapeHtml(buildManageAlertsUrl()))
    .replaceAll(
      '{{UNSUBSCRIBE_URL}}',
      escapeHtml(buildUnsubscribeUrl(templateValues.unsubscribe_token)),
    )
}

export function renderWalletSignalAlertEmailText(input: {
  signal: PulseSmartMoneySignal
  unsubscribeToken: string
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}) {
  const templateValues = buildTemplateValues(input)

  return [
    `${templateValues.wallet_display_name} opened a new position.`,
    `Wallet rank #${templateValues.rank} · Score ${templateValues.score} · ${templateValues.time_since} ago.`,
    `${templateValues.market_title}`,
    `Opened YES @ ${templateValues.entry_price}% · Position ${templateValues.size} · Platform ${templateValues.platform}.`,
    `Current market: ${templateValues.current_price}%${
      templateValues.current_diff === '0' ? '' : ` · ${templateValues.current_diff} pts`
    }.`,
    `Win rate ${templateValues.win_rate}% · ROI ${templateValues.roi}% · ${templateValues.market_count} markets traded.`,
    `View market: ${templateValues.market_url}`,
    `View wallet: ${templateValues.wallet_url}`,
    `Manage alerts: ${buildManageAlertsUrl()}`,
    `Unsubscribe: ${buildUnsubscribeUrl(templateValues.unsubscribe_token)}`,
  ].join('\n')
}
