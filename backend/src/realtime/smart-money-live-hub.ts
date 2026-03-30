import WebSocket from 'ws'
import type {
  PulseSmartMoneyLiveMessage,
} from '../contracts/pulse-smart-money.js'
import { subscribeToSmartMoneySignals } from '../app/smart-money-service.js'

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

class SmartMoneyLiveHub {
  private readonly clients = new Set<WebSocket>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private unsubscribeFromSignals: (() => void) | null = null

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

  private startLoops() {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.broadcast({
          timestamp: Date.now(),
          type: 'heartbeat',
        })
      }, SMART_MONEY_HEARTBEAT_INTERVAL_MS)
    }

    if (!this.unsubscribeFromSignals) {
      this.unsubscribeFromSignals = subscribeToSmartMoneySignals((signals) => {
        for (const signal of signals) {
          this.broadcast({
            data: {
              ...signal,
              isNew: true,
            },
            timestamp: Date.now(),
            type: 'signal',
          })
        }
      })
    }
  }

  private stopLoops() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.unsubscribeFromSignals) {
      this.unsubscribeFromSignals()
      this.unsubscribeFromSignals = null
    }
  }
}

export const smartMoneyLiveHub = new SmartMoneyLiveHub()
