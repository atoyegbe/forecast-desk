import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatChartTick,
  formatProbability,
} from '../lib/format'
import type { PulsePricePoint } from '../features/events/types'

type PriceHistoryChartProps = {
  points: PulsePricePoint[]
}

export function PriceHistoryChart({ points }: PriceHistoryChartProps) {
  if (!points.length) {
    return (
      <div className="panel-elevated flex h-80 items-center justify-center p-6 text-center text-[var(--color-text-secondary)]">
        Price history is not available for this market yet.
      </div>
    )
  }

  const chartData = points.map((point) => ({
    label: formatChartTick(point.timestamp),
    price: Number((point.price * 100).toFixed(2)),
    timestamp: point.timestamp,
  }))
  const prices = chartData.map((point) => point.price)
  const averagePrice =
    prices.reduce((sum, price) => sum + price, 0) / prices.length
  const latestPrice = prices[prices.length - 1] ?? 0
  const strokeColor = latestPrice >= averagePrice ? '#22c55e' : '#ef4444'

  return (
    <div className="panel-elevated h-80 p-4 sm:p-6">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
          <defs>
            <linearGradient id="price-wave" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--surface-chart-grid)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={42}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-tooltip-bg)',
              border: '1px solid var(--surface-tooltip-border)',
              borderRadius: '10px',
              color: 'var(--surface-tooltip-text)',
            }}
            formatter={(value) => formatProbability(Number(value) / 100)}
            labelFormatter={(_, payload) =>
              payload?.[0]
                ? new Intl.DateTimeFormat('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(payload[0].payload.timestamp))
                : ''
            }
          />
          <Area
            dataKey="price"
            fill="url(#price-wave)"
            stroke={strokeColor}
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
