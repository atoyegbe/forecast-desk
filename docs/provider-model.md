# Provider Model

The product should not couple itself to a single API vendor.

## Principle

Normalize external market data into a local domain model. The UI should consume the local shape, not raw Bayse responses.

## Suggested Domain Objects

### Event

- `id`
- `provider`
- `slug`
- `title`
- `description`
- `category`
- `status`
- `region`
- `markets`
- `imageUrl`
- `openingDate`
- `closingDate`
- `resolutionDate`

### Market

- `id`
- `eventId`
- `title`
- `engine`
- `outcomes`
- `liquidity`
- `totalVolume`
- `supportedCurrencies`

### Outcome

- `id`
- `label`
- `price`
- `buyPrice`
- `sellPrice`

### Price Point

- `timestamp`
- `outcomeId`
- `price`
- `source`

## Provider Interface

Each provider should implement the same interface:

```ts
type MarketProvider = {
  name: string;
  listEvents(input?: ListEventsInput): Promise<Event[]>;
  getEvent(eventId: string): Promise<Event>;
  getPriceHistory(input: PriceHistoryInput): Promise<PricePoint[]>;
  subscribeToEventPrices?(eventId: string, onMessage: (event: Event) => void): () => void;
};
```

## Bayse Notes

- Bayse already gives public event discovery.
- Bayse already gives historical prices.
- Bayse already gives live event price updates over WebSocket.
- Bayse has both `AMM` and `CLOB`, but the UI should treat engine type as metadata, not as a routing constraint.

## Why This Matters

If you later add another provider, the app should only need:

- a new provider adapter
- provider-specific mapping tests
- provider selection logic

The pages, components, and charting code should stay mostly unchanged.
