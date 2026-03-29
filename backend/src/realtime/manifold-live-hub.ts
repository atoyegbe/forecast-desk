import { getStoredDiscoveryEvent } from '../db/discovery-repository.js'
import { manifoldProvider } from '../providers/manifold.js'
import { buildProviderScopedId } from '../providers/provider-ids.js'
import { PollingEventLiveHub } from './polling-live-hub.js'

const MANIFOLD_LIVE_POLL_INTERVAL_MS = Number.parseInt(
  process.env.MANIFOLD_LIVE_POLL_INTERVAL_MS ?? '15000',
  10,
)

async function loadManifoldEvent(providerEventId: string) {
  const scopedEventId = buildProviderScopedId('manifold', providerEventId)
  const storedEvent = await getStoredDiscoveryEvent(scopedEventId)

  if (storedEvent?.provider === 'manifold') {
    return storedEvent
  }

  return manifoldProvider.getEvent(providerEventId)
}

export const manifoldLiveHub = new PollingEventLiveHub({
  fetchEvent: loadManifoldEvent,
  label: 'Manifold',
  pollIntervalMs: MANIFOLD_LIVE_POLL_INTERVAL_MS,
  provider: 'manifold',
})
