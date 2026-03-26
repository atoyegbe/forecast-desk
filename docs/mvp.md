# MVP

## Core User Story

Someone opens the site because they want to understand what prediction markets are saying about a major event right now.

## MVP Pages

### Home

- hero section with current big movers
- trending event list
- category strips for politics, sports, entertainment, crypto

### Event Detail

- event title and summary
- current YES/NO or multi-outcome prices
- intraday and multi-day chart
- live move badge
- simple explanation panel

### Movers

- biggest gainers
- biggest losers
- highest volume
- soon-to-resolve events

## Data Needed

- event list
- event details
- price history
- live WebSocket updates

## Product Rules

- show timestamps clearly
- distinguish live prices from delayed chart data
- do not imply certainty from market odds
- do not require login for the main product experience

## Good First Milestone

A read-only dashboard with:

- a homepage
- one event detail view
- a normalized Bayse data adapter
- mock editorial copy blocks
