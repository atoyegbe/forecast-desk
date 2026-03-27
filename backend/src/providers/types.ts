import type {
  PulseEvent,
  PulseEventListParams,
  PulsePriceHistory,
  PulseProvider,
} from '../contracts/pulse-events.js'

export type PriceHistoryInput = {
  event: PulseEvent
  interval?: string
}

export type MarketProvider = {
  getEvent: (eventId: string) => Promise<PulseEvent>
  getPriceHistory: (input: PriceHistoryInput) => Promise<PulsePriceHistory>
  listEvents: (input?: PulseEventListParams) => Promise<PulseEvent[]>
  name: PulseProvider
}
