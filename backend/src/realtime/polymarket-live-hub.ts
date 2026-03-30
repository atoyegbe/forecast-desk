import WebSocket from 'ws'
import type { LivePriceSnapshot } from '../contracts/pulse-events.js'
import { getStoredDiscoveryEvent } from '../db/discovery-repository.js'
import { polymarketProvider } from '../providers/polymarket.js'
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

const POLYMARKET_WS_URL =
  process.env.POLYMARKET_WS_URL?.trim() ??
  'wss://ws-subscriptions-clob.polymarket.com/ws/market'
const POLYMARKET_PING_INTERVAL_MS = 10_000

type PolymarketTokenState = {
  bestAsk: number | null
  bestBid: number | null
  lastTrade: number | null
}

type PolymarketLiveMarket = {
  marketId: string
  noAssetId: string
  title: string
  yesAssetId: string
}

type PolymarketLiveChannel = {
  clients: Set<WebSocket>
  eventId: string
  heartbeatInterval: NodeJS.Timeout | null
  initializePromise: Promise<void> | null
  lastSnapshot: LivePriceSnapshot | null
  markets: PolymarketLiveMarket[]
  providerEventId: string
  tokenStateByAssetId: Map<string, PolymarketTokenState>
  upstream: WebSocket | null
}

async function loadPolymarketEvent(providerEventId: string) {
  const scopedEventId = buildProviderScopedId('polymarket', providerEventId)
  const storedEvent = await getStoredDiscoveryEvent(scopedEventId)

  if (storedEvent?.provider === 'polymarket') {
    return storedEvent
  }

  return polymarketProvider.getEvent(providerEventId)
}

function getOrCreateTokenState(
  tokenStateByAssetId: Map<string, PolymarketTokenState>,
  assetId: string,
) {
  const existingState = tokenStateByAssetId.get(assetId)

  if (existingState) {
    return existingState
  }

  const nextState: PolymarketTokenState = {
    bestAsk: null,
    bestBid: null,
    lastTrade: null,
  }

  tokenStateByAssetId.set(assetId, nextState)

  return nextState
}

function getPriceFromBookSide(entries: unknown, direction: 'bid' | 'ask') {
  if (!Array.isArray(entries) || !entries.length) {
    return null
  }

  const prices = entries
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => toOptionalNumber(entry.price))
    .filter((price): price is number => price != null)

  if (!prices.length) {
    return null
  }

  return direction === 'bid' ? Math.max(...prices) : Math.min(...prices)
}

function buildSnapshot(channel: PolymarketLiveChannel) {
  return {
    eventId: channel.eventId,
    markets: channel.markets.map((market) => {
      const yesState = getOrCreateTokenState(channel.tokenStateByAssetId, market.yesAssetId)
      const noState = getOrCreateTokenState(channel.tokenStateByAssetId, market.noAssetId)
      const hasNoSignal =
        noState.bestBid != null ||
        noState.bestAsk != null ||
        noState.lastTrade != null
      const yesPrice = resolveQuotedProbability(
        yesState.bestBid,
        yesState.bestAsk,
        hasNoSignal
          ? yesState.lastTrade
          : yesState.lastTrade ?? (noState.lastTrade != null ? 1 - noState.lastTrade : null),
      )
      const noPrice = resolveQuotedProbability(
        noState.bestBid,
        noState.bestAsk,
        noState.lastTrade ?? 1 - yesPrice,
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

function updateBookState(
  channel: PolymarketLiveChannel,
  payload: Record<string, unknown>,
) {
  const assetId = typeof payload.asset_id === 'string' ? payload.asset_id : ''

  if (!assetId) {
    return
  }

  const tokenState = getOrCreateTokenState(channel.tokenStateByAssetId, assetId)

  tokenState.bestBid = getPriceFromBookSide(payload.bids, 'bid')
  tokenState.bestAsk = getPriceFromBookSide(payload.asks, 'ask')
}

function updateBestBidAskState(
  channel: PolymarketLiveChannel,
  payload: Record<string, unknown>,
) {
  const assetId = typeof payload.asset_id === 'string' ? payload.asset_id : ''

  if (!assetId) {
    return
  }

  const tokenState = getOrCreateTokenState(channel.tokenStateByAssetId, assetId)

  tokenState.bestBid = toOptionalNumber(payload.best_bid) ?? tokenState.bestBid
  tokenState.bestAsk = toOptionalNumber(payload.best_ask) ?? tokenState.bestAsk
}

function updatePriceChangeState(
  channel: PolymarketLiveChannel,
  payload: Record<string, unknown>,
) {
  const priceChanges = Array.isArray(payload.price_changes) ? payload.price_changes : []

  for (const entry of priceChanges) {
    if (!isRecord(entry)) {
      continue
    }

    const assetId = typeof entry.asset_id === 'string' ? entry.asset_id : ''

    if (!assetId) {
      continue
    }

    const tokenState = getOrCreateTokenState(channel.tokenStateByAssetId, assetId)

    tokenState.bestBid = toOptionalNumber(entry.best_bid) ?? tokenState.bestBid
    tokenState.bestAsk = toOptionalNumber(entry.best_ask) ?? tokenState.bestAsk
    tokenState.lastTrade = toOptionalNumber(entry.price) ?? tokenState.lastTrade
  }
}

function updateLastTradeState(
  channel: PolymarketLiveChannel,
  payload: Record<string, unknown>,
) {
  const assetId = typeof payload.asset_id === 'string' ? payload.asset_id : ''

  if (!assetId) {
    return
  }

  const tokenState = getOrCreateTokenState(channel.tokenStateByAssetId, assetId)

  tokenState.lastTrade = toOptionalNumber(payload.price) ?? tokenState.lastTrade
}

class PolymarketLiveHub {
  private readonly channels = new Map<string, PolymarketLiveChannel>()

  closeAll() {
    for (const providerEventId of this.channels.keys()) {
      this.teardownChannel(providerEventId)
    }
  }

  subscribe(eventId: string, client: WebSocket) {
    const parsed = parseProviderScopedId(eventId)

    if (parsed.provider !== 'polymarket') {
      throw new Error('Live websocket streaming is currently only supported for Polymarket events.')
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

  private broadcast(channel: PolymarketLiveChannel, payload: ReturnType<typeof createConnectedMessage> | ReturnType<typeof createErrorMessage> | ReturnType<typeof createPriceUpdateMessage>) {
    for (const client of channel.clients) {
      sendJson(client, payload)
    }
  }

  private async ensureUpstream(channel: PolymarketLiveChannel) {
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
          : 'Polymarket live stream initialization failed.'

        this.broadcast(channel, createErrorMessage(message))
      })
      .finally(() => {
        channel.initializePromise = null
      })

    await channel.initializePromise
  }

  private async initializeChannel(channel: PolymarketLiveChannel) {
    const event = await loadPolymarketEvent(channel.providerEventId)

    channel.markets = event.markets.map((market) => ({
      marketId: market.id,
      noAssetId: market.noOutcome.id,
      title: market.title,
      yesAssetId: market.yesOutcome.id,
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
      const yesState = getOrCreateTokenState(channel.tokenStateByAssetId, market.yesOutcome.id)
      const noState = getOrCreateTokenState(channel.tokenStateByAssetId, market.noOutcome.id)

      yesState.lastTrade = market.yesOutcome.price
      yesState.bestBid = market.yesOutcome.price
      noState.lastTrade = market.noOutcome.price
      noState.bestBid = market.noOutcome.price
    }

    const upstream = new WebSocket(POLYMARKET_WS_URL)
    channel.upstream = upstream

    upstream.on('open', () => {
      this.broadcast(channel, createConnectedMessage(channel.eventId))

      if (channel.lastSnapshot) {
        this.broadcast(channel, createPriceUpdateMessage(channel.lastSnapshot))
      }

      upstream.send(
        JSON.stringify({
          assets_ids: channel.markets.flatMap((market) => [
            market.yesAssetId,
            market.noAssetId,
          ]),
          custom_feature_enabled: true,
          type: 'market',
        }),
      )

      channel.heartbeatInterval = setInterval(() => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send('PING')
        }
      }, POLYMARKET_PING_INTERVAL_MS)
    })

    upstream.on('message', (rawMessage) => {
      const rawValue = rawMessage.toString()

      if (rawValue === 'PONG') {
        return
      }

      try {
        const payload = JSON.parse(rawValue) as unknown

        if (!isRecord(payload) || typeof payload.event_type !== 'string') {
          return
        }

        if (payload.event_type === 'book') {
          updateBookState(channel, payload)
        } else if (payload.event_type === 'best_bid_ask') {
          updateBestBidAskState(channel, payload)
        } else if (payload.event_type === 'price_change') {
          updatePriceChangeState(channel, payload)
        } else if (payload.event_type === 'last_trade_price') {
          updateLastTradeState(channel, payload)
        } else {
          return
        }

        const nextSnapshot = buildSnapshot(channel)

        if (!snapshotsEqual(channel.lastSnapshot, nextSnapshot)) {
          channel.lastSnapshot = nextSnapshot
          this.broadcast(channel, createPriceUpdateMessage(nextSnapshot))
        }
      } catch {
        this.broadcast(channel, createErrorMessage('Received an invalid live payload from Polymarket.'))
      }
    })

    upstream.on('error', () => {
      this.broadcast(channel, createErrorMessage('Polymarket live stream errored.'))
    })

    upstream.on('close', () => {
      this.channels.delete(channel.providerEventId)

      if (channel.heartbeatInterval) {
        clearInterval(channel.heartbeatInterval)
      }

      for (const client of channel.clients) {
        if (client.readyState <= WebSocket.OPEN) {
          client.close(1012, 'Polymarket upstream disconnected')
        }
      }
    })
  }

  private getOrCreateChannel(eventId: string, providerEventId: string) {
    const existingChannel = this.channels.get(providerEventId)

    if (existingChannel) {
      return existingChannel
    }

    const nextChannel: PolymarketLiveChannel = {
      clients: new Set(),
      eventId,
      heartbeatInterval: null,
      initializePromise: null,
      lastSnapshot: null,
      markets: [],
      providerEventId,
      tokenStateByAssetId: new Map(),
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

    if (channel.heartbeatInterval) {
      clearInterval(channel.heartbeatInterval)
    }

    if (channel.upstream && channel.upstream.readyState <= WebSocket.OPEN) {
      channel.upstream.close()
    }
  }
}

export const polymarketLiveHub = new PolymarketLiveHub()
