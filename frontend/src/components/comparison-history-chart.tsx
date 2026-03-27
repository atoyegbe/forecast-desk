import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  PulsePricePoint,
  PulseProvider,
} from '../features/events/types'
import { formatProbability } from '../lib/format'

const DAY_MS = 24 * 60 * 60 * 1000

type HistoryRange = '1d' | '1w' | '1m' | 'all'

type ComparisonSeries = {
  eventId: string
  label: string
  platform: PulseProvider
  points: PulsePricePoint[]
}

type ChartPoint = {
  timestamp: number
} & Record<string, number | null>

type ComparisonHistoryChartProps = {
  histories: ComparisonSeries[]
  isLoading?: boolean
  range: HistoryRange
}

type ComparisonTooltipProps = {
  active?: boolean
  label?: number
  payload?: ReadonlyArray<{
    color?: string
    dataKey?: string
    name?: string
    value?: number
  }>
  seriesById: Map<string, ComparisonSeries>
}

const PLATFORM_STROKES: Record<PulseProvider, string> = {
  bayse: 'var(--color-bayse)',
  polymarket: 'var(--color-polymarket)',
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

function ComparisonTooltip({
  active,
  label,
  payload,
  seriesById,
  range,
}: ComparisonTooltipProps & { range: HistoryRange }) {
  if (!active || !payload?.length || typeof label !== 'number') {
    return null
  }

  const visiblePayload = payload.filter(
    (entry) => typeof entry.value === 'number' && typeof entry.dataKey === 'string',
  )

  if (!visiblePayload.length) {
    return null
  }

  return (
    <div className="rounded-lg bg-[#0f1115] px-3 py-2 text-xs text-[#f4f5f6] shadow-[0_10px_30px_rgba(15,17,21,0.18)]">
      <div className="mono-data text-[11px] text-[#8a9099]">
        {formatTooltipTimestamp(label, range)}
      </div>
      <div className="mt-2 space-y-1.5">
        {visiblePayload.map((entry) => {
          const series = seriesById.get(entry.dataKey!)

          if (!series) {
            return null
          }

          return (
            <div className="flex items-center justify-between gap-3" key={entry.dataKey}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: entry.color }}
                />
                <span>{series.label}</span>
              </span>
              <span className="mono-data font-medium">
                {formatProbability((entry.value ?? 0) / 100)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ComparisonHistoryChart({
  histories,
  isLoading = false,
  range,
}: ComparisonHistoryChartProps) {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([])

  const normalizedHistories = useMemo(
    () => histories.filter((history) => history.points.length > 0),
    [histories],
  )

  const latestTimestamp = normalizedHistories.reduce((latest, history) => {
    const historyLatest = history.points[history.points.length - 1]?.timestamp ?? 0

    return Math.max(latest, historyLatest)
  }, 0)

  if (isLoading && !normalizedHistories.length) {
    return (
      <div className="panel-elevated flex h-[260px] items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        Loading cross-platform history...
      </div>
    )
  }

  if (!normalizedHistories.length) {
    return (
      <div className="panel-elevated flex h-[260px] items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        Stored multi-platform history is not available for this comparison yet.
      </div>
    )
  }

  const rangeStart = getRangeStartTimestamp(range, latestTimestamp)
  const filteredHistories = normalizedHistories.map((history) => ({
    ...history,
    points:
      range === 'all'
        ? history.points
        : history.points.filter((point) => point.timestamp >= rangeStart),
  }))
  const timestamps = [...new Set(
    filteredHistories.flatMap((history) => history.points.map((point) => point.timestamp)),
  )].sort((leftTimestamp, rightTimestamp) => leftTimestamp - rightTimestamp)
  const chartData: ChartPoint[] = timestamps.map((timestamp) => {
    const point: ChartPoint = { timestamp }

    for (const history of filteredHistories) {
      const matchingPoint = history.points.find((entry) => entry.timestamp === timestamp)
      point[history.eventId] = matchingPoint
        ? Number((matchingPoint.price * 100).toFixed(2))
        : null
    }

    return point
  })
  const visibleHistories = filteredHistories.filter(
    (history) => !hiddenSeriesIds.includes(history.eventId),
  )
  const seriesById = new Map(
    normalizedHistories.map((history) => [history.eventId, history]),
  )

  return (
    <div className="panel-elevated p-4">
      <div className="flex flex-wrap items-center gap-2">
        {normalizedHistories.map((history) => {
          const isHidden = hiddenSeriesIds.includes(history.eventId)

          return (
            <button
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                isHidden
                  ? 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
              }`}
              key={history.eventId}
              onClick={() => {
                setHiddenSeriesIds((currentIds) => (
                  currentIds.includes(history.eventId)
                    ? currentIds.filter((id) => id !== history.eventId)
                    : [...currentIds, history.eventId]
                ))
              }}
              type="button"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: PLATFORM_STROKES[history.platform] }}
              />
              <span>{history.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 h-[260px]">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={chartData} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
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
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={({ active, label, payload }) => (
                <ComparisonTooltip
                  active={active}
                  label={typeof label === 'number' ? label : Number(label)}
                  payload={payload as ComparisonTooltipProps['payload']}
                  range={range}
                  seriesById={seriesById}
                />
              )}
              cursor={{ stroke: 'var(--surface-chart-grid)', strokeDasharray: '3 3' }}
            />
            {visibleHistories.map((history) => (
              <Line
                activeDot={{ r: 3 }}
                connectNulls
                dataKey={history.eventId}
                dot={false}
                isAnimationActive={false}
                key={history.eventId}
                name={history.label}
                stroke={PLATFORM_STROKES[history.platform]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
