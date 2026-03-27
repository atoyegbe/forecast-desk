import WebSocket, { type RawData } from 'ws'
import type {
  LiveMarketPrice,
  LivePriceSnapshot,
  PulseLiveMessage,
} from '../contracts/pulse-events.js'
import {
  buildProviderScopedId,
  parseProviderScopedId,
} from '../providers/provider-ids.js'

const BAYSE_WS_URL =
  process.env.BAYSE_WS_URL ?? 'wss://socket.bayse.markets/ws/v1/markets'

type BayseLiveChannel = {
  clients: Set<WebSocket>
  providerEventId: string
  upstream: WebSocket | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toScopedBayseId(providerId: string) {
  return buildProviderScopedId('bayse', providerId)
}

function toLiveMarketPrice(payload: Record<string, unknown>): LiveMarketPrice | null {
  const providerMarketId = typeof payload.id === 'string' ? payload.id : ''

  if (!providerMarketId) {
    return null
  }

  const prices = isRecord(payload.prices) ? payload.prices : null
  const yesPrice =
    typeof prices?.YES === 'number'
      ? prices.YES
      : typeof payload.outcome1Price === 'number'
        ? payload.outcome1Price
        : 0
  const noPrice =
    typeof prices?.NO === 'number'
      ? prices.NO
      : typeof payload.outcome2Price === 'number'
        ? payload.outcome2Price
        : Math.max(0, 1 - yesPrice)

  return {
    marketId: toScopedBayseId(providerMarketId),
    noPrice,
    title:
      typeof payload.question === 'string'
        ? payload.question
        : typeof payload.title === 'string'
          ? payload.title
          : 'Market',
    yesPrice,
  }
}

function buildPriceUpdateMessage(
  providerEventId: string,
  payload: Record<string, unknown>,
): PulseLiveMessage | null {
  const data = isRecord(payload.data) ? payload.data : null

  if (!data || data.id !== providerEventId) {
    return null
  }

  const markets = Array.isArray(data.markets)
    ? data.markets
        .filter((market): market is Record<string, unknown> => isRecord(market))
        .map(toLiveMarketPrice)
        .filter((market): market is LiveMarketPrice => market !== null)
    : []
  const timestamp = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now()
  const snapshot: LivePriceSnapshot = {
    eventId: toScopedBayseId(providerEventId),
    markets,
    timestamp,
  }

  return {
    data: snapshot,
    timestamp,
    type: 'price_update',
  }
}

function parseBayseMessages(raw: RawData) {
  return raw
    .toString()
    .split('\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function sendJson(socket: WebSocket, payload: PulseLiveMessage) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify(payload))
}

class BayseLiveHub {
  private readonly channels = new Map<string, BayseLiveChannel>()

  closeAll() {
    for (const providerEventId of this.channels.keys()) {
      this.teardownChannel(providerEventId)
    }
  }

  subscribe(eventId: string, client: WebSocket) {
    const parsed = parseProviderScopedId(eventId)

    if (parsed.provider !== 'bayse') {
      throw new Error('Live websocket streaming is currently only supported for Bayse events.')
    }

    const channel = this.getOrCreateChannel(parsed.providerId)
    channel.clients.add(client)
    this.ensureUpstream(channel)

    return () => {
      channel.clients.delete(client)

      if (!channel.clients.size) {
        this.teardownChannel(channel.providerEventId)
      }
    }
  }

  private broadcast(channel: BayseLiveChannel, payload: PulseLiveMessage) {
    for (const client of channel.clients) {
      sendJson(client, payload)
    }
  }

  private ensureUpstream(channel: BayseLiveChannel) {
    if (channel.upstream && channel.upstream.readyState <= WebSocket.OPEN) {
      return
    }

    const upstream = new WebSocket(BAYSE_WS_URL)
    channel.upstream = upstream

    upstream.on('open', () => {
      this.broadcast(channel, {
        eventId: toScopedBayseId(channel.providerEventId),
        timestamp: Date.now(),
        type: 'connected',
      })
      upstream.send(
        JSON.stringify({
          channel: 'prices',
          eventId: channel.providerEventId,
          type: 'subscribe',
        }),
      )
    })

    upstream.on('message', (rawMessage) => {
      for (const chunk of parseBayseMessages(rawMessage)) {
        try {
          const payload = JSON.parse(chunk) as unknown

          if (!isRecord(payload) || payload.type !== 'price_update') {
            continue
          }

          const normalizedMessage = buildPriceUpdateMessage(
            channel.providerEventId,
            payload,
          )

          if (normalizedMessage) {
            this.broadcast(channel, normalizedMessage)
          }
        } catch {
          this.broadcast(channel, {
            message: 'Received an invalid live payload from Bayse.',
            timestamp: Date.now(),
            type: 'error',
          })
        }
      }
    })

    upstream.on('error', () => {
      this.broadcast(channel, {
        message: 'Bayse live stream errored.',
        timestamp: Date.now(),
        type: 'error',
      })
    })

    upstream.on('close', () => {
      this.channels.delete(channel.providerEventId)

      for (const client of channel.clients) {
        if (client.readyState <= WebSocket.OPEN) {
          client.close(1012, 'Bayse upstream disconnected')
        }
      }
    })
  }

  private getOrCreateChannel(providerEventId: string) {
    const existingChannel = this.channels.get(providerEventId)

    if (existingChannel) {
      return existingChannel
    }

    const nextChannel: BayseLiveChannel = {
      clients: new Set(),
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

export const bayseLiveHub = new BayseLiveHub()
