import {
  Area,
  AreaChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatProbability,
} from '../lib/format'
import type { PulsePricePoint } from '../features/events/types'

const DAY_MS = 24 * 60 * 60 * 1000

type HistoryRange = '1d' | '1w' | '1m' | 'all'

type PriceHistoryChartProps = {
  isLoading?: boolean
  points: PulsePricePoint[]
  range: HistoryRange
}

type ChartPoint = {
  price: number
  timestamp: number
}

type HistoryTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{
    payload: ChartPoint
    value?: number
  }>
}

function getRangeStartTimestamp(range: HistoryRange, latestTimestamp: number) {
  if (range === 'all') {
    return 0
  }

  if (range === '1m') {
    return latestTimestamp - 30 * DAY_MS
  }

  if (range === '1w') {
    return latestTimestamp - 7 * DAY_MS
  }

  return latestTimestamp - DAY_MS
}

function formatRangeTick(timestamp: number, range: HistoryRange) {
  if (range === '1d') {
    return new Intl.DateTimeFormat('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp))
  }

  if (range === 'all') {
    return new Intl.DateTimeFormat('en-NG', {
      month: 'short',
      year: '2-digit',
    }).format(new Date(timestamp))
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp))
}

function formatTooltipTimestamp(timestamp: number, range: HistoryRange) {
  if (range === '1d') {
    return new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
    }).format(new Date(timestamp))
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

function HistoryTooltip({
  active,
  payload,
  range,
}: HistoryTooltipProps & { range: HistoryRange }) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload

  if (!point) {
    return null
  }

  return (
    <div className="rounded-full bg-[#0f1115] px-3 py-1.5 text-xs text-[#f4f5f6] shadow-[0_10px_30px_rgba(15,17,21,0.18)]">
      <div className="flex items-center gap-2">
        <span className="mono-data">{formatTooltipTimestamp(point.timestamp, range)}</span>
        <span className="text-[#8a9099]">•</span>
        <span className="mono-data font-medium">{formatProbability(point.price / 100)}</span>
      </div>
    </div>
  )
}

export function PriceHistoryChart({
  isLoading = false,
  points,
  range,
}: PriceHistoryChartProps) {
  if (isLoading && !points.length) {
    return (
      <div className="panel-elevated flex h-[200px] items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        Loading stored history...
      </div>
    )
  }

  if (!points.length) {
    return (
      <div className="panel-elevated flex h-[200px] items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        Price history is not available for this market yet.
      </div>
    )
  }

  const sortedPoints = [...points].sort((leftPoint, rightPoint) => (
    leftPoint.timestamp - rightPoint.timestamp
  ))
  const latestTimestamp = sortedPoints[sortedPoints.length - 1]?.timestamp ?? 0
  const rangeStart = getRangeStartTimestamp(range, latestTimestamp)
  const filteredPoints = range === 'all'
    ? sortedPoints
    : sortedPoints.filter((point) => point.timestamp >= rangeStart)

  if (!filteredPoints.length) {
    return (
      <div className="panel-elevated flex h-[200px] items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        No stored history is available for this range yet.
      </div>
    )
  }

  const chartData = filteredPoints.map((point) => ({
    price: Number((point.price * 100).toFixed(2)),
    timestamp: point.timestamp,
  }))
  const sevenDayWindowStart = latestTimestamp - 7 * DAY_MS
  const sevenDayPoints = sortedPoints.filter(
    (point) => point.timestamp >= sevenDayWindowStart,
  )
  const comparisonPoints = sevenDayPoints.length ? sevenDayPoints : sortedPoints
  const sevenDayAverage = comparisonPoints.reduce(
    (sum, point) => sum + point.price,
    0,
  ) / comparisonPoints.length
  const currentPrice = sortedPoints[sortedPoints.length - 1]?.price ?? 0
  const strokeColor = currentPrice >= sevenDayAverage
    ? 'var(--color-up)'
    : 'var(--color-down)'

  return (
    <div className="panel-elevated h-[200px] p-3 sm:p-4">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
          <defs>
            <linearGradient id="price-wave" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <ReferenceLine
            ifOverflow="extendDomain"
            stroke="var(--surface-chart-grid)"
            strokeDasharray="4 4"
            y={50}
          />
          <XAxis
            axisLine={false}
            dataKey="timestamp"
            minTickGap={42}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={(value) => formatRangeTick(Number(value), range)}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            hide
          />
          <Tooltip
            content={({ active, payload }) => (
              <HistoryTooltip
                active={active}
                payload={payload as HistoryTooltipProps['payload']}
                range={range}
              />
            )}
            cursor={{ stroke: 'var(--surface-chart-grid)', strokeDasharray: '3 3' }}
          />
          <Area
            dataKey="price"
            fill="url(#price-wave)"
            isAnimationActive={false}
            stroke={strokeColor}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
