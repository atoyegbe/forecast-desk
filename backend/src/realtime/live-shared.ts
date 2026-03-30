import WebSocket from 'ws'
import type {
  LiveMarketPrice,
  LivePriceSnapshot,
  PulseEvent,
  PulseLiveMessage,
} from '../contracts/pulse-events.js'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function clampProbability(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function resolveQuotedProbability(
  bidValue: number | null | undefined,
  askValue: number | null | undefined,
  fallbackValue: number | null | undefined,
) {
  if (bidValue != null && askValue != null) {
    return clampProbability((bidValue + askValue) / 2)
  }

  if (askValue != null) {
    return clampProbability(askValue)
  }

  if (bidValue != null) {
    return clampProbability(bidValue)
  }

  return fallbackValue != null ? clampProbability(fallbackValue) : 0
}

export function buildSnapshotFromEvent(event: PulseEvent): LivePriceSnapshot {
  return {
    eventId: event.id,
    markets: event.markets.map((market): LiveMarketPrice => ({
      marketId: market.id,
      noPrice: market.noOutcome.price,
      title: market.title,
      yesPrice: market.yesOutcome.price,
    })),
    timestamp: Date.now(),
  }
}

export function snapshotsEqual(
  leftSnapshot: LivePriceSnapshot | null,
  rightSnapshot: LivePriceSnapshot | null,
) {
  if (!leftSnapshot || !rightSnapshot) {
    return false
  }

  if (
    leftSnapshot.eventId !== rightSnapshot.eventId ||
    leftSnapshot.markets.length !== rightSnapshot.markets.length
  ) {
    return false
  }

  return leftSnapshot.markets.every((market, index) => {
    const rightMarket = rightSnapshot.markets[index]

    return Boolean(rightMarket) &&
      market.marketId === rightMarket.marketId &&
      market.title === rightMarket.title &&
      market.yesPrice === rightMarket.yesPrice &&
      market.noPrice === rightMarket.noPrice
  })
}

export function sendJson(socket: WebSocket, payload: PulseLiveMessage) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify(payload))
}

export function createConnectedMessage(eventId: string): PulseLiveMessage {
  return {
    eventId,
    timestamp: Date.now(),
    type: 'connected',
  }
}

export function createErrorMessage(message: string): PulseLiveMessage {
  return {
    message,
    timestamp: Date.now(),
    type: 'error',
  }
}

export function createPriceUpdateMessage(snapshot: LivePriceSnapshot): PulseLiveMessage {
  return {
    data: snapshot,
    timestamp: snapshot.timestamp,
    type: 'price_update',
  }
}
