import WebSocket from 'ws'
import type {
  LivePriceSnapshot,
  PulseEvent,
  PulseProvider,
} from '../contracts/pulse-events.js'
import { parseProviderScopedId } from '../providers/provider-ids.js'
import {
  buildSnapshotFromEvent,
  createConnectedMessage,
  createErrorMessage,
  createPriceUpdateMessage,
  sendJson,
  snapshotsEqual,
} from './live-shared.js'

type PollingChannel = {
  clients: Set<WebSocket>
  eventId: string
  interval: NodeJS.Timeout | null
  isRefreshing: boolean
  lastSnapshot: LivePriceSnapshot | null
  providerEventId: string
}

type PollingEventLiveHubOptions = {
  fetchEvent: (providerEventId: string) => Promise<PulseEvent>
  label: string
  pollIntervalMs: number
  provider: PulseProvider
}

export class PollingEventLiveHub {
  private readonly channels = new Map<string, PollingChannel>()
  private readonly fetchEvent: PollingEventLiveHubOptions['fetchEvent']
  private readonly label: string
  private readonly pollIntervalMs: number
  private readonly provider: PulseProvider

  constructor({
    fetchEvent,
    label,
    pollIntervalMs,
    provider,
  }: PollingEventLiveHubOptions) {
    this.fetchEvent = fetchEvent
    this.label = label
    this.pollIntervalMs = pollIntervalMs
    this.provider = provider
  }

  closeAll() {
    for (const providerEventId of this.channels.keys()) {
      this.teardownChannel(providerEventId)
    }
  }

  subscribe(eventId: string, client: WebSocket) {
    const parsed = parseProviderScopedId(eventId)

    if (parsed.provider !== this.provider) {
      throw new Error(`Live streaming is not available for ${parsed.provider} on this hub.`)
    }

    const channel = this.getOrCreateChannel(eventId, parsed.providerId)
    channel.clients.add(client)
    sendJson(client, createConnectedMessage(eventId))

    if (channel.lastSnapshot) {
      sendJson(client, createPriceUpdateMessage(channel.lastSnapshot))
    }

    this.ensurePolling(channel)

    return () => {
      channel.clients.delete(client)

      if (!channel.clients.size) {
        this.teardownChannel(channel.providerEventId)
      }
    }
  }

  private broadcastError(channel: PollingChannel, message: string) {
    for (const client of channel.clients) {
      sendJson(client, createErrorMessage(message))
    }
  }

  private broadcastSnapshot(channel: PollingChannel, snapshot: LivePriceSnapshot) {
    for (const client of channel.clients) {
      sendJson(client, createPriceUpdateMessage(snapshot))
    }
  }

  private ensurePolling(channel: PollingChannel) {
    if (channel.interval) {
      return
    }

    void this.refreshChannel(channel)
    channel.interval = setInterval(() => {
      void this.refreshChannel(channel)
    }, this.pollIntervalMs)
  }

  private async refreshChannel(channel: PollingChannel) {
    if (channel.isRefreshing) {
      return
    }

    channel.isRefreshing = true

    try {
      const event = await this.fetchEvent(channel.providerEventId)
      const snapshot = buildSnapshotFromEvent(event)

      if (!snapshotsEqual(channel.lastSnapshot, snapshot)) {
        channel.lastSnapshot = snapshot
        this.broadcastSnapshot(channel, snapshot)
      }
    } catch (error) {
      const suffix = error instanceof Error ? ` ${error.message}` : ''

      this.broadcastError(
        channel,
        `${this.label} live polling failed.${suffix}`.trim(),
      )
    } finally {
      channel.isRefreshing = false
    }
  }

  private getOrCreateChannel(eventId: string, providerEventId: string) {
    const existingChannel = this.channels.get(providerEventId)

    if (existingChannel) {
      return existingChannel
    }

    const nextChannel: PollingChannel = {
      clients: new Set(),
      eventId,
      interval: null,
      isRefreshing: false,
      lastSnapshot: null,
      providerEventId,
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

    if (channel.interval) {
      clearInterval(channel.interval)
    }
  }
}
