import WebSocket from 'ws'
import type {
  PulseSmartMoneyLiveMessage,
  PulseSmartMoneySignal,
} from '../contracts/pulse-smart-money.js'
import { getSmartMoneyRefreshIntervalMs } from '../db/config.js'
import { pollSmartMoneySignals } from '../app/smart-money-service.js'

const SMART_MONEY_HEARTBEAT_INTERVAL_MS = 20_000

function sendJson(
  socket: WebSocket,
  payload: PulseSmartMoneyLiveMessage,
) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify(payload))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Smart money live refresh failed.'
}

class SmartMoneyLiveHub {
  private readonly clients = new Set<WebSocket>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private refreshInFlight = false
  private refreshInterval: NodeJS.Timeout | null = null

  closeAll() {
    this.stopLoops()

    for (const client of this.clients) {
      if (client.readyState <= WebSocket.OPEN) {
        client.close(1001, 'Smart money live hub shutting down')
      }
    }

    this.clients.clear()
  }

  subscribe(client: WebSocket) {
    this.clients.add(client)

    sendJson(client, {
      timestamp: Date.now(),
      type: 'connected',
    })

    if (this.clients.size === 1) {
      this.startLoops()
    }

    return () => {
      this.clients.delete(client)

      if (!this.clients.size) {
        this.stopLoops()
      }
    }
  }

  private broadcast(payload: PulseSmartMoneyLiveMessage) {
    for (const client of this.clients) {
      sendJson(client, payload)
    }
  }

  private async refreshSignals() {
    if (this.refreshInFlight) {
      return
    }

    this.refreshInFlight = true

    try {
      const nextSignals = await pollSmartMoneySignals()

      if (!nextSignals.length) {
        return
      }

      for (const signal of nextSignals) {
        this.broadcast({
          data: {
            ...signal,
            isNew: true,
          } satisfies PulseSmartMoneySignal,
          timestamp: Date.now(),
          type: 'signal',
        })
      }
    } catch (error) {
      this.broadcast({
        message: getErrorMessage(error),
        timestamp: Date.now(),
        type: 'error',
      })
    } finally {
      this.refreshInFlight = false
    }
  }

  private startLoops() {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.broadcast({
          timestamp: Date.now(),
          type: 'heartbeat',
        })
      }, SMART_MONEY_HEARTBEAT_INTERVAL_MS)
    }

    if (!this.refreshInterval) {
      this.refreshInterval = setInterval(() => {
        void this.refreshSignals()
      }, getSmartMoneyRefreshIntervalMs())
    }
  }

  private stopLoops() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }
}

export const smartMoneyLiveHub = new SmartMoneyLiveHub()
