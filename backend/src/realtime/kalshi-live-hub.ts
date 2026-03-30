import { constants, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'
import type { LivePriceSnapshot } from '../contracts/pulse-events.js'
import { getStoredDiscoveryEvent } from '../db/discovery-repository.js'
import { kalshiProvider } from '../providers/kalshi.js'
import {
  buildProviderScopedId,
  parseProviderScopedId,
} from '../providers/provider-ids.js'
import {
  clampProbability,
  createConnectedMessage,
  createErrorMessage,
  createPriceUpdateMessage,
  isRecord,
  resolveQuotedProbability,
  sendJson,
  snapshotsEqual,
  toOptionalNumber,
} from './live-shared.js'
import { PollingEventLiveHub } from './polling-live-hub.js'

const KALSHI_WS_URL =
  process.env.KALSHI_WS_URL?.trim() ??
  'wss://api.elections.kalshi.com/trade-api/ws/v2'
const KALSHI_WS_PATH = '/trade-api/ws/v2'
const KALSHI_LIVE_POLL_INTERVAL_MS = Number.parseInt(
  process.env.KALSHI_LIVE_POLL_INTERVAL_MS ?? '10000',
  10,
)

type KalshiLiveMarket = {
  marketId: string
  marketTicker: string
  title: string
}

type KalshiMarketState = {
  lastPrice: number | null
  noAsk: number | null
  noBid: number | null
  yesAsk: number | null
  yesBid: number | null
}

type KalshiLiveChannel = {
  clients: Set<WebSocket>
  eventId: string
  initializePromise: Promise<void> | null
  lastSnapshot: LivePriceSnapshot | null
  marketStateByTicker: Map<string, KalshiMarketState>
  markets: KalshiLiveMarket[]
  providerEventId: string
  upstream: WebSocket | null
}

function getKalshiPrivateKey() {
  const inlinePrivateKey = process.env.KALSHI_API_PRIVATE_KEY?.trim()

  if (inlinePrivateKey) {
    return inlinePrivateKey.replace(/\\n/g, '\n')
  }

  const privateKeyPath = process.env.KALSHI_API_PRIVATE_KEY_PATH?.trim()

  if (!privateKeyPath) {
    return null
  }

  return readFileSync(privateKeyPath, 'utf8')
}

function getKalshiWebSocketHeaders() {
  const apiKeyId = process.env.KALSHI_API_KEY_ID?.trim()
  const privateKey = getKalshiPrivateKey()

  if (!apiKeyId || !privateKey) {
    return null
  }

  const timestamp = String(Date.now())
  const payload = `${timestamp}GET${KALSHI_WS_PATH}`
  const signature = sign('sha256', Buffer.from(payload), {
    key: privateKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString('base64')

  return {
    'KALSHI-ACCESS-KEY': apiKeyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
  }
}

export function hasKalshiWebSocketAuth() {
  return Boolean(getKalshiWebSocketHeaders())
}

async function loadKalshiEvent(providerEventId: string) {
  const scopedEventId = buildProviderScopedId('kalshi', providerEventId)
  const storedEvent = await getStoredDiscoveryEvent(scopedEventId)

  if (storedEvent?.provider === 'kalshi') {
    return storedEvent
  }

  return kalshiProvider.getEvent(providerEventId)
}

function getOrCreateMarketState(
  marketStateByTicker: Map<string, KalshiMarketState>,
  marketTicker: string,
) {
  const existingState = marketStateByTicker.get(marketTicker)

  if (existingState) {
    return existingState
  }

  const nextState: KalshiMarketState = {
    lastPrice: null,
    noAsk: null,
    noBid: null,
    yesAsk: null,
    yesBid: null,
  }

  marketStateByTicker.set(marketTicker, nextState)

  return nextState
}

function buildSnapshot(channel: KalshiLiveChannel) {
  return {
    eventId: channel.eventId,
    markets: channel.markets.map((market) => {
      const state = getOrCreateMarketState(channel.marketStateByTicker, market.marketTicker)
      const yesPrice = resolveQuotedProbability(
        state.yesBid,
        state.yesAsk,
        state.lastPrice,
      )
      const noFallback = state.lastPrice != null ? 1 - state.lastPrice : 1 - yesPrice
      const noPrice = resolveQuotedProbability(
        state.noBid,
        state.noAsk,
        noFallback,
      )

      return {
        marketId: market.marketId,
        noPrice: clampProbability(noPrice),
        title: market.title,
        yesPrice: clampProbability(yesPrice),
      }
    }),
    timestamp: Date.now(),
  } satisfies LivePriceSnapshot
}

function updateKalshiState(
  channel: KalshiLiveChannel,
  marketTicker: string,
  payload: Record<string, unknown>,
) {
  const marketState = getOrCreateMarketState(channel.marketStateByTicker, marketTicker)

  marketState.lastPrice =
    toOptionalNumber(payload.price_dollars) ??
    toOptionalNumber(payload.last_price_dollars) ??
    marketState.lastPrice
  marketState.yesBid =
    toOptionalNumber(payload.yes_bid_dollars) ??
    marketState.yesBid
  marketState.yesAsk =
    toOptionalNumber(payload.yes_ask_dollars) ??
    marketState.yesAsk
  marketState.noBid =
    toOptionalNumber(payload.no_bid_dollars) ??
    marketState.noBid
  marketState.noAsk =
    toOptionalNumber(payload.no_ask_dollars) ??
    marketState.noAsk
}

const kalshiPollingLiveHub = new PollingEventLiveHub({
  fetchEvent: loadKalshiEvent,
  label: 'Kalshi',
  pollIntervalMs: KALSHI_LIVE_POLL_INTERVAL_MS,
  provider: 'kalshi',
})

class KalshiLiveHub {
  private readonly channels = new Map<string, KalshiLiveChannel>()

  closeAll() {
    kalshiPollingLiveHub.closeAll()

    for (const providerEventId of this.channels.keys()) {
      this.teardownChannel(providerEventId)
    }
  }

  subscribe(eventId: string, client: WebSocket) {
    if (!hasKalshiWebSocketAuth()) {
      return kalshiPollingLiveHub.subscribe(eventId, client)
    }

    const parsed = parseProviderScopedId(eventId)

    if (parsed.provider !== 'kalshi') {
      throw new Error('Live websocket streaming is currently only supported for Kalshi events.')
    }

    const channel = this.getOrCreateChannel(eventId, parsed.providerId)
    channel.clients.add(client)

    if (channel.lastSnapshot) {
      sendJson(client, createPriceUpdateMessage(channel.lastSnapshot))
    }

    void this.ensureUpstream(channel)

    return () => {
      channel.clients.delete(client)

      if (!channel.clients.size) {
        this.teardownChannel(channel.providerEventId)
      }
    }
  }

  private broadcast(channel: KalshiLiveChannel, payload: ReturnType<typeof createErrorMessage> | ReturnType<typeof createConnectedMessage> | ReturnType<typeof createPriceUpdateMessage>) {
    for (const client of channel.clients) {
      sendJson(client, payload)
    }
  }

  private async ensureUpstream(channel: KalshiLiveChannel) {
    if (
      channel.initializePromise ||
      (channel.upstream && channel.upstream.readyState <= WebSocket.OPEN)
    ) {
      return
    }

    channel.initializePromise = this.initializeChannel(channel)
      .catch((error) => {
        const message = error instanceof Error
          ? error.message
          : 'Kalshi live stream initialization failed.'

        this.broadcast(channel, createErrorMessage(message))
      })
      .finally(() => {
        channel.initializePromise = null
      })

    await channel.initializePromise
  }

  private async initializeChannel(channel: KalshiLiveChannel) {
    const event = await loadKalshiEvent(channel.providerEventId)

    channel.markets = event.markets.map((market) => ({
      marketId: market.id,
      marketTicker: market.providerMarketId,
      title: market.title,
    }))
    channel.lastSnapshot = {
      eventId: event.id,
      markets: event.markets.map((market) => ({
        marketId: market.id,
        noPrice: market.noOutcome.price,
        title: market.title,
        yesPrice: market.yesOutcome.price,
      })),
      timestamp: Date.now(),
    }

    for (const market of event.markets) {
      const marketState = getOrCreateMarketState(
        channel.marketStateByTicker,
        market.providerMarketId,
      )

      marketState.lastPrice = market.yesOutcome.price
      marketState.noBid = market.noOutcome.price
      marketState.yesBid = market.yesOutcome.price
    }

    const headers = getKalshiWebSocketHeaders()

    if (!headers) {
      throw new Error('Kalshi websocket credentials are unavailable.')
    }

    const upstream = new WebSocket(KALSHI_WS_URL, {
      headers,
    })
    channel.upstream = upstream

    upstream.on('open', () => {
      this.broadcast(channel, createConnectedMessage(channel.eventId))

      if (channel.lastSnapshot) {
        this.broadcast(channel, createPriceUpdateMessage(channel.lastSnapshot))
      }

      upstream.send(
        JSON.stringify({
          cmd: 'subscribe',
          id: 1,
          params: {
            channels: ['ticker'],
            market_tickers: channel.markets.map((market) => market.marketTicker),
          },
        }),
      )
    })

    upstream.on('message', (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString()) as unknown

        if (!isRecord(payload)) {
          return
        }

        if (payload.type === 'ticker' && isRecord(payload.msg)) {
          const marketTicker = typeof payload.msg.market_ticker === 'string'
            ? payload.msg.market_ticker
            : ''

          if (!marketTicker) {
            return
          }

          updateKalshiState(channel, marketTicker, payload.msg)
          const nextSnapshot = buildSnapshot(channel)

          if (!snapshotsEqual(channel.lastSnapshot, nextSnapshot)) {
            channel.lastSnapshot = nextSnapshot
            this.broadcast(channel, createPriceUpdateMessage(nextSnapshot))
          }
        }

        if (payload.type === 'error') {
          this.broadcast(channel, createErrorMessage('Kalshi live stream returned an error.'))
        }
      } catch {
        this.broadcast(channel, createErrorMessage('Received an invalid live payload from Kalshi.'))
      }
    })

    upstream.on('error', () => {
      this.broadcast(channel, createErrorMessage('Kalshi live stream errored.'))
    })

    upstream.on('close', () => {
      this.channels.delete(channel.providerEventId)

      for (const client of channel.clients) {
        if (client.readyState <= WebSocket.OPEN) {
          client.close(1012, 'Kalshi upstream disconnected')
        }
      }
    })
  }

  private getOrCreateChannel(eventId: string, providerEventId: string) {
    const existingChannel = this.channels.get(providerEventId)

    if (existingChannel) {
      return existingChannel
    }

    const nextChannel: KalshiLiveChannel = {
      clients: new Set(),
      eventId,
      initializePromise: null,
      lastSnapshot: null,
      marketStateByTicker: new Map(),
      markets: [],
      providerEventId,
      upstream: null,
    }

    this.channels.set(providerEventId, nextChannel)

    return nextChannel
  }

  private teardownChannel(providerEventId: string) {
    const channel = this.channels.get(providerEventId)

    if (!channel) {
      return
    }

    this.channels.delete(providerEventId)

    if (channel.upstream && channel.upstream.readyState <= WebSocket.OPEN) {
      channel.upstream.close()
    }
  }
}

export const kalshiLiveHub = new KalshiLiveHub()
